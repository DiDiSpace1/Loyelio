'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {recordAutoQuittanceEvent} from '@/lib/automation/events';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {normalizedCollectionStatus, recordRentCollectionEvent} from '@/lib/collections/audit';
import {localizedPath} from '@/lib/navigation';
import {createQuittanceDocument} from '@/lib/quittance/service';
import {sendRentReminderEmail} from '@/lib/reminders/email';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getCurrentUserWorkspace} from '@/lib/workspace';

type RentPaymentRow = {
  amount: number | null;
  notes: string | null;
};

type RentChargeRow = {
  id: string;
  period_month: string;
  rent_payments: RentPaymentRow[];
  status: string;
  total_due: number | null;
};

type LeaseRow = {
  charges_amount: number | null;
  id: string;
  monthly_rent: number | null;
  property_id: string | null;
  rent_charges: RentChargeRow[];
  tenant_id: string | null;
};

type ReminderLeaseRow = {
  charges_amount: number | null;
  id: string;
  monthly_rent: number | null;
  properties: {name: string} | {name: string}[] | null;
  rent_charges: {period_month: string; status: string; total_due: number | null}[];
  rent_reminder_day: number | null;
  start_date: string;
  tenant_id: string | null;
  tenants: {email: string | null; full_name: string} | {email: string | null; full_name: string}[] | null;
  units: {name: string | null} | {name: string | null}[] | null;
};

