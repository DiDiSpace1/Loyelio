import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

type PropertyDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PropertyDetail = {
  id: string;
  name: string;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
  property_type: string;
  rental_mode: string;
  surface_area: number | null;
  monthly_rent_estimate: number | null;
  charges_estimate: number | null;
  deposit_estimate: number | null;
  occupancy_status: string;
  tax_regime: string;
  property_photos: {
    file_path: string;
    is_cover: boolean;
  }[];
  units: {
    id: string;
    name: string;
    unit_type: string;
  }[];
  leases: {
    id: string;
    charges_amount: number;
    deposit_amount: number;
    end_date: string | null;
    start_date: string;
    status: string;
    monthly_rent: number;
    tenants: {
      full_name: string;
    } | null;
    units: {
      name: string;
    } | null;
  }[];
};

const modeLabels: Record<string, string> = {
  entire_place: 'entier',
  mixed: 'mixte',
  shared_rooms: 'colocation'
};

const propertyTypeLabels: Record<string, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  other: 'Autre',
  room: 'Chambre',
  studio: 'Studio',
  t1: 'T1',
  t2: 'T2',
  t3: 'T3',
  t4: 'T4'
};

function money(value: number | null | undefined) {
  return value || value === 0 ? `${Number(value).toLocaleString('fr-FR')} EUR` : '-';
}

export default async function PropertyDetailPage({params}: PropertyDetailPageProps) {
  const {id} = await params;
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data, error} = await supabase
    .from('properties')
    .select(
      'id, name, address_line1, postal_code, city, property_type, rental_mode, surface_area, monthly_rent_estimate, charges_estimate, deposit_estimate, occupancy_status, tax_regime, property_photos(file_path, is_cover), units(id, name, unit_type), leases(id, status, start_date, end_date, monthly_rent, charges_amount, deposit_amount, tenants(full_name), units(name))'
    )
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single<PropertyDetail>();

  if (error || !data) {
    notFound();
  }

  const property = data;
  const address = [property.address_line1, property.postal_code, property.city].filter(Boolean).join(', ');
  const activeLease = property.leases.find((lease) => lease.status === 'active');
  const signedPhotos = await Promise.all(
    property.property_photos.slice(0, 8).map(async (photo) => {
      const {data: signed} = await supabase.storage.from('property-photos').createSignedUrl(photo.file_path, 60 * 5);
      return signed?.signedUrl ?? null;
    })
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[var(--accent)]" href="/properties">
            Retour aux biens
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">{property.name}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{address || 'Adresse a completer'}</p>
        </div>
        <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" href={`/properties/${property.id}/edit`}>
          Modifier
        </Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <InfoCard label="Mode" value={modeLabels[property.rental_mode] ?? property.rental_mode} />
        <InfoCard label="Type" value={propertyTypeLabels[property.property_type] ?? property.property_type} />
        <InfoCard label="Surface" value={property.surface_area ? `${Number(property.surface_area).toLocaleString('fr-FR')} m2` : '-'} />
        <InfoCard label="Statut" value={activeLease || property.occupancy_status === 'rented' ? 'Loue' : 'Vacant'} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-6">
          <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Informations generales</h2>
            <dl className="mt-5 grid gap-4 md:grid-cols-2">
              <DataRow label="Adresse" value={property.address_line1 ?? '-'} />
              <DataRow label="Ville" value={[property.postal_code, property.city].filter(Boolean).join(' ') || '-'} />
              <DataRow label="Regime fiscal" value={property.tax_regime} />
              <DataRow label="Occupation" value={property.occupancy_status === 'rented' ? 'Loue' : 'Vacant'} />
            </dl>
          </section>

          <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Aspects financiers</h2>
            <dl className="mt-5 grid gap-4 md:grid-cols-3">
              <DataRow label="Loyer mensuel HC" value={money(activeLease?.monthly_rent ?? property.monthly_rent_estimate)} />
              <DataRow label="Charges" value={money(activeLease?.charges_amount ?? property.charges_estimate)} />
              <DataRow label="Depot de garantie" value={money(activeLease?.deposit_amount ?? property.deposit_estimate)} />
            </dl>
          </section>

          <section className="rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
            <div className="border-b border-[var(--line-soft)] p-5">
              <h2 className="text-lg font-semibold">Unites</h2>
            </div>
            {property.units.length ? (
              <div className="divide-y divide-[var(--line-soft)]">
                {property.units.map((unit) => (
                  <div className="flex items-center justify-between p-5" key={unit.id}>
                    <p className="font-medium">{unit.name}</p>
                    <span className="rounded bg-[#eef7f4] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">{unit.unit_type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-sm text-[var(--muted)]">Aucune unite pour ce bien.</div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
            <div className="border-b border-[var(--line-soft)] p-5">
              <h2 className="text-lg font-semibold">Baux</h2>
            </div>
            {property.leases.length ? (
              <div className="divide-y divide-[var(--line-soft)]">
                {property.leases.map((lease) => (
                  <div className="grid gap-3 p-5 md:grid-cols-[1fr_auto]" key={lease.id}>
                    <div>
                      <p className="font-medium">{lease.tenants?.full_name ?? 'Locataire'}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{[lease.units?.name ?? 'Unite non precise', lease.start_date, lease.end_date].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{money(lease.monthly_rent)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-sm text-[var(--muted)]">Aucun bail enregistre.</div>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Photos</h2>
            {signedPhotos.filter(Boolean).length ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {signedPhotos.filter(Boolean).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="aspect-[4/3] rounded-md object-cover" key={url} src={url ?? ''} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">Aucune photo pour ce bien.</p>
            )}
          </section>
        </aside>
      </section>
    </AppShell>
  );
}

function InfoCard({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-xl font-semibold">{value}</p>
    </div>
  );
}

function DataRow({label, value}: {label: string; value: string}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
