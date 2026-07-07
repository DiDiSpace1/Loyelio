import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {PageHeader} from '@/components/app/page-header';
import {StatCard} from '@/components/app/stat-card';
import {getCurrentUserWorkspace} from '@/lib/workspace';

type RentCharge = {
  id: string;
  status: string;
  total_due: number;
};

function currentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const month = currentMonthStart();
  const {data: rentCharges} = await supabase
    .from('rent_charges')
    .select('id, status, total_due')
    .eq('workspace_id', workspaceId)
    .eq('period_month', month)
    .returns<RentCharge[]>();
  const {count: propertyCount} = await supabase.from('properties').select('*', {count: 'exact', head: true}).eq('workspace_id', workspaceId);
  const {count: tenantCount} = await supabase.from('tenants').select('*', {count: 'exact', head: true}).eq('workspace_id', workspaceId);

  const charges = rentCharges ?? [];
  const expectedRent = charges.reduce((sum, charge) => sum + Number(charge.total_due), 0);
  const unpaidCount = charges.filter((charge) => charge.status !== 'paid' && charge.status !== 'waived').length;

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label={t('monthlyRent')} value={`${expectedRent.toFixed(2)} EUR`} note={`${charges.length} echeance(s), ${unpaidCount} a suivre`} />
        <StatCard label={t('missingReceipts')} value="0" note="Le module depenses arrive ensuite" />
        <StatCard label={t('yearlyIncome')} value={`${propertyCount ?? 0} bien(s)`} note={`${tenantCount ?? 0} locataire(s) enregistres`} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] p-5">
            <h2 className="text-lg font-semibold">{t('recentDocuments')}</h2>
          </div>
          <div className="p-6 text-sm text-[var(--muted)]">Les documents seront branches dans la phase fichiers et recus.</div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-lg font-semibold">{t('quickActions')}</h2>
          <div className="mt-4 grid gap-3">
            <Link className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-4 py-3 text-left text-sm font-medium hover:bg-[#f2f0ea]" href="/properties">
              {t('addRent')}
            </Link>
            <Link className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-4 py-3 text-left text-sm font-medium hover:bg-[#f2f0ea]" href="/tenants">
              Ajouter un locataire
            </Link>
            <Link className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-4 py-3 text-left text-sm font-medium hover:bg-[#f2f0ea]" href="/documents">
              {t('uploadDocument')}
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
