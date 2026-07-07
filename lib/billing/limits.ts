import type {SupabaseClient} from '@supabase/supabase-js';

import {FREE_PLAN_LIMITS, type BillableResource, type BillingStatus, hasPaidAccess} from './config';

const resourceTables: Record<BillableResource, string> = {
  documents: 'documents',
  properties: 'properties',
  tenants: 'tenants'
};

export async function getWorkspaceBilling(supabase: SupabaseClient, workspaceId: string) {
  const {data} = await supabase
    .from('workspace_billing')
    .select('current_period_end, lifetime_access, plan, status, stripe_customer_id, stripe_subscription_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle<BillingStatus>();

  return data ?? null;
}

export async function getPlanUsage(supabase: SupabaseClient, workspaceId: string, resource: BillableResource) {
  const {count} = await supabase
    .from(resourceTables[resource])
    .select('*', {count: 'exact', head: true})
    .eq('workspace_id', workspaceId);

  return count ?? 0;
}

export async function canCreateResource(supabase: SupabaseClient, workspaceId: string, resource: BillableResource) {
  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (hasPaidAccess(billing)) {
    return {
      allowed: true,
      billing,
      limit: null,
      usage: null
    };
  }

  const usage = await getPlanUsage(supabase, workspaceId, resource);
  const limit = FREE_PLAN_LIMITS[resource];

  return {
    allowed: usage < limit,
    billing,
    limit,
    usage
  };
}
