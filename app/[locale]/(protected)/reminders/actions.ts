'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {sendRentReminderEmail} from '@/lib/reminders/email';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getCurrentUserWorkspace} from '@/lib/workspace';

type Relation<T> = T | T[] | null;

type RetryLeaseRow = {
  charges_amount: number;
  id: string;
  monthly_rent: number;
  properties: Relation<{name: string}>;
  rent_charges: {period_month: string; total_due: number}[];
  tenant_id: string;
  tenants: Relation<{email: string | null; full_name: string}>;
  units: Relation<{name: string}>;
  workspace_id: string;
};

type FailedReminderLog = {
  due_date: string;
  reminder_month: string;
  reminder_type: string;
  scheduled_for: string;
};

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function selectedLeaseIds(formData: FormData) {
  return formData
    .getAll('lease_ids')
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function reminderDay(formData: FormData) {
  const parsed = Number.parseInt(value(formData, 'rent_reminder_day'), 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : null;
}

function daysBefore(formData: FormData) {
  const parsed = Number.parseInt(value(formData, 'rent_reminder_days_before'), 10);
  return [0, 1, 3, 7].includes(parsed) ? parsed : 0;
}

function remindersHref(locale: string, key: 'error' | 'success', status: string) {
  const params = new URLSearchParams({[key]: status});
  return `${localizedPath(locale, '/reminders')}?${params.toString()}`;
}

function relationOne<T>(item: Relation<T>) {
  return Array.isArray(item) ? (item[0] ?? null) : item;
}

function totalDue(lease: RetryLeaseRow, reminderMonth: string) {
  const rentCharge = lease.rent_charges.find((charge) => charge.period_month === reminderMonth);
  return Number(rentCharge?.total_due ?? Number(lease.monthly_rent ?? 0) + Number(lease.charges_amount ?? 0));
}

function hasPortfolioAccess(billing: Awaited<ReturnType<typeof getWorkspaceBilling>>) {
  return hasPaidAccess(billing) && normalizeBillingPlan(billing?.plan) === 'portfolio';
}

export async function updateReminderCenterAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const operation = value(formData, 'operation');
  const leaseIds = selectedLeaseIds(formData);

  if (!leaseIds.length) {
    redirect(remindersHref(locale, 'error', 'no_selection'));
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (!hasPortfolioAccess(billing)) {
    redirect(remindersHref(locale, 'error', 'portfolio_required'));
  }

  const updatePayload =
    operation === 'enable'
      ? {rent_reminder_enabled: true}
      : operation === 'disable'
        ? {rent_reminder_enabled: false}
        : operation === 'update_settings'
          ? {
              rent_reminder_day: reminderDay(formData),
              rent_reminder_days_before: daysBefore(formData)
            }
          : null;

  if (!updatePayload) {
    redirect(remindersHref(locale, 'error', 'invalid_operation'));
  }

  const {error} = await supabase.from('leases').update(updatePayload).eq('workspace_id', workspaceId).eq('status', 'active').in('id', leaseIds);

  if (error) {
    redirect(remindersHref(locale, 'error', 'update_failed'));
  }

  revalidatePath(localizedPath(locale, '/reminders'));
  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(remindersHref(locale, 'success', operation));
}

export async function retryFailedReminderAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const leaseId = value(formData, 'lease_id');

  if (!leaseId) {
    redirect(remindersHref(locale, 'error', 'retry_failed'));
  }

  const {profile, supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (!hasPortfolioAccess(billing)) {
    redirect(remindersHref(locale, 'error', 'portfolio_required'));
  }

  const {data: log, error: logError} = await supabase
    .from('rent_reminder_logs')
    .select('reminder_month, reminder_type, due_date, scheduled_for')
    .eq('workspace_id', workspaceId)
    .eq('lease_id', leaseId)
    .eq('status', 'failed')
    .order('created_at', {ascending: false})
    .limit(1)
    .maybeSingle<FailedReminderLog>();

  if (logError || !log) {
    redirect(remindersHref(locale, 'error', 'retry_missing_log'));
  }

  const {data: lease, error: leaseError} = await supabase
    .from('leases')
    .select('id, workspace_id, tenant_id, monthly_rent, charges_amount, tenants(full_name, email), properties(name), units(name), rent_charges(period_month, total_due)')
    .eq('workspace_id', workspaceId)
    .eq('id', leaseId)
    .eq('status', 'active')
    .single<RetryLeaseRow>();

  if (leaseError || !lease) {
    redirect(remindersHref(locale, 'error', 'retry_failed'));
  }

  const tenant = relationOne(lease.tenants);

  if (!tenant?.email) {
    redirect(remindersHref(locale, 'error', 'retry_missing_email'));
  }

  const {data: workspace} = await supabase.from('workspaces').select('name').eq('id', workspaceId).single<{name: string}>();
  const property = relationOne(lease.properties);
  const unit = relationOne(lease.units);
  const propertyLabel = [property?.name, unit?.name].filter(Boolean).join(' - ') || workspace?.name || 'votre logement';
  const admin = createSupabaseAdminClient();

  try {
    const providerMessageId = await sendRentReminderEmail({
      amount: totalDue(lease, log.reminder_month),
      dueDate: log.due_date,
      ownerName: profile.full_name || workspace?.name || 'Votre bailleur',
      propertyLabel,
      reminderMonth: log.reminder_month,
      tenantEmail: tenant.email,
      tenantName: tenant.full_name
    });

    await admin.from('rent_reminder_logs').upsert(
      {
        due_date: log.due_date,
        email_to: tenant.email,
        error_message: null,
        lease_id: lease.id,
        provider_message_id: providerMessageId,
        reminder_month: log.reminder_month,
        reminder_type: log.reminder_type,
        scheduled_for: log.scheduled_for,
        sent_at: new Date().toISOString(),
        status: 'sent',
        tenant_id: lease.tenant_id,
        workspace_id: workspaceId
      },
      {onConflict: 'lease_id,reminder_month,reminder_type'}
    );
    await admin.from('leases').update({last_rent_reminder_sent_at: new Date().toISOString()}).eq('id', lease.id).eq('workspace_id', workspaceId);
  } catch (error) {
    await admin.from('rent_reminder_logs').upsert(
      {
        due_date: log.due_date,
        email_to: tenant.email,
        error_message: error instanceof Error ? error.message : 'Unknown email error.',
        lease_id: lease.id,
        provider_message_id: null,
        reminder_month: log.reminder_month,
        reminder_type: log.reminder_type,
        scheduled_for: log.scheduled_for,
        sent_at: null,
        status: 'failed',
        tenant_id: lease.tenant_id,
        workspace_id: workspaceId
      },
      {onConflict: 'lease_id,reminder_month,reminder_type'}
    );
    redirect(remindersHref(locale, 'error', 'retry_failed'));
  }

  revalidatePath(localizedPath(locale, '/reminders'));
  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(remindersHref(locale, 'success', 'retry_sent'));
}
