import {NextResponse} from 'next/server';

import {normalizeBillingPlan} from '@/lib/billing/config';
import {sendRentReminderEmail} from '@/lib/reminders/email';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const TIME_ZONE = 'Europe/Paris';
const REMINDER_TYPE = 'rent_due';

type Relation<T> = T | T[] | null;

type LeaseRow = {
  charges_amount: number;
  end_date: string | null;
  id: string;
  monthly_rent: number;
  properties: Relation<{
    address_line1: string | null;
    city: string | null;
    name: string;
    postal_code: string | null;
  }>;
  rent_charges: {
    period_month: string;
    status: string;
    total_due: number;
  }[];
  rent_reminder_day: number | null;
  rent_reminder_days_before: number;
  start_date: string;
  tenant_id: string;
  tenants: Relation<{
    email: string | null;
    full_name: string;
  }>;
  units: Relation<{
    name: string;
  }>;
  workspace_id: string;
};

type BillingRow = {
  lifetime_access: boolean;
  plan: string;
  status: string;
  workspace_id: string;
};

type WorkspaceRow = {
  created_by: string;
  id: string;
  name: string;
};

type ProfileRow = {
  email: string | null;
  full_name: string | null;
  id: string;
  locale: string;
};

type ReminderCandidate = {
  dueDate: string;
  lease: LeaseRow;
  reminderMonth: string;
  scheduledFor: string;
  totalDue: number;
};

function relationOne<T>(value: Relation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }

  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function parisTodayIso() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: TIME_ZONE,
    year: 'numeric'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dueDateForMonth(year: number, month: number, preferredDay: number) {
  const day = Math.min(Math.max(preferredDay, 1), daysInMonth(year, month));
  return new Date(Date.UTC(year, month - 1, day));
}

function nextMonth(year: number, month: number) {
  return month === 12 ? {month: 1, year: year + 1} : {month: month + 1, year};
}

function leaseCoversDate(lease: LeaseRow, iso: string) {
  return lease.start_date <= iso && (!lease.end_date || lease.end_date >= iso);
}

function reminderMonthFromDueDate(dueDate: string) {
  return `${dueDate.slice(0, 7)}-01`;
}

function findReminderCandidate(lease: LeaseRow, todayIso: string): ReminderCandidate | null {
  if (!lease.rent_reminder_day) {
    return null;
  }

  const today = parseIsoDate(todayIso);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const monthsToCheck = [
    {month, year},
    nextMonth(year, month)
  ];

  for (const candidateMonth of monthsToCheck) {
    const dueDate = dueDateForMonth(candidateMonth.year, candidateMonth.month, lease.rent_reminder_day);
    const scheduledFor = isoDate(addDays(dueDate, -lease.rent_reminder_days_before));

    if (scheduledFor !== todayIso) {
      continue;
    }

    const dueDateIso = isoDate(dueDate);

    if (!leaseCoversDate(lease, dueDateIso)) {
      continue;
    }

    const reminderMonth = reminderMonthFromDueDate(dueDateIso);
    const rentCharge = lease.rent_charges.find((charge) => charge.period_month === reminderMonth);

    if (rentCharge?.status === 'paid') {
      return null;
    }

    return {
      dueDate: dueDateIso,
      lease,
      reminderMonth,
      scheduledFor,
      totalDue: Number(rentCharge?.total_due ?? Number(lease.monthly_rent ?? 0) + Number(lease.charges_amount ?? 0))
    };
  }

  return null;
}

async function sendReminderEmail(candidate: ReminderCandidate, workspace: WorkspaceRow | null, owner: ProfileRow | null) {
  const tenant = relationOne(candidate.lease.tenants);
  const property = relationOne(candidate.lease.properties);
  const unit = relationOne(candidate.lease.units);

  return sendRentReminderEmail({
    amount: candidate.totalDue,
    dueDate: candidate.dueDate,
    ownerName: owner?.full_name || workspace?.name || 'Votre bailleur',
    propertyLabel: [property?.name, unit?.name].filter(Boolean).join(' - ') || workspace?.name || 'votre logement',
    reminderMonth: candidate.reminderMonth,
    tenantEmail: tenant?.email ?? '',
    tenantName: tenant?.full_name ?? 'locataire'
  });
}

