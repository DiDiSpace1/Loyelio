export type RentChargeDraft = {
  charges_amount: number;
  due_date: string;
  lease_id: string;
  period_month: string;
  rent_amount: number;
  status: 'unpaid';
  total_due: number;
  workspace_id: string;
};

function toMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildRentChargesForLease(input: {
  chargesAmount: number;
  endDate?: string | null;
  leaseId: string;
  monthlyRent: number;
  monthsAhead?: number;
  startDate: string;
  workspaceId: string;
}): RentChargeDraft[] {
  const start = toMonthStart(new Date(`${input.startDate}T00:00:00.000Z`));
  const plannedEnd = addMonths(start, input.monthsAhead ?? 12);
  const leaseEnd = input.endDate ? toMonthStart(new Date(`${input.endDate}T00:00:00.000Z`)) : null;
  const endExclusive = leaseEnd && leaseEnd < plannedEnd ? addMonths(leaseEnd, 1) : plannedEnd;
  const charges: RentChargeDraft[] = [];

  for (let cursor = start; cursor < endExclusive; cursor = addMonths(cursor, 1)) {
    const dueDate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 5));

    charges.push({
      charges_amount: input.chargesAmount,
      due_date: isoDate(dueDate),
      lease_id: input.leaseId,
      period_month: isoDate(cursor),
      rent_amount: input.monthlyRent,
      status: 'unpaid',
      total_due: input.monthlyRent + input.chargesAmount,
      workspace_id: input.workspaceId
    });
  }

  return charges;
}
