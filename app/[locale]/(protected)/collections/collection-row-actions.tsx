'use client';

import {useFormStatus} from 'react-dom';
import {useState} from 'react';

import {sendCollectionReminderAction} from './actions';

type CollectionStatus = 'paid' | 'partial' | 'unpaid';

type RowActionLabels = {
  addEmail: string;
  cancel: string;
  confirm: string;
  copy: string;
  missingEmail: string;
  open: string;
  partialAmount: string;
  partialNote: string;
  reminderHint: string;
  receiptWarning: string;
  sendReminder: string;
  statuses: Record<CollectionStatus, string>;
  title: string;
};

export function CollectionRowActions({
  currentStatus,
  labels,
  leaseId,
  tenantEditHref,
  tenantHasEmail
}: {
  currentStatus: CollectionStatus;
  labels: RowActionLabels;
  leaseId: string;
  tenantEditHref: string;
  tenantHasEmail: boolean;
}) {
  const {pending} = useFormStatus();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CollectionStatus>(currentStatus === 'paid' ? 'unpaid' : 'paid');
  const [submitting, setSubmitting] = useState<'confirm' | 'reminder' | null>(null);

  return (
    <>
      <button
        aria-label={labels.open}
        className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--accent)] hover:bg-[#f5faf8]"
        onClick={() => setOpen(true)}
        title={labels.open}
        type="button"
      >
        <span className="material-symbols-outlined text-[20px]">edit</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-left shadow-xl">
            <div>
              <h3 className="text-xl font-semibold text-[#171d1c]">{labels.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{labels.copy}</p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {(['paid', 'partial', 'unpaid'] as const).map((value) => (
                <button
                  aria-pressed={status === value}
                  className={`focus-ring min-h-11 rounded-lg border px-3 text-sm font-semibold ${
                    status === value ? 'border-[var(--accent)] bg-[#e8f5f1] text-[var(--accent)]' : 'border-[var(--line)] bg-white text-[#34413e] hover:bg-[#f5faf8]'
                  }`}
                  disabled={pending}
                  key={value}
                  onClick={() => setStatus(value)}
                  type="button"
                >
                  {labels.statuses[value]}
                </button>
              ))}
            </div>

            {status === 'partial' ? (
              <div className="mt-4 grid gap-3 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-3">
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a4a11]">
                  {labels.partialAmount}
                  <input className="focus-ring min-h-11 rounded-lg border border-[#d6b98e] bg-white px-3 text-sm font-semibold tabular-nums text-[#171d1c]" min="0.01" name="single_amount" required step="0.01" type="number" />
                </label>
                <p className="text-sm leading-6 text-[#7a4a11]">{labels.partialNote}</p>
              </div>
            ) : null}
            {status === 'paid' ? <p className="mt-4 rounded-lg border border-[#b8e5cf] bg-[#edf8f1] p-3 text-sm leading-6 text-[#087a55]">{labels.receiptWarning}</p> : null}
            {status === 'unpaid' ? (
              <p className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${tenantHasEmail ? 'border-[#b8d9cf] bg-[#f1f8f5] text-[#245449]' : 'border-[#f0d6b6] bg-[#fff8ec] text-[#7a4a11]'}`}>
                {tenantHasEmail ? labels.reminderHint : labels.missingEmail}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button className="focus-ring min-h-10 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f5faf8] disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} onClick={() => setOpen(false)} type="button">
                {labels.cancel}
              </button>
              {status === 'unpaid' && tenantHasEmail ? (
                <button
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent)] disabled:cursor-wait disabled:opacity-70"
                  disabled={pending}
                  formAction={sendCollectionReminderAction}
                  name="reminder_lease_id"
                  onClick={() => setSubmitting('reminder')}
                  type="submit"
                  value={leaseId}
                >
                  <span className="material-symbols-outlined text-[19px]">outgoing_mail</span>
                  {labels.sendReminder}
                  {pending && submitting === 'reminder' ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)]/35 border-t-[var(--accent)]" /> : null}
                </button>
              ) : null}
              {status === 'unpaid' && !tenantHasEmail ? (
                <a className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[#f5faf8]" href={tenantEditHref}>
                  <span className="material-symbols-outlined text-[19px]">alternate_email</span>
                  {labels.addEmail}
                </a>
              ) : null}
              <button
                className="focus-ring inline-flex min-h-10 min-w-20 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-80"
                disabled={pending}
                name="single_action"
                onClick={() => setSubmitting('confirm')}
                style={{color: '#ffffff'}}
                type="submit"
                value={`${leaseId}:${status}`}
              >
                {labels.confirm}
                {pending && submitting === 'confirm' ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/45 border-t-white" /> : null}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
