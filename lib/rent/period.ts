export type RentChargeWithLeasePeriod = {
  period_month: string;
  leases: {
    end_date?: string | null;
    start_date?: string | null;
  } | null;
};

function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}

export function isRentChargeWithinLeasePeriod(charge: RentChargeWithLeasePeriod) {
  if (!charge.leases?.start_date) {
    return false;
  }

  const chargeMonth = monthStart(charge.period_month);
  const leaseStartMonth = monthStart(charge.leases.start_date);
  const leaseEndMonth = charge.leases.end_date ? monthStart(charge.leases.end_date) : null;

  return chargeMonth >= leaseStartMonth && (!leaseEndMonth || chargeMonth <= leaseEndMonth);
}