type SkipReason = 'existingPaid' | 'invalidAmount' | 'saveFailed' | 'zeroAmount';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function moneyValue(formData: FormData, key: string) {
  const parsed = Number.parseFloat(value(formData, key).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function collectionHref(locale: string, month: string, view: string) {
  const params = new URLSearchParams();

  if (/^\d{4}-\d{2}$/.test(month)) {
    params.set('month', month);
  }

  if (['all', 'open', 'unpaid', 'partial', 'paid'].includes(view)) {
    params.set('view', view);
  }

  const query = params.toString();
  return `${localizedPath(locale, '/collections')}${query ? `?${query}` : ''}`;
}

function withParams(url: string, params: Record<string, number | string>) {
  const joiner = url.includes('?') ? '&' : '?';
  const search = new URLSearchParams();

  for (const [key, paramValue] of Object.entries(params)) {
    search.set(key, String(paramValue));
  }

  return `${url}${joiner}${search.toString()}`;
}

function isRentPayment(payment: RentPaymentRow) {
  return !payment.notes?.startsWith('[[loyelio:revenue_type=deposit]]') && !payment.notes?.startsWith('[[loyelio:revenue_type=other]]');
}

function paidTotal(charge: RentChargeRow | null | undefined) {
  return (charge?.rent_payments ?? []).filter(isRentPayment).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
}

function paymentMethod(value: string) {
  return ['bank_transfer', 'cash', 'cheque', 'card', 'other'].includes(value) ? value : 'bank_transfer';
}

function relationOne<T>(item: T | T[] | null) {
  return Array.isArray(item) ? (item[0] ?? null) : item;
}

function dueDateForMonth(month: string, preferredDay: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const day = Math.min(Math.max(preferredDay, 1), lastDay);
  return `${month}-${String(day).padStart(2, '0')}`;
}

export async function sendCollectionReminderAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const month = value(formData, 'month');
  const periodMonth = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : '';
  const leaseId = value(formData, 'reminder_lease_id');
  const returnHref = collectionHref(locale, month, value(formData, 'view'));

  if (!leaseId || !periodMonth) {
    redirect(withParams(returnHref, {error: 'rent_reminder_failed'}));
  }

  const {profile, supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const hasPortfolioAccess = hasPaidAccess(billing) && normalizeBillingPlan(billing?.plan) === 'portfolio';

  if (!hasPortfolioAccess) {
    redirect(withParams(returnHref, {error: 'portfolio_required'}));
  }

  const {data: lease, error: leaseError} = await supabase
    .from('leases')
    .select(
      'id, tenant_id, start_date, monthly_rent, charges_amount, rent_reminder_day, tenants(full_name, email), properties(name), units(name), rent_charges(period_month, status, total_due)'
    )
    .eq('workspace_id', workspaceId)
    .eq('id', leaseId)
    .eq('status', 'active')
    .single<ReminderLeaseRow>();

  if (leaseError || !lease) {
    redirect(withParams(returnHref, {error: 'rent_reminder_failed'}));
  }

  const tenant = relationOne(lease.tenants);

  if (!tenant?.email || !lease.tenant_id) {
    redirect(withParams(returnHref, {error: 'tenant_email_required'}));
  }

  const charge = lease.rent_charges.find((item) => item.period_month === periodMonth);

  if (charge?.status === 'paid') {
    redirect(withParams(returnHref, {error: 'rent_reminder_already_paid'}));
  }

  const property = relationOne(lease.properties);
  const unit = relationOne(lease.units);
  const {data: workspace} = await supabase.from('workspaces').select('name').eq('id', workspaceId).single<{name: string}>();
  const startDay = Number.parseInt(lease.start_date.slice(8, 10), 10);
  const preferredDay = lease.rent_reminder_day ?? (Number.isFinite(startDay) ? startDay : 1);
  const dueDate = dueDateForMonth(month, preferredDay);
  const totalDue = Number(charge?.total_due ?? Number(lease.monthly_rent ?? 0) + Number(lease.charges_amount ?? 0));
  const propertyLabel = [property?.name, unit?.name].filter(Boolean).join(' - ') || workspace?.name || 'votre logement';
  const admin = createSupabaseAdminClient();
  const sentAt = new Date().toISOString();

  try {
    const providerMessageId = await sendRentReminderEmail({
      amount: totalDue,
      dueDate,
      ownerName: profile.full_name || workspace?.name || 'Votre bailleur',
      propertyLabel,
      reminderMonth: periodMonth,
      tenantEmail: tenant.email,
      tenantName: tenant.full_name
    });

    await admin.from('rent_reminder_logs').upsert(
      {
        due_date: dueDate,
        email_to: tenant.email,
        error_message: null,
        lease_id: lease.id,
        provider_message_id: providerMessageId,
        reminder_month: periodMonth,
        reminder_type: 'manual_collection',
        scheduled_for: sentAt.slice(0, 10),
        sent_at: sentAt,
        status: 'sent',
        tenant_id: lease.tenant_id,
        workspace_id: workspaceId
      },
      {onConflict: 'lease_id,reminder_month,reminder_type'}
    );
    await admin.from('leases').update({last_rent_reminder_sent_at: sentAt}).eq('id', lease.id).eq('workspace_id', workspaceId);
  } catch (error) {
    await admin.from('rent_reminder_logs').upsert(
      {
        due_date: dueDate,
        email_to: tenant.email,
        error_message: error instanceof Error ? error.message : 'Unknown email error.',
        lease_id: lease.id,
        provider_message_id: null,
        reminder_month: periodMonth,
        reminder_type: 'manual_collection',
        scheduled_for: sentAt.slice(0, 10),
        sent_at: null,
        status: 'failed',
        tenant_id: lease.tenant_id,
        workspace_id: workspaceId
      },
      {onConflict: 'lease_id,reminder_month,reminder_type'}
    );
    redirect(withParams(returnHref, {error: 'rent_reminder_failed'}));
  }

  revalidatePath(localizedPath(locale, '/collections'));
  revalidatePath(localizedPath(locale, '/reminders'));
  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(withParams(returnHref, {success: 'rent_reminder_sent'}));
}

export async function updateCollectionsAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const month = value(formData, 'month');
  const periodMonth = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : '';
  const [singleLeaseId = '', singleStatus = ''] = value(formData, 'single_action').split(':');
  const isSingleUpdate = Boolean(singleLeaseId) && ['paid', 'partial', 'unpaid'].includes(singleStatus);
  const selectedLeaseIds = isSingleUpdate ? [singleLeaseId] : formData.getAll('lease_ids').filter((id): id is string => typeof id === 'string' && Boolean(id));
  const nextStatus = isSingleUpdate ? singleStatus : value(formData, 'status');
  const paidAt = value(formData, 'paid_at') || new Date().toISOString().slice(0, 10);
  const returnHref = collectionHref(locale, month, value(formData, 'view'));

  if (!periodMonth || !selectedLeaseIds.length || !['paid', 'partial', 'unpaid'].includes(nextStatus)) {
    redirect(withParams(returnHref, {collection_error: 'collections_missing'}));
  }

  const {profile, supabase, user, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const hasPortfolioAccess = hasPaidAccess(billing) && normalizeBillingPlan(billing?.plan) === 'portfolio';

  if (!hasPortfolioAccess) {
    redirect(withParams(returnHref, {collection_error: 'portfolio_required'}));
  }

  const {data: leases, error: leaseError} = await supabase
    .from('leases')
    .select('id, tenant_id, property_id, monthly_rent, charges_amount, rent_charges(id, period_month, status, total_due, rent_payments(amount, notes))')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .in('id', selectedLeaseIds)
    .returns<LeaseRow[]>();

  if (leaseError || !leases?.length) {
    redirect(withParams(returnHref, {collection_error: 'collections_load_failed'}));
  }

  let updated = 0;
  let receipts = 0;
  const skipped = {
    existingPaid: 0,
    invalidAmount: 0,
    saveFailed: 0,
    zeroAmount: 0
  };
  const skippedRows: Array<{leaseId: string; reason: SkipReason}> = [];
  const updatedLeaseIds: string[] = [];

  function recordSkip(leaseId: string, reason: SkipReason) {
    skipped[reason] += 1;
    skippedRows.push({leaseId, reason});
  }

  for (const lease of leases) {
    const rentAmount = Number(lease.monthly_rent ?? 0);
    const chargesAmount = Number(lease.charges_amount ?? 0);
    const totalDue = rentAmount + chargesAmount;
    const existingCharge = lease.rent_charges.find((charge) => charge.period_month === periodMonth) ?? null;
    const existingPaid = paidTotal(existingCharge);

    if (totalDue <= 0) {
      recordSkip(lease.id, 'zeroAmount');
      continue;
    }

    if (nextStatus === 'unpaid' && existingPaid > 0) {
      recordSkip(lease.id, 'existingPaid');
      continue;
    }

    let targetStatus = nextStatus;
    let amountToInsert = 0;

    if (nextStatus === 'paid') {
      amountToInsert = Math.max(0, totalDue - existingPaid);
      targetStatus = 'paid';
    }

    if (nextStatus === 'partial') {
      const desiredPaid = moneyValue(formData, isSingleUpdate ? 'single_amount' : `amount_${lease.id}`);

      if (desiredPaid <= 0 || desiredPaid >= totalDue || existingPaid >= desiredPaid) {
        recordSkip(lease.id, 'invalidAmount');
        continue;
      }

      amountToInsert = desiredPaid - existingPaid;
      targetStatus = 'partial';
    }

    const statusForUpsert = amountToInsert > 0 ? (existingCharge?.status ?? 'unpaid') : targetStatus;
    const {data: rentCharge, error: chargeError} = await supabase
      .from('rent_charges')
      .upsert(
        {
          charges_amount: chargesAmount,
          due_date: paidAt,
          lease_id: lease.id,
          period_month: periodMonth,
          rent_amount: rentAmount,
          status: statusForUpsert,
          total_due: totalDue,
          workspace_id: workspaceId
        },
        {onConflict: 'lease_id,period_month'}
      )
      .select('id')
      .single<{id: string}>();

    if (chargeError || !rentCharge) {
      recordSkip(lease.id, 'saveFailed');
      continue;
    }

    let insertedPaymentId: string | null = null;

    if (amountToInsert > 0) {
      const {data: payment, error: paymentError} = await supabase
        .from('rent_payments')
        .insert({
          amount: amountToInsert,
          paid_at: paidAt,
          payment_method: paymentMethod(value(formData, 'payment_method')),
          rent_charge_id: rentCharge.id,
          workspace_id: workspaceId
        })
        .select('id')
        .single<{id: string}>();

      if (paymentError || !payment) {
        recordSkip(lease.id, 'saveFailed');
        continue;
      }

      insertedPaymentId = payment.id;
    }

    if (statusForUpsert !== targetStatus) {
      const {error: statusError} = await supabase.from('rent_charges').update({status: targetStatus}).eq('id', rentCharge.id).eq('workspace_id', workspaceId);

      if (statusError) {
        if (insertedPaymentId) {
          await supabase.from('rent_payments').delete().eq('id', insertedPaymentId).eq('workspace_id', workspaceId);
        }

        recordSkip(lease.id, 'saveFailed');
        continue;
      }
    }

    const audit = await recordRentCollectionEvent(supabase, {
      actorUserId: user.id,
      amountAfter: existingPaid + amountToInsert,
      amountBefore: existingPaid,
      leaseId: lease.id,
      newStatus: normalizedCollectionStatus(targetStatus),
      paymentAmount: amountToInsert,
      periodMonth,
      previousStatus: existingCharge ? normalizedCollectionStatus(existingCharge.status) : null,
      rentChargeId: rentCharge.id,
      source: isSingleUpdate ? 'single' : 'batch',
      workspaceId
    });

    if (audit.error) {
      console.error('Rent collection audit insert failed', {error: audit.error, leaseId: lease.id, periodMonth, workspaceId});
    }

    if (targetStatus === 'paid' && lease.property_id && lease.tenant_id) {
      try {
        const receipt = await createQuittanceDocument(
          supabase,
          workspaceId,
          {
            amount: rentAmount,
            charges: chargesAmount,
            ownerName: profile.full_name || profile.email || 'Proprietaire',
            paidAt,
            paymentMethod: paymentMethod(value(formData, 'payment_method')),
            periodMonth: month,
            propertyId: lease.property_id,
            tenantId: lease.tenant_id
          },
          {skipIfExists: true}
        );

        if (!receipt.skipped) {
          receipts += 1;
        }
        await recordAutoQuittanceEvent(supabase, {
          documentId: receipt.documentId,
          leaseId: lease.id,
          message: receipt.skipped ? 'Existing receipt reused.' : 'Receipt created after rent was marked paid.',
          periodMonth,
          status: receipt.skipped ? 'skipped' : 'created',
          tenantId: lease.tenant_id,
          workspaceId
        });
      } catch (error) {
        console.error('Batch collection quittance generation failed', {
          error,
          leaseId: lease.id,
          periodMonth,
          workspaceId
        });
        await recordAutoQuittanceEvent(supabase, {
          leaseId: lease.id,
          message: error instanceof Error ? error.message : 'Unknown automatic receipt error.',
          periodMonth,
          status: 'failed',
          tenantId: lease.tenant_id,
          workspaceId
        });
      }
    }

    updated += 1;
    updatedLeaseIds.push(lease.id);
  }

  revalidatePath(localizedPath(locale, '/collections'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/documents/quittance'));
  revalidatePath(localizedPath(locale, '/tax'));
  revalidatePath(localizedPath(locale, '/tenants'));
  revalidatePath(localizedPath(locale, '/transactions'));
  const skippedTotal = Object.values(skipped).reduce((sum, count) => sum + count, 0);
  redirect(
    withParams(returnHref, {
      collection_success: 'collections_updated',
      receipts,
      skipped: skippedTotal,
      skipped_existing_paid: skipped.existingPaid,
      skipped_invalid_amount: skipped.invalidAmount,
      skipped_save_failed: skipped.saveFailed,
      skipped_zero_amount: skipped.zeroAmount,
      result_skipped: skippedRows.map((row) => `${row.leaseId}:${row.reason}`).join(','),
      result_status: nextStatus,
      result_updated_ids: updatedLeaseIds.join(','),
      updated
    })
  );
}
