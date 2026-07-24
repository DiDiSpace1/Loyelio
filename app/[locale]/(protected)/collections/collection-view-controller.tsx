'use client';

import {useEffect, useState} from 'react';

type CollectionView = 'all' | 'open' | 'paid' | 'partial' | 'unpaid';

type ViewItem = {
  count: number;
  key: CollectionView;
  label: string;
};

function matchesView(view: CollectionView, status: string) {
  if (view === 'all') {
    return true;
  }

  if (view === 'open') {
    return status !== 'paid';
  }

  return status === view;
}

function syncPage(locale: string, month: string, view: CollectionView) {
  const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('[data-collection-row]'));
  let visibleCount = 0;

  for (const row of rows) {
    const visible = matchesView(view, row.dataset.collectionStatus ?? 'unpaid');
    row.hidden = !visible;

    const checkbox = row.querySelector<HTMLInputElement>('input[name="lease_ids"]');
    if (!visible && checkbox) {
      checkbox.checked = false;
    }

    if (visible) {
      visibleCount += 1;
    }
  }

  for (const emptyRow of document.querySelectorAll<HTMLTableRowElement>('[data-collection-empty]')) {
    emptyRow.hidden = visibleCount > 0;
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('[data-collection-view-input]')) {
    input.value = view;
  }

  const query = new URLSearchParams({locale, month, view});
  const exportLink = document.querySelector<HTMLAnchorElement>('[data-collection-export]');
  const reportLink = document.querySelector<HTMLAnchorElement>('[data-collection-report]');

  if (exportLink) {
    exportLink.href = `/api/collections/export?${query.toString()}`;
  }

  if (reportLink) {
    reportLink.href = `/api/collections/report?${query.toString()}`;
  }

  window.dispatchEvent(new CustomEvent('collection-selection-change', {detail: {formId: 'portfolio-collections-form'}}));
}

export function CollectionViewController({
  ariaLabel,
  initialView,
  locale,
  month,
  views
}: {
  ariaLabel: string;
  initialView: CollectionView;
  locale: string;
  month: string;
  views: ViewItem[];
}) {
  const [view, setView] = useState(initialView);

  useEffect(() => {
    syncPage(locale, month, view);
  }, [locale, month, view]);

  useEffect(() => {
    function handlePopState() {
      const nextView = new URL(window.location.href).searchParams.get('view');
      if (nextView === 'all' || nextView === 'open' || nextView === 'paid' || nextView === 'partial' || nextView === 'unpaid') {
        setView(nextView);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function changeView(nextView: CollectionView) {
    if (nextView === view) {
      return;
    }

    const query = new URLSearchParams(window.location.search);
    query.set('month', month);
    query.set('view', nextView);
    window.history.pushState(null, '', `${window.location.pathname}?${query.toString()}`);
    setView(nextView);
  }

  return (
    <nav aria-label={ariaLabel} className="mt-6 flex flex-wrap gap-2">
      {views.map((item) => {
        const active = view === item.key;

        return (
          <button
            aria-current={active ? 'page' : undefined}
            className={`focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold ${
              active ? 'border-[var(--accent)] bg-[#e8f5f1] text-[var(--accent)]' : 'border-[var(--line)] bg-white text-[#34413e] hover:bg-[#f5faf8]'
            }`}
            key={item.key}
            onClick={() => changeView(item.key)}
            type="button"
          >
            {item.label}
            <span className={`tabular-nums ${active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>{item.count}</span>
          </button>
        );
      })}
    </nav>
  );
}
