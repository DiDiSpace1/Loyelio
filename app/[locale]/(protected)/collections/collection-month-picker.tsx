'use client';

import {useState} from 'react';

export function CollectionMonthPicker({
  action,
  initialMonth,
  initialView,
  label
}: {
  action: string;
  initialMonth: string;
  initialView: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <form action={action} aria-busy={loading} className="flex items-end" method="get" onSubmit={() => setLoading(true)}>
      <input data-collection-view-input name="view" type="hidden" value={initialView} />
      <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
        <span className="relative">
          <input
            className={`focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 pr-10 text-sm font-semibold text-[#171d1c] ${loading ? 'pointer-events-none opacity-75' : ''}`}
            defaultValue={initialMonth}
            name="month"
            onChange={(event) => {
              setLoading(true);
              event.currentTarget.form?.requestSubmit();
            }}
            type="month"
          />
          {loading ? (
            <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" />
          ) : null}
        </span>
      </label>
    </form>
  );
}
