import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {canUseRentReminders, getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createTenantAction} from './actions';
import {TenantTableClient} from './tenant-table-client';

type TenantRow = {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  phone: string | null;
  notes: string | null;
  leases: {
    id: string;
    status: string;
    start_date: string;
    end_date: string | null;
    charges_amount: number;
    monthly_rent: number;
    properties: {name: string} | null;
    units: {name: string} | null;
    rent_charges: {status: string; period_month: string}[];
    rent_reminder_day: number | null;
    rent_reminder_days_before: number;
    rent_reminder_enabled: boolean;
  }[];
};

type TenantsPageProps = {
  searchParams: Promise<{
    error?: string;
    month?: string;
    new?: string;
    q?: string;
    success?: string;
    view?: string;
  }>;
};

const MONTH_PARAM_PATTERN = /^\d{4}-\d{2}$/;
const TENANT_VIEWS = new Set(['all', 'active', 'unassigned', 'expiring', 'overdue']);
const errorMessageKeys = new Set(['plan_limit', 'batch_invalid', 'batch_portfolio_required', 'batch_update_failed']);
const successMessageKeys = new Set(['rent_status_updated_receipt_created', 'rent_status_updated_receipt_exists', 'rent_status_updated_receipt_failed', 'tenant_batch_activated', 'tenant_batch_deactivated']);

function isoMonth(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseMonthParam(month?: string) {
  if (month && MONTH_PARAM_PATTERN.test(month)) {
    return month;
  }

  return isoMonth(new Date());
}

export default async function TenantsPage({searchParams}: TenantsPageProps) {
  const t = await getTranslations('tenants');
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const queryText = (params.q ?? '').trim();
  const selectedMonth = parseMonthParam(params.month);
  const selectedView = TENANT_VIEWS.has(params.view ?? '') ? params.view ?? 'active' : 'active';
  const showCreate = params.new === '1';

  const query = supabase
    .from('tenants')
    .select(
      'id, full_name, email, is_active, phone, notes, leases(id, status, start_date, end_date, monthly_rent, charges_amount, rent_reminder_enabled, rent_reminder_day, rent_reminder_days_before, properties(name), units(name), rent_charges(status, period_month))'
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false});

  const {data: tenants, error} = await query.returns<TenantRow[]>();
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const hasReminderAccess = canUseRentReminders(billing);
  const hasPortfolioAccess = hasPaidAccess(billing) && normalizeBillingPlan(billing?.plan) === 'portfolio';
  const allRows = tenants ?? [];
  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        {showCreate ? (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] px-5 text-sm font-semibold text-[#171d1c]" href="/tenants">
            {t('backToList')}
          </Link>
        ) : (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" href="/tenants?new=1" style={{color: '#ffffff'}}>
            + {t('addTenant')}
          </Link>
        )}
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          {t('errors.loadFailed')}
        </div>
      ) : null}

      {params.error && errorMessageKeys.has(params.error) ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          {t(`errors.${params.error}`)}
        </div>
      ) : null}

      {params.success && successMessageKeys.has(params.success) ? (
        <div className="mt-6 rounded-lg border border-[#b8e5cf] bg-[#edf8f1] p-4 text-sm leading-6 text-[#087a55]">
          {t(`success.${params.success}`)}
        </div>
      ) : null}

      {showCreate ? (
        <CreateTenantView hasReminderAccess={hasReminderAccess} locale={locale} />
      ) : (
        <TenantTableClient hasPortfolioAccess={hasPortfolioAccess} hasReminderAccess={hasReminderAccess} initialMonth={selectedMonth} initialQuery={queryText} initialView={selectedView} locale={locale} tenants={allRows} />
      )}
    </>
  );
}

async function CreateTenantView({hasReminderAccess, locale}: {hasReminderAccess: boolean; locale: string}) {
  const common = await getTranslations('common');
  const t = await getTranslations('tenants.form');
  const reminders = await getTranslations('tenants.reminders');

  return (
    <form action={createTenantAction} className="mt-8 grid gap-5">
      <input name="locale" type="hidden" value={locale} />
      <SectionCard title={t('identityTitle')}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            {t('fullName')}
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="full_name" placeholder={t('fullNamePlaceholder')} required />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            {t('email')}
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="email" placeholder={t('emailPlaceholder')} type="email" />
          </label>
        </div>
      </SectionCard>
      <SectionCard title={t('contactTitle')}>
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          {t('phone')}
          <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="phone" placeholder="+33 ..." />
        </label>
      </SectionCard>
      <SectionCard title={t('notesTitle')}>
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          {t('notes')}
          <textarea className="focus-ring min-h-28 rounded-md border border-[var(--line)] px-3 py-3 text-sm font-normal" name="notes" placeholder={t('notesPlaceholder')} />
        </label>
      </SectionCard>
      <SectionCard title={reminders('editTitle')}>
        <div className="rounded-lg border border-[var(--line-soft)] bg-[#f8fbfa] p-4">
          <label className="flex items-center justify-between gap-4 text-sm font-semibold text-[#33413f]">
            <span className="flex items-center gap-2">
              {reminders('enableLabel')}
              {!hasReminderAccess ? <span className="rounded bg-[#e5e7eb] px-2 py-1 text-xs text-[#4b5563]">Plus</span> : null}
            </span>
            <input className="h-5 w-5" disabled type="checkbox" />
          </label>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              {reminders('dayLabel')}
              <select className="min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-normal disabled:cursor-not-allowed disabled:opacity-70" disabled>
                <option>{reminders('dayOption', {day: 1})}</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              {reminders('daysBeforeLabel')}
              <select className="min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-normal disabled:cursor-not-allowed disabled:opacity-70" disabled>
                <option>{reminders('daysBeforeOption', {days: 0})}</option>
              </select>
            </label>
          </div>
          <p className={`mt-4 rounded-md border p-3 text-sm leading-6 ${hasReminderAccess ? 'border-[#b8e5cf] bg-[#edf8f1] text-[#087a55]' : 'border-[#f0d6b6] bg-[#fff8ec] text-[#7a4a11]'}`}>
            {hasReminderAccess ? reminders('createNoLease') : reminders('upgradeCopy')}
          </p>
        </div>
      </SectionCard>
      <div className="flex justify-end gap-3">
        <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-5 text-sm font-semibold cursor-pointer" href="/tenants">
          {common('cancel')}
        </Link>
        <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white cursor-pointer" style={{color: '#ffffff'}} type="submit">
          {common('add')}
        </button>
      </div>
    </form>
  );
}

function SectionCard({children, title}: {children: React.ReactNode; title: string}) {
  return (
    <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-base font-semibold">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
