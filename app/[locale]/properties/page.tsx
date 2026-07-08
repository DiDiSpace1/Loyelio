import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getPropertyPhotoLimit} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createPropertyAction, deletePropertyAction} from './actions';

type PropertyRow = {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  postal_code: string | null;
  rental_mode: string;
  tax_regime: string;
  property_photos: {file_path: string; is_cover: boolean}[];
  units: {id: string}[];
  leases: {
    id: string;
    status: string;
    monthly_rent: number;
    tenants: {full_name: string} | null;
  }[];
};

type PropertiesPageProps = {
  searchParams: Promise<{
    error?: string;
    mode?: string;
    q?: string;
  }>;
};

const modeLabels: Record<string, string> = {
  entire_place: 'entier',
  mixed: 'mixte',
  shared_rooms: 'colocation'
};

const modeOptions = [
  {label: 'Tous les modes', value: ''},
  {label: 'colocation', value: 'shared_rooms'},
  {label: 'entier', value: 'entire_place'},
  {label: 'mixte', value: 'mixed'}
];

function formatAddress(property: Pick<PropertyRow, 'address_line1' | 'postal_code' | 'city'>) {
  return [property.address_line1, property.postal_code, property.city].filter(Boolean).join(', ') || 'Adresse a completer';
}

function statusFor(property: PropertyRow) {
  const activeLeases = property.leases.filter((lease) => lease.status === 'active');

  if (activeLeases.length > 0) {
    return {
      className: 'bg-[#ecfdf5] text-[#047857]',
      label: 'Loue'
    };
  }

  return {
    className: 'bg-[#eef2ff] text-[#3755c3]',
    label: 'Vacant'
  };
}

