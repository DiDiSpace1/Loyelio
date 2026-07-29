'use client';

import {useState} from 'react';
import {useFormStatus} from 'react-dom';

import type {BillingPlanKey} from '@/lib/billing/config';

type DebugPlanSwitcherProps = {
  action: (formData: FormData) => void | Promise<void>;
  currentPlan: BillingPlanKey;
  labels: {
    cancel: string;
    current: string;
    description: string;
    submit: string;
    title: string;
    trigger: string;
  };
  locale: string;
};

const plans: BillingPlanKey[] = ['free', 'solo', 'plus', 'portfolio'];

function SubmitButton({label}: {label: string}) {
  const {pending} = useFormStatus();

  return (
    <button
      className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
      {label}
    </button>
  );
}

export function DebugPlanSwitcher({action, currentPlan, labels, locale}: DebugPlanSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanKey>(currentPlan);

  return (
    <>
      <button
        className="focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--accent)] shadow-sm hover:bg-[#f0f5f2]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[19px]">tune</span>
        {labels.trigger}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <form action={action} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <input name="locale" type="hidden" value={locale} />
            <input name="plan" type="hidden" value={selectedPlan} />

            <h2 className="text-xl font-semibold text-[#171d1c]">{labels.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{labels.description}</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {plans.map((plan) => {
                const selected = selectedPlan === plan;

                return (
                  <button
                    aria-pressed={selected}
                    className={[
                      'focus-ring flex min-h-12 items-center justify-between rounded-lg border px-4 text-left text-sm font-semibold capitalize',
                      selected ? 'border-[var(--accent)] bg-[#eaf6f2] text-[var(--accent)]' : 'border-[var(--line)] bg-white text-[#33413f] hover:bg-[#f6f9f7]'
                    ].join(' ')}
                    key={plan}
                    onClick={() => setSelectedPlan(plan)}
                    type="button"
                  >
                    {plan}
                    {plan === currentPlan ? <span className="text-xs font-medium normal-case text-[var(--muted)]">{labels.current}</span> : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <button
                className="focus-ring min-h-10 rounded-lg border border-[var(--line)] px-5 text-sm font-semibold hover:bg-[#f0f5f2]"
                onClick={() => setOpen(false)}
                type="button"
              >
                {labels.cancel}
              </button>
              <SubmitButton label={labels.submit} />
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
