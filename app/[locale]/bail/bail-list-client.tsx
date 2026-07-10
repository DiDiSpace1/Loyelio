'use client';

import Link from 'next/link';
import {useMemo, useState} from 'react';

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

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00Z`));
}

function formatMoney(value: number) {
  return `${Number(value ?? 0).toLocaleString('fr-FR', {maximumFractionDigits: 0})}€`;
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

function statusBadge(status: string) {
  if (status === 'active') {
    return {
      className: 'bg-[#ecfdf5] text-[#047857]',
      label: 'Actif'
    };
  }

  if (status === 'ended') {
    return {
      className: 'bg-[#eef2ff] text-[#3755c3]',
      label: 'Termine'
    };
  }

  return {
    className: 'bg-[#fff4db] text-[#9a5a00]',
    label: 'Clauses a definir'
  };
}

export function BailListClient({initialQuery, locale, leases}: {initialQuery: string; locale: string; leases: BailListRow[]}) {
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const filteredLeases = useMemo(() => leases.filter((lease) => leaseMatches(lease, appliedQuery)), [appliedQuery, leases]);

  function syncUrl(nextQuery: string) {
    const params = new URLSearchParams();

    if (nextQuery) {
      params.set('q', nextQuery);
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
    syncUrl('');
  }

  return (
    <>
      <section className="mt-8 rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm">
        <form
          className="relative w-full md:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
        >
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">Q</span>
          <input className="focus-ring min-h-11 w-full rounded-full border border-transparent bg-[#eef2f7] px-11 pr-11 text-sm" onChange={(event) => setQueryInput(event.target.value)} placeholder="Rechercher..." value={queryInput} />
          {queryInput ? (
            <button aria-label="Effacer la recherche" className="focus-ring absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#33413f] hover:bg-[#dce3eb]" onClick={clearSearch} type="button">
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          ) : null}
        </form>
      </section>

      <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filteredLeases.length ? (
          filteredLeases.map((lease) => {
            const badge = statusBadge(lease.status);

            return (
              <Link className="block rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" href={`/bail/${lease.id}`} key={lease.id}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate text-xl font-semibold text-[#17211f]">{lease.properties?.name ?? 'Bail sans bien'}</h2>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[#53615f]">
                  <p className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-[#c7d2ce] text-[10px] font-bold">P</span>
                    <span className="truncate">{lease.tenants?.full_name ?? 'Locataire a definir'}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-[#c7d2ce] text-[10px] font-bold">B</span>
                    <span className="truncate">{formatPropertyAddress(lease.properties)}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-[#c7d2ce] text-[10px] font-bold">D</span>
                    <span>
                      Du {formatDate(lease.start_date)} au {formatDate(lease.end_date)}
                    </span>
                  </p>
                </div>
                <dl className="mt-5 grid gap-2 border-t border-[var(--line-soft)] pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">Loyer</dt>
                    <dd className="font-semibold text-[#00796b] tabular-nums">{formatMoney(lease.monthly_rent)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">Provision sur charges</dt>
                    <dd className="font-semibold text-[#00796b] tabular-nums">{formatMoney(lease.charges_amount)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">Frequence</dt>
                    <dd className="font-medium">mensuelle</dd>
                  </div>
                </dl>
              </Link>
            );
          })
        ) : (
          <div className="rounded-xl border border-[var(--line-soft)] bg-white p-6 text-sm text-[var(--muted)] sm:col-span-2 xl:col-span-3">Aucun bail trouve.</div>
        )}
      </section>
    </>
  );
}
