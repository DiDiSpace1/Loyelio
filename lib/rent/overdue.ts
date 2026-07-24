type OutstandingCharge = {
  period_month: string;
  status: string;
};

type OverdueLease = {
  end_date: string | null;
  rent_charges: OutstandingCharge[];
  start_date: string | null;
  status: string;
};

export function isOutstandingRentStatus(status: string) {
  return status === 'partial' || status === 'unpaid' || status === 'overdue' || status === 'late';
}

export function leaseIsEffectiveOn(lease: Pick<OverdueLease, 'end_date' | 'start_date' | 'status'>, date: string) {
  return lease.status === 'active' && (!lease.start_date || lease.start_date <= date) && (!lease.end_date || lease.end_date >= date);
}

export function leaseOverlapsMonth(lease: Pick<OverdueLease, 'end_date' | 'start_date' | 'status'>, month: string) {
  const start = `${month}-01`;
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);

  return lease.status === 'active' && (!lease.start_date || lease.start_date < nextMonth) && (!lease.end_date || lease.end_date >= start);
}

export function leaseHasOverdueRent(lease: OverdueLease, month: string, today: string) {
  const currentPeriod = `${month}-01`;
  const leaseIsRelevant = month === today.slice(0, 7) ? leaseIsEffectiveOn(lease, today) : leaseOverlapsMonth(lease, month);

  return leaseIsRelevant && lease.rent_charges.some((charge) => charge.period_month <= currentPeriod && isOutstandingRentStatus(charge.status));
}
