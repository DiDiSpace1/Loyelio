import Stripe from 'stripe';

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Missing Stripe secret key.');
  }

  return new Stripe(secretKey);
}

export function getStripePriceId(plan: string) {
  if (plan === 'lifetime') {
    return process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_LIFETIME;
  }

  return process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY;
}
