export const FREE_PLAN_LIMITS = {
  documents: 10,
  properties: 1,
  tenants: 3
} as const;

export const BILLING_PLANS = ['free', 'solo', 'plus', 'portfolio'] as const;
export type BillingPlanKey = (typeof BILLING_PLANS)[number];

export const PLAN_LIMITS = {
  free: {
    documents: 10,
    maxDocumentSizeBytes: 5 * 1024 * 1024,
    properties: 1,
    storageBytes: 50 * 1024 * 1024,
    tenants: 3
  },
  solo: {
    documents: 150,
    maxDocumentSizeBytes: 10 * 1024 * 1024,
    properties: 5,
    storageBytes: 500 * 1024 * 1024,
    tenants: 20
  },
  plus: {
    documents: 400,
    maxDocumentSizeBytes: 15 * 1024 * 1024,
    properties: 10,
    storageBytes: 1536 * 1024 * 1024,
    tenants: 40
  },
  portfolio: {
    documents: 1000,
    maxDocumentSizeBytes: 15 * 1024 * 1024,
    properties: 20,
    storageBytes: 4 * 1024 * 1024 * 1024,
    tenants: 80
  }
} as const;

export const PROPERTY_PHOTO_LIMITS = {
  free: 0,
  solo: 5,
  plus: 10,
  portfolio: 20
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

export function normalizeBillingPlan(plan: string | null | undefined): BillingPlanKey {
  const normalizedPlan = (plan ?? 'free').toLowerCase();

  if (normalizedPlan === 'subscription') {
    return 'solo';
  }

  if (normalizedPlan === 'lifetime') {
    return 'portfolio';
  }

  return BILLING_PLANS.includes(normalizedPlan as BillingPlanKey) ? (normalizedPlan as BillingPlanKey) : 'free';
}

export function getPlanLimits(plan: string | null | undefined) {
  return PLAN_LIMITS[normalizeBillingPlan(plan)];
}

export function getPropertyPhotoLimit(plan: string | null | undefined) {
  return PROPERTY_PHOTO_LIMITS[normalizeBillingPlan(plan)];
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}
