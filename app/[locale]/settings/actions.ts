'use server';

import {redirect} from 'next/navigation';

import {getAppUrl} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {getStripe, getStripePriceId} from '@/lib/billing/stripe';
import {localizedPath} from '@/lib/navigation';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getCurrentUserWorkspace} from '@/lib/workspace';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

async function ensureStripeCustomer(locale: string) {
  const {profile, supabase, user, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (billing?.stripe_customer_id) {
    return {
      customerId: billing.stripe_customer_id,
      user,
      workspaceId
    };
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email ?? profile.email ?? undefined,
    metadata: {
      user_id: user.id,
      workspace_id: workspaceId
    }
  });

  const admin = createSupabaseAdminClient();
  await admin.from('workspace_billing').upsert(
    {
      stripe_customer_id: customer.id,
      workspace_id: workspaceId
    },
    {onConflict: 'workspace_id'}
  );

  return {
    customerId: customer.id,
    user,
    workspaceId
  };
}

export async function createCheckoutSessionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const plan = value(formData, 'plan') === 'lifetime' ? 'lifetime' : 'monthly';
  const priceId = getStripePriceId(plan);

  if (!priceId) {
    redirect(`${localizedPath(locale, '/settings')}?error=stripe_price_missing`);
  }

  const {customerId, user, workspaceId} = await ensureStripeCustomer(locale);
  const stripe = getStripe();
  const appUrl = getAppUrl();
  const settingsUrl = `${appUrl}${localizedPath(locale, '/settings')}`;
  const session = await stripe.checkout.sessions.create({
    cancel_url: `${settingsUrl}?checkout=cancelled`,
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    metadata: {
      plan,
      user_id: user.id,
      workspace_id: workspaceId
    },
    mode: plan === 'lifetime' ? 'payment' : 'subscription',
    subscription_data:
      plan === 'monthly'
        ? {
            metadata: {
              plan,
              workspace_id: workspaceId
            }
          }
        : undefined,
    success_url: `${settingsUrl}?checkout=success`
  });

  if (!session.url) {
    redirect(`${localizedPath(locale, '/settings')}?error=checkout_failed`);
  }

  redirect(session.url);
}

export async function createBillingPortalSessionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (!billing?.stripe_customer_id) {
    redirect(`${localizedPath(locale, '/settings')}?error=billing_customer_missing`);
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripe_customer_id,
    return_url: `${getAppUrl()}${localizedPath(locale, '/settings')}`
  });

  redirect(session.url);
}
