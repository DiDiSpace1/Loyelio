import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {PageHeader} from '@/components/app/page-header';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createPropertyAction} from './actions';

type PropertyRow = {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  postal_code: string | null;
  rental_mode: string;
  tax_regime: string;
  units: {id: string}[];
};

type PropertiesPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function PropertiesPage({searchParams}: PropertiesPageProps) {
  const t = await getTranslations('properties');
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: properties, error} = await supabase
    .from('properties')
    .select('id, name, address_line1, city, postal_code, rental_mode, tax_regime, units(id)')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false})
    .returns<PropertyRow[]>();

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {error ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Impossible de charger les biens. Lancez la migration Supabase de la phase 2 avant de continuer.
        </div>
      ) : null}

      {params.error === 'plan_limit' ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Le plan gratuit inclut 1 bien. Passez a Pro depuis les parametres pour ajouter d autres biens.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] p-5">
            <h2 className="text-lg font-semibold">Biens enregistres</h2>
          </div>
          {properties?.length ? (
            <div className="divide-y divide-[var(--line)]">
              {properties.map((property) => (
                <Link className="block p-5 transition hover:bg-[#f7f6f2]" href={`/properties/${property.id}`} key={property.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{property.name}</h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {[property.address_line1, property.postal_code, property.city].filter(Boolean).join(', ') || 'Adresse a completer'}
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs font-semibold text-[var(--muted)]">
                      <span className="rounded-full bg-[#f2f0ea] px-3 py-1">{property.tax_regime}</span>
                      <span className="rounded-full bg-[#f2f0ea] px-3 py-1">{property.units.length} unite(s)</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-[var(--muted)]">Aucun bien pour le moment.</div>
          )}
        </div>

        <form action={createPropertyAction} className="rounded-lg border border-[var(--line)] bg-white p-5">
          <input name="locale" type="hidden" value={locale} />
          <h2 className="text-lg font-semibold">{t('newProperty')}</h2>
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
                <option value="shared_rooms">Colocation / chambres</option>
                <option value="entire_place">Logement entier</option>
                <option value="mixed">Mixte</option>
              </select>
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
