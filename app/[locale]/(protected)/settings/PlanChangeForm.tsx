'use client';

import {useRef, useState, useTransition} from 'react';

import {useBillingCycle} from './BillingCycleControl';

type PlanChangeFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  className: string;
  currentPeriodEnd: string | null;
  description: string;
  labels: {
    cancel: string;
    confirm: string;
    startsOn: string;
    title: string;
    unknownDate: string;
    yearlyPriceSuffix: string;
  };
  locale: string;
  monthlyPrice: string;
  monthlyPriceSuffix: string;
  requiresConfirmation: boolean;
  targetPlanLabel: string;
  yearlyPrice: string;
};

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {dateStyle: 'long'}).format(date);
}

export function PlanChangeForm({
  action,
  children,
  className,
  currentPeriodEnd,
  description,
  labels,
  locale,
  monthlyPrice,
  monthlyPriceSuffix,
  requiresConfirmation,
  targetPlanLabel,
  yearlyPrice
}: PlanChangeFormProps) {
  const {cycle: selectedInterval} = useBillingCycle();
  const confirmedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isPending || isSubmitting;
  const switchDate = formatDate(currentPeriodEnd, locale);
  const selectedPrice = selectedInterval === 'monthly' ? monthlyPrice : yearlyPrice;
  const priceSuffix = selectedInterval === 'monthly' ? monthlyPriceSuffix : labels.yearlyPriceSuffix;

  return (
    <>
      <form
        action={action}
        className={className}
        onSubmit={(event) => {
          if (!requiresConfirmation || confirmedRef.current) {
            return;
          }

          event.preventDefault();
          setIsOpen(true);
        }}
        ref={formRef}
      >
        <input name="billing_interval" type="hidden" value={selectedInterval} />
        {children}
      </form>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-[#17201e] shadow-2xl">
            <h2 className="text-xl font-semibold">{labels.title}</h2>
            <p className="mt-5 text-base leading-7 text-[#5f6b68]">{description}</p>

            <div className="mt-6 rounded-xl border border-[var(--line-soft)] bg-[#fafcfa] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{targetPlanLabel}</h3>
                  <p className="mt-2 text-sm text-[#5f6b68]">
                    {labels.startsOn}: {switchDate ?? labels.unknownDate}
                  </p>
                </div>
                <p className="shrink-0 text-base text-[#5f6b68]">
                  {selectedPrice}
                  {priceSuffix}
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button className="min-h-10 rounded-full border border-[var(--line)] px-5 text-sm font-medium hover:bg-[#f0f5f2] disabled:cursor-not-allowed disabled:opacity-50" disabled={isBusy} onClick={() => setIsOpen(false)} type="button">
                {labels.cancel}
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#111] px-5 text-sm font-semibold text-white disabled:opacity-70"
                disabled={isBusy}
                onClick={() => {
                  confirmedRef.current = true;
                  setIsSubmitting(true);
                  startTransition(() => {
                    formRef.current?.requestSubmit();
                  });
                }}
                type="button"
              >
                {labels.confirm}
                {isBusy ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" /> : null}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
