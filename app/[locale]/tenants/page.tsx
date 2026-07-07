import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {PageHeader} from '@/components/app/page-header';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createTenantAction} from './actions';

type TenantRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

type TenantsPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function TenantsPage({searchParams}: TenantsPageProps) {
  const t = await getTranslations('tenants');
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: tenants, error} = await supabase
    .from('tenants')
    .select('id, full_name, email, phone, notes')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false})
    .returns<TenantRow[]>();

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {error ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Impossible de charger les locataires. Lancez la migration Supabase de la phase 2 avant de continuer.
        </div>
      ) : null}

      {params.error === 'plan_limit' ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Le plan gratuit inclut 3 locataires. Passez a Pro depuis les parametres pour continuer.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] p-5">
            <h2 className="text-lg font-semibold">Locataires enregistres</h2>
          </div>
          {tenants?.length ? (
            <div className="divide-y divide-[var(--line)]">
              {tenants.map((tenant) => (
                <div className="p-5" key={tenant.id}>
                  <h3 className="font-semibold">{tenant.full_name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{[tenant.email, tenant.phone].filter(Boolean).join(' · ') || 'Contact a completer'}</p>
                  {tenant.notes ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{tenant.notes}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-[var(--muted)]">Aucun locataire pour le moment.</div>
          )}
        </div>

        <form action={createTenantAction} className="rounded-lg border border-[var(--line)] bg-white p-5">
          <input name="locale" type="hidden" value={locale} />
          <h2 className="text-lg font-semibold">Ajouter un locataire</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Nom complet
              <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="full_name" placeholder="Marie Dupont" required />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Email
              <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="email" placeholder="marie@example.com" type="email" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Telephone
              <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="phone" placeholder="+33 ..." />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Notes
              <textarea className="focus-ring min-h-24 rounded-md border border-[var(--line)] px-3 py-3" name="notes" placeholder="Informations utiles" />
            </label>
            <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
              Ajouter
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
