import type {SupabaseClient} from '@supabase/supabase-js';

type CollectionStatus = 'paid' | 'partial' | 'unpaid';

export type RentCollectionEventInput = {
  actorUserId: string;
  amountAfter: number;
  amountBefore: number;
  leaseId: string;
  newStatus: CollectionStatus;
  paymentAmount: number;
  periodMonth: string;
  previousStatus: CollectionStatus | null;
  rentChargeId: string;
  source: 'batch' | 'single' | 'tenant';
  workspaceId: string;
};

export function normalizedCollectionStatus(value: string | null | undefined): CollectionStatus {
  return value === 'paid' || value === 'partial' ? value : 'unpaid';
}

export async function recordRentCollectionEvent(supabase: SupabaseClient, event: RentCollectionEventInput) {
  const {error} = await supabase.from('rent_collection_events').insert({
    actor_user_id: event.actorUserId,
    amount_after: event.amountAfter,
    amount_before: event.amountBefore,
    lease_id: event.leaseId,
    new_status: event.newStatus,
    payment_amount: event.paymentAmount,
    period_month: event.periodMonth,
    previous_status: event.previousStatus,
    rent_charge_id: event.rentChargeId,
    source: event.source,
    workspace_id: event.workspaceId
  });

  return {error};
}