function canWorkspaceUseReminders(billing: BillingRow | null | undefined) {
  if (!billing?.lifetime_access && !['active', 'trialing'].includes(billing?.status ?? '')) {
    return false;
  }

  return ['plus', 'portfolio'].includes(normalizeBillingPlan(billing?.plan));
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const todayIso = parisTodayIso();
  const admin = createSupabaseAdminClient();
  const {data: leases, error: leasesError} = await admin
    .from('leases')
    .select(
      'id, workspace_id, tenant_id, start_date, end_date, monthly_rent, charges_amount, rent_reminder_day, rent_reminder_days_before, tenants(full_name, email), properties(name, address_line1, postal_code, city), units(name), rent_charges(period_month, status, total_due)'
    )
    .eq('status', 'active')
    .eq('rent_reminder_enabled', true)
    .not('rent_reminder_day', 'is', null)
    .returns<LeaseRow[]>();

  if (leasesError) {
    return NextResponse.json({error: leasesError.message}, {status: 500});
  }

  const rawCandidates = (leases ?? []).map((lease) => findReminderCandidate(lease, todayIso)).filter(Boolean) as ReminderCandidate[];
  const workspaceIds = [...new Set(rawCandidates.map((candidate) => candidate.lease.workspace_id))];

  if (!rawCandidates.length || !workspaceIds.length) {
    return NextResponse.json({checked: leases?.length ?? 0, candidates: 0, failed: 0, sent: 0, skipped: 0, today: todayIso});
  }

  const [{data: billingRows}, {data: workspaces}] = await Promise.all([
    admin.from('workspace_billing').select('workspace_id, plan, status, lifetime_access').in('workspace_id', workspaceIds).returns<BillingRow[]>(),
    admin.from('workspaces').select('id, name, created_by').in('id', workspaceIds).returns<WorkspaceRow[]>()
  ]);
  const billingByWorkspace = new Map((billingRows ?? []).map((billing) => [billing.workspace_id, billing]));
  const workspaceById = new Map((workspaces ?? []).map((workspace) => [workspace.id, workspace]));
  const ownerIds = [...new Set((workspaces ?? []).map((workspace) => workspace.created_by))];
  const {data: profiles} = ownerIds.length
    ? await admin.from('profiles').select('id, email, full_name, locale').in('id', ownerIds).returns<ProfileRow[]>()
    : {data: [] as ProfileRow[]};
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const candidates = rawCandidates.filter((candidate) => canWorkspaceUseReminders(billingByWorkspace.get(candidate.lease.workspace_id)));
  const leaseIds = [...new Set(candidates.map((candidate) => candidate.lease.id))];
  const reminderMonths = [...new Set(candidates.map((candidate) => candidate.reminderMonth))];
  const {data: sentLogs} =
    leaseIds.length && reminderMonths.length
      ? await admin
          .from('rent_reminder_logs')
          .select('lease_id, reminder_month')
          .eq('reminder_type', REMINDER_TYPE)
          .eq('status', 'sent')
          .in('lease_id', leaseIds)
          .in('reminder_month', reminderMonths)
      : {data: [] as {lease_id: string; reminder_month: string}[]};
  const sentKeys = new Set((sentLogs ?? []).map((log) => `${log.lease_id}:${log.reminder_month}`));

  let sent = 0;
  let failed = 0;
  let skipped = rawCandidates.length - candidates.length;

  for (const candidate of candidates) {
    const tenant = relationOne(candidate.lease.tenants);
    const key = `${candidate.lease.id}:${candidate.reminderMonth}`;

    if (sentKeys.has(key)) {
      skipped += 1;
      continue;
    }

    const workspace = workspaceById.get(candidate.lease.workspace_id) ?? null;
    const owner = workspace?.created_by ? (profileById.get(workspace.created_by) ?? null) : null;

    try {
      const providerMessageId = await sendReminderEmail(candidate, workspace, owner);
      await admin.from('rent_reminder_logs').upsert(
        {
          due_date: candidate.dueDate,
          email_to: tenant?.email ?? null,
          error_message: null,
          lease_id: candidate.lease.id,
          provider_message_id: providerMessageId,
          reminder_month: candidate.reminderMonth,
          reminder_type: REMINDER_TYPE,
          scheduled_for: candidate.scheduledFor,
          sent_at: new Date().toISOString(),
          status: 'sent',
          tenant_id: candidate.lease.tenant_id,
          workspace_id: candidate.lease.workspace_id
        },
        {onConflict: 'lease_id,reminder_month,reminder_type'}
      );
      await admin.from('leases').update({last_rent_reminder_sent_at: new Date().toISOString()}).eq('id', candidate.lease.id);
      sent += 1;
    } catch (error) {
      failed += 1;
      await admin.from('rent_reminder_logs').upsert(
        {
          due_date: candidate.dueDate,
          email_to: tenant?.email ?? null,
          error_message: error instanceof Error ? error.message : 'Unknown email error.',
          lease_id: candidate.lease.id,
          provider_message_id: null,
          reminder_month: candidate.reminderMonth,
          reminder_type: REMINDER_TYPE,
          scheduled_for: candidate.scheduledFor,
          sent_at: null,
          status: 'failed',
          tenant_id: candidate.lease.tenant_id,
          workspace_id: candidate.lease.workspace_id
        },
        {onConflict: 'lease_id,reminder_month,reminder_type'}
      );
    }
  }

  return NextResponse.json({
    candidates: candidates.length,
    checked: leases?.length ?? 0,
    failed,
    sent,
    skipped,
    today: todayIso
  });
}
