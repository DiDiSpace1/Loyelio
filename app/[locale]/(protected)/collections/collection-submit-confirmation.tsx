'use client';

import {useCallback, useEffect, useState} from 'react';

import {LoadingSpinner} from '@/components/app/pending-submit-button';

type ConfirmLabels = {
  apply: string;
  cancel: string;
  confirm: string;
  copy: string;
  noSelection: string;
  paymentDate: string;
  receiptWarning: string;
  selectedCount: string;
  targetStatus: string;
  title: string;
};

type CollectionCheckbox = HTMLInputElement & {
  dataset: {
    collectionStatus?: string;
  };
};

function formElement(formId: string) {
  return document.getElementById(formId) as HTMLFormElement | null;
}

function selectedCount(formId: string) {
  const form = formElement(formId);

  if (!form) {
    return 0;
  }

  return Array.from(form.querySelectorAll<CollectionCheckbox>('input[data-collection-status][name="lease_ids"]')).filter(
    (checkbox) => checkbox.checked && !checkbox.closest('tr')?.hidden
  ).length;
}

function formValue(formId: string, name: string) {
  const form = formElement(formId);
  const field = form?.elements.namedItem(name);

  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    return field.value;
  }

  return '';
}

function selectedOptionLabel(formId: string, name: string) {
  const form = formElement(formId);
  const field = form?.elements.namedItem(name);

  if (field instanceof HTMLSelectElement) {
    return field.selectedOptions[0]?.textContent?.trim() ?? field.value;
  }

  return '';
}

export function CollectionSubmitConfirmation({formId, initialSelected, labels}: {formId: string; initialSelected: number; labels: ConfirmLabels}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(initialSelected);
  const [statusValue, setStatusValue] = useState('');
  const [statusLabel, setStatusLabel] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = useCallback(() => {
    setSelected(selectedCount(formId));
    setStatusValue(formValue(formId, 'status'));
    setStatusLabel(selectedOptionLabel(formId, 'status'));
    setPaymentDate(formValue(formId, 'paid_at'));
  }, [formId]);

  useEffect(() => {
    const form = formElement(formId);

    if (!form) {
      return;
    }

    form.addEventListener('change', refresh);
    window.addEventListener('collection-selection-change', refresh);
    return () => {
      form.removeEventListener('change', refresh);
      window.removeEventListener('collection-selection-change', refresh);
    };
  }, [formId, refresh]);

  function openConfirm() {
    refresh();
    setIsSubmitting(false);
    setOpen(true);
  }

  function submit() {
    const form = formElement(formId);

    if (!form) {
      return;
    }

    setIsSubmitting(true);
    form.requestSubmit();
  }

  return (
    <>
      <button className="focus-ring min-h-11 self-end rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55" disabled={selected === 0} onClick={openConfirm} style={{color: '#ffffff'}} type="button">
        {labels.apply}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div>
              <h3 className="text-xl font-semibold text-[#171d1c]">{labels.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{selected > 0 ? labels.copy : labels.noSelection}</p>
            </div>

            <div className="mt-5 grid gap-3 rounded-lg border border-[var(--line-soft)] bg-[#f8fbfa] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[var(--muted)]">{labels.selectedCount}</span>
                <span className="font-semibold tabular-nums text-[#171d1c]">{selected}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[var(--muted)]">{labels.targetStatus}</span>
                <span className="font-semibold text-[#171d1c]">{statusLabel}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[var(--muted)]">{labels.paymentDate}</span>
                <span className="font-semibold tabular-nums text-[#171d1c]">{paymentDate || '-'}</span>
              </div>
            </div>

            {statusValue === 'paid' ? <p className="mt-4 rounded-lg border border-[#b8e5cf] bg-[#edf8f1] p-3 text-sm leading-6 text-[#087a55]">{labels.receiptWarning}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button className="focus-ring min-h-10 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f5faf8] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} onClick={() => setOpen(false)} type="button">
                {labels.cancel}
              </button>
              <button aria-busy={isSubmitting} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70" disabled={selected === 0 || isSubmitting} onClick={submit} style={{color: '#ffffff'}} type="button">
                {isSubmitting ? <LoadingSpinner /> : null}
                {labels.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
