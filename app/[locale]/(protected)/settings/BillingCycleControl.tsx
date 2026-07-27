'use client';

import {createContext, useContext, useMemo, useState} from 'react';

type BillingCycle = 'monthly' | 'yearly';

const BillingCycleContext = createContext<{
  cycle: BillingCycle;
  setCycle: (cycle: BillingCycle) => void;
} | null>(null);

export function BillingCycleProvider({children}: {children: React.ReactNode}) {
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const value = useMemo(() => ({cycle, setCycle}), [cycle]);

  return <BillingCycleContext.Provider value={value}>{children}</BillingCycleContext.Provider>;
}

export function useBillingCycle() {
  const context = useContext(BillingCycleContext);

  if (!context) {
    throw new Error('useBillingCycle must be used within BillingCycleProvider');
  }

  return context;
}

export function BillingCycleToggle({annualSaving, monthly, yearly}: {annualSaving: string; monthly: string; yearly: string}) {
  const {cycle, setCycle} = useBillingCycle();

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="inline-flex rounded-lg border border-[var(--line)] bg-white p-1 shadow-sm">
        <button
          aria-pressed={cycle === 'monthly'}
          className={`focus-ring min-h-10 rounded-md px-5 text-sm font-semibold transition ${cycle === 'monthly' ? 'bg-[var(--accent)] text-white' : 'text-[#33413f] hover:bg-[#f0f5f2]'}`}
          onClick={() => setCycle('monthly')}
          type="button"
        >
          {monthly}
        </button>
        <button
          aria-pressed={cycle === 'yearly'}
          className={`focus-ring min-h-10 rounded-md px-5 text-sm font-semibold transition ${cycle === 'yearly' ? 'bg-[var(--accent)] text-white' : 'text-[#33413f] hover:bg-[#f0f5f2]'}`}
          onClick={() => setCycle('yearly')}
          type="button"
        >
          {yearly}
        </button>
      </div>
      <p className="text-xs font-semibold text-[var(--accent)]">{annualSaving}</p>
    </div>
  );
}

export function BillingCyclePrice({monthly, yearly}: {monthly: string; yearly: string}) {
  const {cycle} = useBillingCycle();

  return <>{cycle === 'monthly' ? monthly : yearly}</>;
}
