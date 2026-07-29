import type {SupabaseClient} from '@supabase/supabase-js';

import {createQuittanceDocument} from './service';

type ChargeForReceiptSync = {
  charges_amount: number | null;
  id: string;
  leases:
    | {
        property_id: string;
        tenant_id: string | null;
      }
    | {
        property_id: string;
        tenant_id: string | null;
      }[]
    | null;
  period_month: string;
  rent_amount: number | null;
  rent_payments: {
    amount: number | null;
    notes: string | null;
    paid_at: string;
    payment_method: string | null;
  }[];
  status: string;
  total_due: number | null;
};

type ReceiptDocument = {
  file_path: string;
  id: string;
};

const revenueTypeNotePattern = /^\[\[loyelio:revenue_type=(rent|deposit|other)\]\]\n?/;

function isRentPayment(payment: {notes?: string | null}) {
  return (payment.notes?.match(revenueTypeNotePattern)?.[1] ?? 'rent') === 'rent';
}

function relationOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function matchingReceipts(
  supabase: SupabaseClient,
  workspaceId: string,
  propertyId: string,
  tenantId: string | null,
  periodMonth: string
) {
  let query = supabase
    .from('documents')
    .select('id, file_path')
    .eq('workspace_id', workspaceId)
    .eq('document_type', 'rent_receipt')
    .eq('property_id', propertyId)
    .eq('period_month', `${periodMonth.slice(0, 7)}-01`);

  query = tenantId ? query.eq('tenant_id', tenantId) : query.is('tenant_id', null);
  const {data, error} = await query.returns<ReceiptDocument[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function removeReceipts(supabase: SupabaseClient, workspaceId: string, receipts: ReceiptDocument[]) {
  if (!receipts.length) {
    return;
  }

  const {error} = await supabase
    .from('documents')
    .delete()
    .eq('workspace_id', workspaceId)
    .in(
      'id',
      receipts.map((receipt) => receipt.id)
    );

  if (error) {
    throw error;
  }

  const paths = receipts.map((receipt) => receipt.file_path).filter(Boolean);

  if (paths.length) {
    const {error: storageError} = await supabase.storage.from('documents').remove(paths);

    if (storageError) {
      console.error('Quittance storage cleanup failed', {paths, storageError, workspaceId});
    }
  }
}

export async function syncQuittanceForRentCharge(
  supabase: SupabaseClient,
  workspaceId: string,
  rentChargeId: string,
  ownerName: string
) {
  const {data: charge, error} = await supabase
    .from('rent_charges')
    .select(
      'id, period_month, status, rent_amount, charges_amount, total_due, leases(property_id, tenant_id), rent_payments(amount, paid_at, payment_method, notes)'
    )
    .eq('workspace_id', workspaceId)
    .eq('id', rentChargeId)
    .single<ChargeForReceiptSync>();

  if (error || !charge) {
    throw error ?? new Error('Rent charge not found while synchronizing quittance.');
  }

  const lease = relationOne(charge.leases);

  if (!lease?.property_id) {
    return {action: 'skipped' as const};
  }

  const receipts = await matchingReceipts(supabase, workspaceId, lease.property_id, lease.tenant_id, charge.period_month);
  const rentPayments = charge.rent_payments.filter(isRentPayment).sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  const paidTotal = rentPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const isPaid = charge.status === 'paid' && paidTotal >= Number(charge.total_due ?? 0);

  if (!isPaid || !rentPayments.length) {
    await removeReceipts(supabase, workspaceId, receipts);
    return {action: receipts.length ? ('deleted' as const) : ('skipped' as const)};
  }

  const latestPayment = rentPayments[0];
  const created = await createQuittanceDocument(
    supabase,
    workspaceId,
    {
      amount: Number(charge.rent_amount ?? 0),
      charges: Number(charge.charges_amount ?? 0),
      ownerName,
      paidAt: latestPayment.paid_at,
      paymentMethod: latestPayment.payment_method ?? 'bank_transfer',
      periodMonth: charge.period_month.slice(0, 7),
      propertyId: lease.property_id,
      tenantId: lease.tenant_id
    },
    {skipIfExists: false}
  );

  await removeReceipts(
    supabase,
    workspaceId,
    receipts.filter((receipt) => receipt.id !== created.documentId)
  );

  return {action: receipts.length ? ('updated' as const) : ('created' as const), documentId: created.documentId};
}
