import {Link} from '@/components/app/localized-link';
import {getLocale, getTranslations} from 'next-intl/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createPrioritySupportTicketAction} from './actions';

export default async function SupportPage({searchParams}: {searchParams: Promise<{error?: string; success?: string}>}) {
  const locale = await getLocale();
  const t = await getTranslations('prioritySupport');
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const plan = hasPaidAccess(billing) ? normalizeBillingPlan(billing?.plan) : 'free';
  const hasAccess = plan === 'plus' || plan === 'portfolio';

  if (!hasAccess) {
    return (
      <section className="rounded-xl border border-[var(--line-soft)] bg-white p-8 shadow-sm">
        <span className="inline-flex rounded-md bg-[#e4f7ed] px-3 py-1 text-xs font-semibold text-[var(--accent)]">Plus / Portfolio</span>
        <h1 className="mt-4 text-3xl font-semibold text-[#171d1c]">{t('lockedTitle')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t('lockedCopy')}</p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white"
          href={localizedPath(locale, '/settings?tab=abonnement')}
          style={{color: '#ffffff'}}
        >
          {t('upgrade')}
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="inline-flex rounded-md bg-[#e4f7ed] px-3 py-1 text-xs font-semibold text-[var(--accent)]">{plan === 'portfolio' ? 'Portfolio' : 'Plus'}</span>
          <h1 className="mt-3 text-3xl font-semibold text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        <div className="rounded-lg border border-[#b8e5cf] bg-[#edf8f1] px-4 py-3 text-sm font-semibold text-[#087a55]">
          {plan === 'portfolio' ? t('slaPortfolio') : t('slaPlus')}
        </div>
      </div>

      {params.success ? <Banner tone="success" text={t(`success.${params.success}`)} /> : null}
      {params.error ? <Banner tone="error" text={t(`errors.${params.error}`)} /> : null}

      <div className="mt-8 w-full">
        <form action={createPrioritySupportTicketAction} className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
          <input name="locale" type="hidden" value={locale} />
          <h2 className="text-lg font-semibold">{t('newTicket')}</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              {t('category')}
              <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue="technical" name="category">
                {['technical', 'billing', 'documents', 'tax', 'other'].map((category) => (
                  <option key={category} value={category}>
                    {t(`categories.${category}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              {t('subject')}
              <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" maxLength={140} name="subject" required />
            </label>
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              {t('message')}
              <textarea className="focus-ring min-h-40 rounded-md border border-[var(--line)] px-3 py-3 text-sm font-normal" maxLength={5000} name="message" required />
            </label>
          </div>
          <button className="mt-5 min-h-11 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">
            {t('submit')}
          </button>
        </form>
      </div>
    </>
  );
}

function Banner({text, tone}: {text: string; tone: 'error' | 'success'}) {
  return <div className={`mt-6 rounded-lg border p-4 text-sm ${tone === 'success' ? 'border-[#b8e5cf] bg-[#edf8f1] text-[#087a55]' : 'border-[#f0d6b6] bg-[#fff8ec] text-[#7a4a11]'}`}>{text}</div>;
}
