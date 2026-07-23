import {NextResponse, type NextRequest} from 'next/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {createSupabaseServerClient} from '@/lib/supabase/server';

type Relation<T> = T | T[] | null;

type CollectionExportRow = {
  charges_amount: number | null;
  end_date: string | null;
  monthly_rent: number | null;
  properties: Relation<{name: string}>;
  rent_charges: {
    period_month: string;
    rent_payments: {amount: number | null; notes: string | null}[];
    status: string;
  }[];
  start_date: string;
  tenants: Relation<{full_name: string}>;
  units: Relation<{name: string | null}>;
};

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const VIEWS = ['all', 'open', 'unpaid', 'partial', 'paid'] as const;

type CollectionView = (typeof VIEWS)[number];
type CollectionStatus = 'paid' | 'partial' | 'unpaid';

const labels = {
  en: {
    charges: 'Charges',
    paid: 'Paid',
    partial: 'Partial',
    property: 'Property',
    remaining: 'Remaining',
    rent: 'Rent',
    status: 'Status',
    tenant: 'Tenant',
    total: 'Total due',
    unit: 'Unit',
    unpaid: 'Unpaid'
  },
  fr: {
    charges: 'Charges',
    paid: 'Payé',
    partial: 'Partiel',
    property: 'Bien',
    remaining: 'Reste',
    rent: 'Loyer',
    status: 'Statut',
    tenant: 'Locataire',
    total: 'Total dû',
    unit: 'Lot',
    unpaid: 'Impayé'
  },
  zh: {
    charges: '费用',
    paid: '已付款',
    partial: '部分付款',
    property: '房产',
    remaining: '剩余金额',
    rent: '租金',
    status: '状态',
    tenant: '租客',
    total: '应收合计',
    unit: '房间',
    unpaid: '未付款'
  }
} as const;

function relationOne<T>(value: Relation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function addMonths(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthIndex - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

function leaseCoversMonth(lease: CollectionExportRow, month: string) {
  const start = `${month}-01`;
  const nextMonth = `${addMonths(month, 1)}-01`;
  return lease.start_date < nextMonth && (!lease.end_date || lease.end_date >= start);
}

function isRentPayment(payment: {notes: string | null}) {
  return !payment.notes?.startsWith('[[loyelio:revenue_type=deposit]]') && !payment.notes?.startsWith('[[loyelio:revenue_type=other]]');
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value);

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(',');
}

function selectedView(value: string | null): CollectionView {
  return VIEWS.includes(value as CollectionView) ? (value as CollectionView) : 'all';
}

function selectedLocale(value: string | null): keyof typeof labels {
  return value === 'en' || value === 'zh' ? value : 'fr';
}

function collectionStatus(value: string | undefined): CollectionStatus {
  return value === 'paid' || value === 'partial' ? value : 'unpaid';
}

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get('month') ?? '';
  const view = selectedView(request.nextUrl.searchParams.get('view'));
  const locale = selectedLocale(request.nextUrl.searchParams.get('locale'));

  if (!MONTH_PATTERN.test(month)) {
    return NextResponse.json({error: 'Invalid month'}, {status: 400});
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const {data: profile} = await supabase.from('profiles').select('default_workspace_id').eq('id', user.id).single<{default_workspace_id: string | null}>();
  const workspaceId = profile?.default_workspace_id;

  if (!workspaceId) {
    return NextResponse.json({error: 'Workspace not found'}, {status: 404});
  }

  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (!hasPaidAccess(billing) || normalizeBillingPlan(billing?.plan) !== 'portfolio') {
    return NextResponse.json({error: 'Portfolio is required'}, {status: 403});
  }

  const {data: leases, error} = await supabase
    .from('leases')
    .select('start_date, end_date, monthly_rent, charges_amount, tenants(full_name), properties(name), units(name), rent_charges(period_month, status, rent_payments(amount, notes))')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('start_date', {ascending: true})
    .returns<CollectionExportRow[]>();

  if (error) {
    return NextResponse.json({error: 'Export failed'}, {status: 500});
  }

  const periodMonth = `${month}-01`;
  const rows = (leases ?? [])
    .filter((lease) => leaseCoversMonth(lease, month))
    .map((lease) => {
      const rent = Number(lease.monthly_rent ?? 0);
      const charges = Number(lease.charges_amount ?? 0);
      const total = rent + charges;
      const charge = lease.rent_charges.find((item) => item.period_month === periodMonth);
      const paid = (charge?.rent_payments ?? []).filter(isRentPayment).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
      const status = collectionStatus(charge?.status);

      return {
        charges,
        paid,
        property: relationOne(lease.properties)?.name ?? '',
        remaining: Math.max(0, total - paid),
        rent,
        status,
        tenant: relationOne(lease.tenants)?.full_name ?? '',
        total,
        unit: relationOne(lease.units)?.name ?? ''
      };
    })
    .filter((row) => view === 'all' || (view === 'open' ? row.status !== 'paid' : row.status === view));

  const text = labels[locale];
  const output = [
    csvRow([text.tenant, text.property, text.unit, text.rent, text.charges, text.total, text.paid, text.remaining, text.status]),
    ...rows.map((row) =>
      csvRow([row.tenant, row.property, row.unit, row.rent.toFixed(2), row.charges.toFixed(2), row.total.toFixed(2), row.paid.toFixed(2), row.remaining.toFixed(2), text[row.status]])
    )
  ];

  return new NextResponse(`\uFEFF${output.join('\r\n')}\r\n`, {
    headers: {
      'Content-Disposition': `attachment; filename="loyelio-collections-${month}-${view}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8'
    }
  });
}
