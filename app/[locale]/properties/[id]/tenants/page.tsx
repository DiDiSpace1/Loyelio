import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {assignPropertyTenantsAction} from '../../actions';
import {LeaseTerminationManager, OccupancyManager} from '../edit/occupancy-manager';

type PropertyTenantsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PropertyForTenantManagement = {
  id: string;
  name: string;
  charges_estimate: number | null;
  deposit_estimate: number | null;
  monthly_rent_estimate: number | null;
  occupancy_status: string;
  leases: {
    id: string;
    end_date: string | null;
    start_date: string;
    status: string;
    tenants: {
      full_name: string;
    } | null;
  }[];
};

type TenantOption = {
  id: string;
  full_name: string;
};

export default async function PropertyTenantsPage({params}: PropertyTenantsPageProps) {
  const {id} = await params;
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: property, error} = await supabase
    .from('properties')
    .select('id, name, monthly_rent_estimate, charges_estimate, deposit_estimate, occupancy_status, leases(id, status, start_date, end_date, tenants(full_name))')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single<PropertyForTenantManagement>();

  if (error || !property) {
    notFound();
  }

  const {data: tenants} = await supabase
    .from('tenants')
    .select('id, full_name')
    .eq('workspace_id', workspaceId)
    .order('full_name', {ascending: true})
    .returns<TenantOption[]>();
  const activeLeases = property.leases.filter((lease) => lease.status === 'active');

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[var(--accent)]" href="/properties">
            Retour aux biens
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">Gerer les locataires</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{property.name}</p>
        </div>
        <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] px-5 text-sm font-semibold text-[#171d1c]" href={`/properties/${property.id}`}>
          Voir le bien
        </Link>
      </div>

      <form action={assignPropertyTenantsAction} className="mt-8 grid gap-5">
        <input name="locale" type="hidden" value={locale} />
        <input name="property_id" type="hidden" value={property.id} />
        <input name="monthly_rent" type="hidden" value={property.monthly_rent_estimate ?? 0} />
        <input name="charges_amount" type="hidden" value={property.charges_estimate ?? 0} />
        <input name="deposit_amount" type="hidden" value={property.deposit_estimate ?? 0} />
        <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
          <h2 className="mb-5 text-base font-semibold">Ajouter des locataires</h2>
          <OccupancyManager initialStatus={activeLeases.length ? 'rented' : property.occupancy_status} tenants={tenants ?? []} />
        </section>
        <div className="flex justify-end gap-3">
          <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-5 text-sm font-semibold" href="/properties">
            Annuler
          </Link>
          <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">
            Enregistrer
          </button>
        </div>
      </form>

      <section className="mt-5 rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
        <h2 className="mb-5 text-base font-semibold">Contrats existants</h2>
        <LeaseTerminationManager leases={activeLeases} locale={locale} propertyId={property.id} returnTo="tenant_management" />
        {!activeLeases.length ? <p className="text-sm text-[var(--muted)]">Aucun contrat actif pour ce bien.</p> : null}
      </section>
    </AppShell>
  );
}
