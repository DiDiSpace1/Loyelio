'use client';

import {Link} from '@/components/app/localized-link';
import {useTranslations} from 'next-intl';
import {useMemo, useState} from 'react';

type LeaseFilter = 'active' | 'all' | 'inactive';

export type BailListRow = {
  charges_amount: number;
  end_date: string | null;
  id: string;
  monthly_rent: number;
  start_date: string;
  status: string;
  properties: {
    address_line1: string | null;
    city: string | null;
    id: string;
    name: string;
    postal_code: string | null;
  } | null;
  tenants: {
    full_name: string;
  } | null;
};

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(locale).format(new Date(`${value}T00:00:00Z`));
}

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: 'EUR',
    maximumFractionDigits: 0,
    style: 'currency'
  }).format(Number(value ?? 0));
}

function formatPropertyAddress(property: BailListRow['properties']) {
  if (!property) {
    return '-';
  }

  return [property.address_line1, property.city].filter(Boolean).join(' - ') || property.name;
}

function leaseMatches(lease: BailListRow, query: string) {
  if (!query) {
    return true;
  }

  const searchable = [lease.properties?.name, lease.properties?.address_line1, lease.properties?.city, lease.properties?.postal_code, lease.tenants?.full_name].filter(Boolean).join(' ').toLowerCase();
  return searchable.includes(query.toLowerCase());
}

function sanitizeFilter(value: string): LeaseFilter {
  return value === 'active' || value === 'inactive' ? value : 'all';
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function leaseIsExpired(lease: BailListRow, today: string) {
  return Boolean(lease.end_date && lease.end_date < today);
}

function leaseIsActive(lease: BailListRow, today: string) {
  return lease.status === 'active' && !leaseIsExpired(lease, today);
}

function statusBadges(lease: BailListRow, today: string) {
  if (leaseIsExpired(lease, today)) {
    return [{
      className: 'bg-[#edf1ef] text-[#66736f]',
      labelKey: 'expired'
    }];
  }

  if (lease.status === 'active') {
    const badges = [{
      className: 'bg-[#ecfdf5] text-[#047857]',
      labelKey: 'active'
    }];

    if (lease.end_date && lease.end_date <= addDays(today, 60)) {
      badges.push({
        className: 'bg-[#fff4df] text-[#9a5b00]',
        labelKey: 'expiringSoon'
      });
    }

    return badges;
  }

  if (lease.status === 'ended') {
    return [{
      className: 'bg-[#edf1ef] text-[#66736f]',
      labelKey: 'ended'
    }];
  }

  return [{
    className: 'bg-[#fff4db] text-[#9a5a00]',
    labelKey: 'draft'
  }];
}

export function BailListClient({initialFilter, initialQuery, locale, leases, today}: {initialFilter: string; initialQuery: string; locale: string; leases: BailListRow[]; today: string}) {
  const t = useTranslations('bail');
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [selectedFilter, setSelectedFilter] = useState<LeaseFilter>(sanitizeFilter(initialFilter));
  const filteredLeases = useMemo(
    () =>
      leases.filter((lease) => {
        const matchesFilter = selectedFilter === 'all' || (selectedFilter === 'active' ? leaseIsActive(lease, today) : !leaseIsActive(lease, today));
        return matchesFilter && leaseMatches(lease, appliedQuery);
      }),
    [appliedQuery, leases, selectedFilter, today]
  );

  function syncUrl(nextQuery: string, nextFilter = selectedFilter) {
    const params = new URLSearchParams();

    if (nextQuery) {
      params.set('q', nextQuery);
    }

    if (nextFilter !== 'all') {
      params.set('status', nextFilter);
    }

    const query = params.toString();
    window.history.replaceState(null, '', `/${locale}/bail${query ? `?${query}` : ''}`);
  }

  function applySearch() {
    const nextQuery = queryInput.trim();
    setAppliedQuery(nextQuery);
    syncUrl(nextQuery);
  }

  function clearSearch() {
    setQueryInput('');
    setAppliedQuery('');
    syncUrl('', selectedFilter);
  }

  function changeFilter(nextFilter: LeaseFilter) {
    setSelectedFilter(nextFilter);
    syncUrl(appliedQuery, nextFilter);
  }

  return (
    <>
      <section className="mt-8 rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
        >
          <div className="relative w-full sm:max-w-md">
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[var(--muted)]">search</span>
            <input className="focus-ring min-h-11 w-full rounded-full border border-transparent bg-[#eef2f7] px-11 pr-11 text-sm" onChange={(event) => setQueryInput(event.target.value)} placeholder={t('searchPlaceholder')} value={queryInput} />
            {queryInput ? (
              <button aria-label={t('clearSearch')} className="focus-ring absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#33413f] hover:bg-[#dce3eb]" onClick={clearSearch} type="button">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            ) : null}
          </div>
          <label className="grid gap-1 sm:min-w-44">
            <span className="sr-only">{t('filter.label')}</span>
            <select className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-medium" onChange={(event) => changeFilter(event.target.value as LeaseFilter)} value={selectedFilter}>
              <option value="all">{t('filter.all')}</option>
              <option value="active">{t('filter.active')}</option>
              <option value="inactive">{t('filter.inactive')}</option>
            </select>
          </label>
        </form>
      </section>

      <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filteredLeases.length ? (
          filteredLeases.map((lease) => {
            const badges = statusBadges(lease, today);

            return (
              <Link className="block rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" href={`/bail/${lease.id}`} key={lease.id}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate text-xl font-semibold text-[#17211f]">{lease.properties?.name ?? t('withoutProperty')}</h2>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {badges.map((badge) => <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`} key={badge.labelKey}>{t(`status.${badge.labelKey}`)}</span>)}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[#53615f]">
                  <p className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-[#c7d2ce] text-[10px] font-bold">P</span>
                    <span className="truncate">{lease.tenants?.full_name ?? t('tenantPending')}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-[#c7d2ce] text-[10px] font-bold">B</span>
                    <span className="truncate">{formatPropertyAddress(lease.properties)}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-[#c7d2ce] text-[10px] font-bold">D</span>
                    <span>{t('fromTo', {end: formatDate(lease.end_date, locale), start: formatDate(lease.start_date, locale)})}</span>
                  </p>
                </div>
                <dl className="mt-5 grid gap-2 border-t border-[var(--line-soft)] pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">{t('rent')}</dt>
                    <dd className="font-semibold text-[#00796b] tabular-nums">{formatMoney(lease.monthly_rent, locale)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">{t('chargesProvision')}</dt>
                    <dd className="font-semibold text-[#00796b] tabular-nums">{formatMoney(lease.charges_amount, locale)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">{t('frequency')}</dt>
                    <dd className="font-medium">{t('monthly')}</dd>
                  </div>
                </dl>
              </Link>
            );
          })
        ) : (
          <div className="rounded-xl border border-[var(--line-soft)] bg-white p-6 text-sm text-[var(--muted)] sm:col-span-2 xl:col-span-3">{t('empty')}</div>
        )}
      </section>
    </>
  );
}
