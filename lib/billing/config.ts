export const FREE_PLAN_LIMITS = {
  documents: 10,
  properties: 1,
  tenants: 3
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

export function getPropertyPhotoLimit(plan: string | null | undefined) {
  const normalizedPlan = (plan ?? 'free').toLowerCase();

  if (normalizedPlan in PROPERTY_PHOTO_LIMITS) {
    return PROPERTY_PHOTO_LIMITS[normalizedPlan as keyof typeof PROPERTY_PHOTO_LIMITS];
  }

  if (normalizedPlan === 'subscription') {
    return PROPERTY_PHOTO_LIMITS.solo;
  }

  if (normalizedPlan === 'lifetime') {
    return PROPERTY_PHOTO_LIMITS.portfolio;
  }

  return PROPERTY_PHOTO_LIMITS.free;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}
