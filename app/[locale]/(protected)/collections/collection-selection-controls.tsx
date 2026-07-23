'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';

type SelectionLabels = {
  clear: string;
  onlyOpen: string;
  selectAll: string;
  selected: string;
};

type CollectionCheckbox = HTMLInputElement & {
  dataset: {
    collectionStatus?: string;
  };
};

function checkboxes(formId: string) {
  const form = document.getElementById(formId);

  if (!form) {
    return [];
  }

  return Array.from(form.querySelectorAll<CollectionCheckbox>('input[data-collection-status][name="lease_ids"]'));
}

export function CollectionSelectionControls({formId, initialSelected, labels, total}: {formId: string; initialSelected: number; labels: SelectionLabels; total: number}) {
  const [selected, setSelected] = useState(initialSelected);
  const summary = useMemo(() => labels.selected.replace('{selected}', String(selected)).replace('{total}', String(total)), [labels.selected, selected, total]);

  const syncSelected = useCallback(() => {
    setSelected(checkboxes(formId).filter((checkbox) => checkbox.checked).length);
  }, [formId]);

  useEffect(() => {
    const form = document.getElementById(formId);

    if (!form) {
      return;
    }

    function handleChange(event: Event) {
      const target = event.target;

      if (target instanceof HTMLInputElement && target.name === 'lease_ids') {
        syncSelected();
      }
    }

    form.addEventListener('change', handleChange);
    return () => form.removeEventListener('change', handleChange);
  }, [formId, syncSelected]);

  function setAll(checked: boolean) {
    for (const checkbox of checkboxes(formId)) {
      checkbox.checked = checked;
    }

    syncSelected();
  }

  function selectOpen() {
    for (const checkbox of checkboxes(formId)) {
      checkbox.checked = checkbox.dataset.collectionStatus !== 'paid';
    }

    syncSelected();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-2 text-sm font-semibold text-[#33413f]">{summary}</span>
      <button className="focus-ring min-h-9 rounded-md border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[#253331] hover:bg-[#f5faf8]" onClick={() => setAll(true)} type="button">
        {labels.selectAll}
      </button>
      <button className="focus-ring min-h-9 rounded-md border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[#253331] hover:bg-[#f5faf8]" onClick={selectOpen} type="button">
        {labels.onlyOpen}
      </button>
      <button className="focus-ring min-h-9 rounded-md border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[#253331] hover:bg-[#f5faf8]" onClick={() => setAll(false)} type="button">
        {labels.clear}
      </button>
    </div>
  );
}
