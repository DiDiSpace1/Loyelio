export const FREE_PLAN_LIMITS = {
  documents: 10,
  properties: 1,
  tenants: 3
} as const;

export type BillableResource = keyof typeof FREE_PLAN_LIMITS;

export type BillingStatus = {
  current_period_end: string | null;
  lifetime_access: boolean;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export function hasPaidAccess(billing: BillingStatus | null | undefined) {
  if (!billing) {
    return false;
  }

  if (billing.lifetime_access) {
    return true;
  }

  return ['active', 'trialing'].includes(billing.status);
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}
