'use client';

import {useEffect, useState} from 'react';

type FolderItem = {
  countLabel: string;
  iconClassName: string;
  label: string;
  value: string;
};

function FolderIcon() {
  return (
    <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 24 24">
      <path d="M3.75 6.75h6l1.5 2h9v8.5a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2V6.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M4 10h16.25l-1.4 6.45a2 2 0 0 1-1.95 1.58H4.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function syncRows(type: string) {
  const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('[data-document-row]'));
  let visibleCount = 0;

  for (const row of rows) {
    const visible = !type || row.dataset.documentType === type;
    row.hidden = !visible;
    if (visible) {
      visibleCount += 1;
    }
  }

  for (const emptyRow of document.querySelectorAll<HTMLTableRowElement>('[data-document-empty]')) {
    emptyRow.hidden = visibleCount > 0;
  }

  const typeSelect = document.querySelector<HTMLSelectElement>('[data-document-type-select]');
  if (typeSelect) {
    typeSelect.value = type;
  }
}

export function DocumentTypeFilter({folders, initialType}: {folders: FolderItem[]; initialType: string}) {
  const [type, setType] = useState(initialType);

  useEffect(() => {
    syncRows(type);
  }, [type]);

  useEffect(() => {
    function handlePopState() {
      const nextType = new URL(window.location.href).searchParams.get('type') ?? '';
      setType(folders.some((folder) => folder.value === nextType) ? nextType : '');
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [folders]);

  function changeType(nextType: string) {
    if (nextType === type) {
      return;
    }

    const query = new URLSearchParams(window.location.search);
    query.set('type', nextType);
    window.history.pushState(null, '', `${window.location.pathname}?${query.toString()}`);
    setType(nextType);
  }

  return (
    <section className="mb-10 grid grid-cols-2 gap-5 md:grid-cols-4">
      {folders.map((folder) => (
        <button
          aria-current={type === folder.value ? 'page' : undefined}
          className={[
            'focus-ring rounded-xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f8fbfa]',
            type === folder.value ? 'border-[var(--accent)]' : 'border-[var(--line-soft)]'
          ].join(' ')}
          key={folder.value}
          onClick={() => changeType(folder.value)}
          type="button"
        >
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${folder.iconClassName}`}>
            <FolderIcon />
          </div>
          <h2 className="text-base font-semibold text-[#171d1c]">{folder.label}</h2>
          <p className="mt-1 text-xs font-medium text-[var(--muted)]">{folder.countLabel}</p>
        </button>
      ))}
    </section>
  );
}