export default async function PropertiesPage({searchParams}: PropertiesPageProps) {
  const t = await getTranslations('properties');
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const photoLimit = getPropertyPhotoLimit(billing?.plan);
  const queryText = (params.q ?? '').trim();
  const selectedMode = params.mode ?? '';

  let query = supabase
    .from('properties')
    .select('id, name, address_line1, city, postal_code, rental_mode, tax_regime, property_photos(file_path, is_cover), units(id), leases(id, status, monthly_rent, tenants(full_name))')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false});

  if (selectedMode) {
    query = query.eq('rental_mode', selectedMode);
  }

  if (queryText) {
    query = query.or(`name.ilike.%${queryText}%,address_line1.ilike.%${queryText}%,city.ilike.%${queryText}%`);
  }

  const {data: properties, error} = await query.returns<PropertyRow[]>();
  const rows = properties ?? [];
  const activeLeaseCount = rows.reduce((sum, property) => sum + property.leases.filter((lease) => lease.status === 'active').length, 0);
  const unitCount = rows.reduce((sum, property) => sum + property.units.length, 0);
  const monthlyRent = rows.reduce(
    (sum, property) => sum + property.leases.filter((lease) => lease.status === 'active').reduce((leaseSum, lease) => leaseSum + Number(lease.monthly_rent), 0),
    0
  );
  const signedPhotos = new Map<string, string>();

  await Promise.all(
    rows.map(async (property) => {
      const cover = property.property_photos.find((photo) => photo.is_cover) ?? property.property_photos[0];

      if (!cover) {
        return;
      }

      const {data} = await supabase.storage.from('property-photos').createSignedUrl(cover.file_path, 60 * 5);

      if (data?.signedUrl) {
        signedPhotos.set(property.id, data.signedUrl);
      }
    })
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        <a className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" href="#new-property">
          + {t('newProperty')}
        </a>
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Impossible de charger les biens. Lancez les migrations Supabase des biens et photos avant de continuer.
        </div>
      ) : null}

      {params.error === 'plan_limit' ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Le plan gratuit inclut 1 bien. Passez a Solo depuis les parametres pour ajouter d autres biens.
        </div>
      ) : null}

      {params.error === 'photo_limit' ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Votre plan autorise {photoLimit} photo(s) par bien. Supprimez des fichiers ou changez de plan.
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total biens" note="Patrimoine actif" value={rows.length.toString()} />
        <SummaryCard label="Unites suivies" note={`${activeLeaseCount} bail actif(s)`} value={unitCount.toString()} />
        <SummaryCard label="Loyers mensuels" note="Baux actifs" value={`${monthlyRent.toLocaleString('fr-FR')} EUR`} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <form className="mb-4 flex flex-col gap-3 rounded-lg border border-[var(--line-soft)] bg-white p-4 md:flex-row">
            <input
              className="focus-ring min-h-11 flex-1 rounded-lg border border-[var(--line)] bg-[#f0f5f2] px-3 text-sm"
              defaultValue={queryText}
              name="q"
              placeholder="Rechercher un bien, une adresse, une ville..."
            />
            <select className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-[#f0f5f2] px-3 text-sm md:w-44" defaultValue={selectedMode} name="mode">
              {modeOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[#171d1c]" type="submit">
              Filtrer
            </button>
          </form>

          <div className="overflow-hidden rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead className="border-b border-[var(--line-soft)] bg-[#eaefed] text-[11px] font-semibold uppercase text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-4">Bien & adresse</th>
                    <th className="px-5 py-4">Mode</th>
                    <th className="px-5 py-4">Locataire</th>
                    <th className="px-5 py-4">Loyer HC</th>
                    <th className="px-5 py-4">Statut</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-soft)]">
                  {rows.length ? (
                    rows.map((property) => {
                      const activeLease = property.leases.find((lease) => lease.status === 'active');
                      const status = statusFor(property);
                      const photoUrl = signedPhotos.get(property.id);

                      return (
                        <tr className="transition hover:bg-[#f0f5f2]" key={property.id}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img alt="" className="h-11 w-11 rounded-md object-cover" src={photoUrl} />
                              ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#dee4e1] text-xs font-semibold text-[var(--muted)]">HL</div>
                              )}
                              <div>
                                <Link className="font-semibold hover:text-[var(--accent)]" href={`/properties/${property.id}`}>
                                  {property.name}
                                </Link>
                                <p className="mt-1 text-sm text-[var(--muted)]">{formatAddress(property)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm">{modeLabels[property.rental_mode] ?? property.rental_mode}</td>
                          <td className="px-5 py-4 text-sm text-[var(--muted)]">{activeLease?.tenants?.full_name ?? '-'}</td>
                          <td className="px-5 py-4 text-sm tabular-nums">{activeLease ? `${Number(activeLease.monthly_rent).toFixed(0)} EUR` : '-'}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <details className="relative inline-block">
                              <summary className="focus-ring flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-xl text-[var(--muted)] hover:bg-[#eaefed]">
                                ...
                              </summary>
                              <div className="absolute right-0 z-20 mt-2 w-36 rounded-lg border border-[var(--line-soft)] bg-white p-1 text-left text-sm shadow-lg">
                                <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/properties/${property.id}`}>
                                  Voir
                                </Link>
                                <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/properties/${property.id}#property-settings`}>
                                  Modifier
                                </Link>
                                <form action={deletePropertyAction}>
                                  <input name="locale" type="hidden" value={locale} />
                                  <input name="property_id" type="hidden" value={property.id} />
                                  <button className="block w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff1f1]" type="submit">
                                    Supprimer
                                  </button>
                                </form>
                              </div>
                            </details>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-5 py-10 text-center text-sm text-[var(--muted)]" colSpan={6}>
                        Aucun bien pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--line-soft)] px-5 py-4 text-sm text-[var(--muted)]">
              Affichage {rows.length ? `1-${rows.length}` : '0'} sur {rows.length} bien(s)
            </div>
          </div>
        </div>

        <form action={createPropertyAction} className="rounded-lg border border-[var(--line-soft)] bg-white p-5" encType="multipart/form-data" id="new-property">
          <input name="locale" type="hidden" value={locale} />
          <h2 className="text-lg font-semibold">{t('newProperty')}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Photos: {photoLimit === 0 ? 'non incluses dans le plan Free' : `${photoLimit} maximum par bien`}
          </p>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Nom du bien
              <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="name" placeholder="Appartement Lyon" required />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Adresse
              <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="address_line1" placeholder="12 rue ..." />
            </label>
            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <label className="grid gap-2 text-sm font-medium">
                Code postal
                <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="postal_code" placeholder="69001" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Ville
                <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="city" placeholder="Lyon" />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Mode de location
              <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="rental_mode" defaultValue="shared_rooms">
                <option value="shared_rooms">colocation</option>
                <option value="entire_place">entier</option>
                <option value="mixed">mixte</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Photos
              <input className="focus-ring rounded-md border border-dashed border-[var(--line)] px-3 py-3 text-sm" disabled={photoLimit === 0} multiple name="photos" type="file" accept="image/*" />
            </label>
            <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
              Creer le bien
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}

function SummaryCard({label, note, value}: {label: string; note: string; value: string}) {
  return (
    <div className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{note}</p>
    </div>
  );
}
