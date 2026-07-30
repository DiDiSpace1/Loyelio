'use server';

import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {canStoreDocument, canUseAutoQuittance, getWorkspaceBilling} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {syncQuittanceForRentCharge} from '@/lib/quittance/sync';
import {getCurrentUserWorkspace} from '@/lib/workspace';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function moneyValue(formData: FormData, key: string) {
  const parsed = Number.parseFloat(value(formData, key).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]+/g, '-').replace(/-+/g, '-').slice(0, 120);
}

function monthStart(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value.slice(0, 7)}-01`;
  }

  return '';
}

function paymentMethod(value: string) {
  return ['bank_transfer', 'cash', 'cheque', 'card', 'other'].includes(value) ? value : 'bank_transfer';
}

function revenueType(value: string) {
  return ['rent', 'deposit', 'other'].includes(value) ? value : 'rent';
}

const revenueTypeNotePattern = /^\[\[loyelio:revenue_type=(rent|deposit|other)\]\]\n?/;

function noteRevenueType(notes: string | null | undefined) {
  return notes?.match(revenueTypeNotePattern)?.[1] ?? 'rent';
}

function encodeRevenueNotes(type: string, notes: string) {
  if (type === 'rent') {
    return notes || null;
  }

  return `[[loyelio:revenue_type=${type}]]${notes ? `\n${notes}` : ''}`;
}

function isRentPayment(payment: {notes?: string | null}) {
  return noteRevenueType(payment.notes) === 'rent';
}

function redirectHref(locale: string, formData: FormData, fallbackPath: `/${string}`, params?: Record<string, string>) {
  const fallback = `${localizedPath(locale, fallbackPath)}${params ? `?${new URLSearchParams(params).toString()}` : ''}`;
  const returnHref = value(formData, 'return_href');
  const localeRoot = localizedPath(locale, '/');

  if (!returnHref || returnHref.startsWith('//') || !returnHref.startsWith(localeRoot)) {
    return fallback;
  }

  return returnHref;
}

export async function createRevenueTransactionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const leaseId = value(formData, 'lease_id');
  const periodMonth = monthStart(value(formData, 'period_month'));
  const amount = moneyValue(formData, 'amount');
  const receivedAt = value(formData, 'received_at') || new Date().toISOString().slice(0, 10);
  const type = revenueType(value(formData, 'revenue_type'));
  const notes = value(formData, 'notes');

  if (!leaseId || !periodMonth || amount <= 0) {
    redirect(`${localizedPath(locale, '/transactions')}?error=revenue_missing`);
  }

  const {profile, supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: lease} = await supabase
    .from('leases')
    .select('id, start_date, end_date, monthly_rent, charges_amount')
    .eq('id', leaseId)
    .eq('workspace_id', workspaceId)
    .maybeSingle<{charges_amount: number | null; end_date: string | null; id: string; monthly_rent: number | null; start_date: string}>();

  if (!lease) {
    redirect(`${localizedPath(locale, '/transactions')}?error=lease_missing`);
  }

  const leaseStartMonth = monthStart(lease.start_date);
  const leaseEndMonth = lease.end_date ? monthStart(lease.end_date) : null;

  if (periodMonth < leaseStartMonth || (leaseEndMonth && periodMonth > leaseEndMonth)) {
    redirect(`${localizedPath(locale, '/transactions')}?error=revenue_period_outside_lease`);
  }

  const rentAmount = Number(lease.monthly_rent ?? 0);
  const chargesAmount = Number(lease.charges_amount ?? 0);
  const totalDue = rentAmount + chargesAmount;
  const {data: existingCharge} = await supabase
    .from('rent_charges')
    .select('id, rent_amount, charges_amount, total_due, rent_payments(amount, notes)')
    .eq('workspace_id', workspaceId)
    .eq('lease_id', leaseId)
    .eq('period_month', periodMonth)
    .maybeSingle<{charges_amount: number | null; id: string; rent_amount: number | null; total_due: number | null; rent_payments: {amount: number | null; notes: string | null}[]}>();
  const effectiveRentAmount = existingCharge?.rent_amount == null ? rentAmount : Number(existingCharge.rent_amount);
  const effectiveChargesAmount = existingCharge?.charges_amount == null ? chargesAmount : Number(existingCharge.charges_amount);
  const effectiveTotalDue = existingCharge?.total_due == null ? totalDue : Number(existingCharge.total_due);
  const alreadyPaid = existingCharge?.rent_payments.filter(isRentPayment).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) ?? 0;
  const nextPaid = alreadyPaid + (type === 'rent' ? amount : 0);
  const remainingDue = Math.max(0, effectiveTotalDue - alreadyPaid);

  if (type === 'rent' && amount > remainingDue) {
    redirect(`${localizedPath(locale, '/transactions')}?error=revenue_overpaid`);
  }

  const status = nextPaid <= 0 ? 'unpaid' : nextPaid < effectiveTotalDue ? 'partial' : 'paid';
  const {data: charge, error: chargeError} = await supabase
    .from('rent_charges')
    .upsert(
      {
        charges_amount: effectiveChargesAmount,
        due_date: receivedAt,
        lease_id: leaseId,
        notes: notes || null,
        period_month: periodMonth,
        rent_amount: effectiveRentAmount,
        status,
        total_due: effectiveTotalDue,
        workspace_id: workspaceId
      },
      {onConflict: 'lease_id,period_month'}
    )
    .select('id')
    .single<{id: string}>();

  if (chargeError || !charge) {
    redirect(`${localizedPath(locale, '/transactions')}?error=revenue_failed`);
  }

  const {error: paymentError} = await supabase.from('rent_payments').insert({
    amount,
    notes: encodeRevenueNotes(type, notes),
    paid_at: receivedAt,
    payment_method: paymentMethod(value(formData, 'payment_method')),
    rent_charge_id: charge.id,
    workspace_id: workspaceId
  });

  if (paymentError) {
    redirect(`${localizedPath(locale, '/transactions')}?error=payment_failed`);
  }

  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (type === 'rent' && status === 'paid' && canUseAutoQuittance(billing)) {
    try {
      await syncQuittanceForRentCharge(supabase, workspaceId, charge.id, profile.full_name || profile.email || 'Proprietaire');
    } catch (error) {
      console.error('Automatic quittance synchronization failed after transaction creation', {error, rentChargeId: charge.id, workspaceId});
      redirect(`${localizedPath(locale, '/transactions')}?error=receipt_sync_failed`);
    }
  }

  revalidatePath(localizedPath(locale, '/transactions'));
  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(redirectHref(locale, formData, '/transactions', {success: 'transaction_created'}));
}

export async function createExpenseTransactionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const amount = moneyValue(formData, 'amount');
  const expenseDate = value(formData, 'expense_date');

  if (!expenseDate || amount <= 0) {
    redirect(`${localizedPath(locale, '/transactions')}?error=expense_missing`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const file = formData.get('receipt');
  let documentId: string | null = null;

  if (file instanceof File && file.size > 0) {
    const storageGate = await canStoreDocument(supabase, workspaceId, file.size);

    if (!storageGate.allowed) {
      redirect(`${localizedPath(locale, '/transactions')}?error=${storageGate.reason === 'file_size' ? 'file_too_large' : 'storage_limit'}`);
    }

    documentId = randomUUID();
    const year = new Date(expenseDate).getUTCFullYear();
    const filePath = `workspace/${workspaceId}/documents/${year}/${documentId}-${safeFileName(file.name)}`;
    const {error: uploadError} = await supabase.storage.from('documents').upload(filePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false
    });

    if (uploadError) {
      redirect(`${localizedPath(locale, '/transactions')}?error=upload_failed`);
    }

    const {error: documentError} = await supabase.from('documents').insert({
      document_type: 'invoice',
      extracted_amount: amount,
      extracted_date: expenseDate,
      extracted_vendor: value(formData, 'vendor') || null,
      file_name: file.name,
      file_path: filePath,
      id: documentId,
      mime_type: file.type || null,
      property_id: value(formData, 'property_id') || null,
      size_bytes: file.size,
      workspace_id: workspaceId
    });

    if (documentError) {
      await supabase.storage.from('documents').remove([filePath]);
      redirect(`${localizedPath(locale, '/transactions')}?error=document_failed`);
    }
  }

  const {error} = await supabase.from('expenses').insert({
    amount,
    currency: 'EUR',
    description: value(formData, 'description') || null,
    document_id: documentId,
    expense_date: expenseDate,
    property_id: value(formData, 'property_id') || null,
    receipt_status: documentId ? 'attached' : 'missing',
    tax_category_id: value(formData, 'tax_category_id') || null,
    vendor: value(formData, 'vendor') || null,
    workspace_id: workspaceId
  });

  if (error) {
    redirect(`${localizedPath(locale, '/transactions')}?error=expense_failed`);
  }

  revalidatePath(localizedPath(locale, '/transactions'));
  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(redirectHref(locale, formData, '/transactions', {success: 'transaction_created'}));
}

async function updateRentChargeStatus(supabase: Awaited<ReturnType<typeof getCurrentUserWorkspace>>['supabase'], workspaceId: string, rentChargeId: string) {
  const {data: charge} = await supabase
    .from('rent_charges')
    .select('id, total_due, rent_payments(amount, notes)')
    .eq('id', rentChargeId)
    .eq('workspace_id', workspaceId)
    .single<{id: string; total_due: number | null; rent_payments: {amount: number | null; notes: string | null}[]}>();

  if (!charge) {
    return;
  }

  const paidTotal = charge.rent_payments.filter(isRentPayment).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const totalDue = Number(charge.total_due ?? 0);
  const status = paidTotal <= 0 ? 'unpaid' : paidTotal >= totalDue ? 'paid' : 'partial';

  await supabase.from('rent_charges').update({status}).eq('id', rentChargeId).eq('workspace_id', workspaceId);
}

export async function updateTransactionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const type = value(formData, 'type');
  const id = value(formData, 'id');
  const amount = moneyValue(formData, 'amount');

  if (!id || amount <= 0) {
    redirect(`${localizedPath(locale, '/transactions')}?error=transaction_missing`);
  }

  const {profile, supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const shouldSyncReceipt = canUseAutoQuittance(billing) || value(formData, 'sync_receipt') === 'true';

  if (type === 'revenue') {
    const paidAt = value(formData, 'date') || new Date().toISOString().slice(0, 10);
    const {data: payment} = await supabase.from('rent_payments').select('id, amount, notes, rent_charge_id, rent_charges(total_due, rent_payments(id, amount, notes))').eq('id', id).eq('workspace_id', workspaceId).single<{
      amount: number | null;
      id: string;
      notes: string | null;
      rent_charge_id: string;
      rent_charges: {total_due: number | null; rent_payments: {id: string; amount: number | null; notes: string | null}[]} | null;
    }>();

    if (!payment) {
      redirect(`${localizedPath(locale, '/transactions')}?error=payment_not_found`);
    }

    const otherPaid = (payment.rent_charges?.rent_payments ?? []).filter((row) => row.id !== payment.id && isRentPayment(row)).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const totalDue = Number(payment.rent_charges?.total_due ?? 0);

    if (isRentPayment(payment) && amount > Math.max(0, totalDue - otherPaid)) {
      redirect(`${localizedPath(locale, '/transactions')}?error=revenue_overpaid`);
    }

    const {error} = await supabase
      .from('rent_payments')
      .update({
        amount,
        notes: encodeRevenueNotes(revenueType(value(formData, 'revenue_type') || noteRevenueType(payment.notes)), value(formData, 'notes')),
        paid_at: paidAt,
        payment_method: paymentMethod(value(formData, 'payment_method'))
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      redirect(`${localizedPath(locale, '/transactions')}?error=payment_update_failed`);
    }

    await updateRentChargeStatus(supabase, workspaceId, payment.rent_charge_id);

    const nextRevenueType = revenueType(value(formData, 'revenue_type') || noteRevenueType(payment.notes));

    if (shouldSyncReceipt && (isRentPayment(payment) || nextRevenueType === 'rent')) {
      try {
        await syncQuittanceForRentCharge(supabase, workspaceId, payment.rent_charge_id, profile.full_name || profile.email || 'Proprietaire');
      } catch (error) {
        console.error('Quittance synchronization failed after transaction update', {error, paymentId: id, rentChargeId: payment.rent_charge_id, workspaceId});
        redirect(`${localizedPath(locale, '/transactions')}?error=receipt_sync_failed`);
      }
    }
  } else if (type === 'expense') {
    const expenseDate = value(formData, 'date');
    const {error} = await supabase
      .from('expenses')
      .update({
        amount,
        description: value(formData, 'description') || null,
        expense_date: expenseDate,
        property_id: value(formData, 'property_id') || null,
        tax_category_id: value(formData, 'tax_category_id') || null,
        vendor: value(formData, 'vendor') || null
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      redirect(`${localizedPath(locale, '/transactions')}?error=expense_update_failed`);
    }
  }

  revalidatePath(localizedPath(locale, '/transactions'));
  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(`${localizedPath(locale, '/transactions')}?success=transaction_updated`);
}

export async function deleteTransactionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const type = value(formData, 'type');
  const id = value(formData, 'id');

  if (!id) {
    redirect(`${localizedPath(locale, '/transactions')}?error=transaction_missing`);
  }

  const {profile, supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const shouldSyncReceipt = canUseAutoQuittance(billing) || value(formData, 'sync_receipt') === 'true';

  if (type === 'revenue') {
    const {data: payment} = await supabase.from('rent_payments').select('notes, rent_charge_id').eq('id', id).eq('workspace_id', workspaceId).single<{notes: string | null; rent_charge_id: string}>();
    const {error} = await supabase.from('rent_payments').delete().eq('id', id).eq('workspace_id', workspaceId);

    if (error) {
      redirect(`${localizedPath(locale, '/transactions')}?error=payment_delete_failed`);
    }

    if (payment?.rent_charge_id) {
      await updateRentChargeStatus(supabase, workspaceId, payment.rent_charge_id);

      if (shouldSyncReceipt && isRentPayment(payment)) {
        try {
          await syncQuittanceForRentCharge(supabase, workspaceId, payment.rent_charge_id, profile.full_name || profile.email || 'Proprietaire');
        } catch (syncError) {
          console.error('Quittance synchronization failed after transaction deletion', {error: syncError, paymentId: id, rentChargeId: payment.rent_charge_id, workspaceId});
          redirect(`${localizedPath(locale, '/transactions')}?error=receipt_sync_failed`);
        }
      }
    }
  } else if (type === 'expense') {
    const {error} = await supabase.from('expenses').delete().eq('id', id).eq('workspace_id', workspaceId);

    if (error) {
      redirect(`${localizedPath(locale, '/transactions')}?error=expense_delete_failed`);
    }
  }

  revalidatePath(localizedPath(locale, '/transactions'));
  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(`${localizedPath(locale, '/transactions')}?success=transaction_deleted`);
}
