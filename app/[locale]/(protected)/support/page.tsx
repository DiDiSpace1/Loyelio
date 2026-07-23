import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createPrioritySupportTicketAction} from './actions';

type SupportTicket = {
  category: string;
  created_at: string;
  id: string;
  notification_status: string;
  status: string;
  subject: string;
};

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
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" href={localizedPath(locale, '/settings?tab=abonnement')} style={{color: '#ffffff'}}>
          {t('upgrade')}
        </Link>
      </section>
    );
  }

  const {data: tickets} = await supabase
    .from('support_tickets')
    .select('id, category, subject, status, notification_status, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false})
    .limit(10)
    .returns<SupportTicket[]>();

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

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <form action={createPrioritySupportTicketAction} className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
          <input name="locale" type="hidden" value={locale} />
          <h2 className="text-lg font-semibold">{t('newTicket')}</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              {t('category')}
              <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="category" defaultValue="technical">
                {['technical', 'billing', 'documents', 'tax', 'other'].map((category) => <option key={category} value={category}>{t(`categories.${category}`)}</option>)}
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
          <button className="mt-5 min-h-11 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">{t('submit')}</button>
        </form>

        <section className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t('history')}</h2>
          <div className="mt-5 grid gap-3">
            {(tickets ?? []).length ? (tickets ?? []).map((ticket) => (
              <article className="rounded-lg border border-[var(--line-soft)] p-4" key={ticket.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-[#171d1c]">{ticket.subject}</p>
                  <span className="shrink-0 rounded-md bg-[#eef7f4] px-2 py-1 text-xs font-semibold text-[var(--accent)]">{t(`status.${ticket.status}`)}</span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">{t(`categories.${ticket.category}`)} · {new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(new Date(ticket.created_at))}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">#{ticket.id.slice(0, 8)} · {t(`notification.${ticket.notification_status}`)}</p>
              </article>
            )) : <p className="rounded-lg bg-[#f8fbfa] p-4 text-sm text-[var(--muted)]">{t('empty')}</p>}
          </div>
        </section>
      </div>
    </>
  );
}

function Banner({text, tone}: {text: string; tone: 'error' | 'success'}) {
  return <div className={`mt-6 rounded-lg border p-4 text-sm ${tone === 'success' ? 'border-[#b8e5cf] bg-[#edf8f1] text-[#087a55]' : 'border-[#f0d6b6] bg-[#fff8ec] text-[#7a4a11]'}`}>{text}</div>;
}
