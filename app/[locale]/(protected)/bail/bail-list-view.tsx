import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {getCurrentUserWorkspace} from '@/lib/workspace';

import {BailListClient, type BailListRow} from './bail-list-client';

type BailListViewProps = {
  query?: string;
};

export async function BailListView({query = ''}: BailListViewProps) {
  const locale = await getLocale();
  const t = await getTranslations('bail');
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data} = await supabase
    .from('leases')
    .select('id, status, start_date, end_date, monthly_rent, charges_amount, tenants(full_name), properties(id, name, address_line1, postal_code, city)')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false})
    .returns<BailListRow[]>();

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('listSubtitle')}</p>
        </div>
        <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-white shadow-sm" href="/bail/new" style={{color: '#ffffff'}}>
          + {t('newLease')}
        </Link>
      </div>

      <BailListClient initialQuery={query.trim()} leases={data ?? []} locale={locale} />
    </>
  );
}
