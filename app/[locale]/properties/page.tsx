import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getPlanLimits, getPropertyPhotoLimit} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {CreatePropertyForm} from './create-property-form';
import {PropertyListClient, type PropertyListRow} from './property-list-client';

type PropertyRow = {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  postal_code: string | null;
  rental_mode: string;
  occupancy_status: string;
  monthly_rent_estimate: number | null;
  tax_regime: string;
  property_photos: {file_path: string; is_cover: boolean}[];
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
    new?: string;
    q?: string;
  }>;
};

export default async function PropertiesPage({searchParams}: PropertiesPageProps) {
  const t = await getTranslations('properties');
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const photoLimit = getPropertyPhotoLimit(billing?.plan);
  const planLimits = getPlanLimits(billing?.plan);
  const queryText = (params.q ?? '').trim();
  const selectedMode = params.mode ?? '';
  const showCreate = params.new === '1';

  const query = supabase
    .from('properties')
    .select(
      'id, name, address_line1, city, postal_code, rental_mode, occupancy_status, monthly_rent_estimate, tax_regime, property_photos(file_path, is_cover), leases(id, status, monthly_rent, tenants(full_name))'
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false});

  const {data: properties, error} = await query.returns<PropertyRow[]>();
  const rows = properties ?? [];
  const occupiedPropertyCount = rows.filter((property) => property.occupancy_status === 'rented' || property.leases.some((lease) => lease.status === 'active')).length;
  const occupancyRate = rows.length ? Math.round((occupiedPropertyCount / rows.length) * 100) : 0;
  const monthlyRent = rows.reduce(
    (sum, property) => {
      const leaseTotal = property.leases.filter((lease) => lease.status === 'active').reduce((leaseSum, lease) => leaseSum + Number(lease.monthly_rent), 0);
      return sum + (leaseTotal || Number(property.monthly_rent_estimate ?? 0));
    },
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
  const listRows: PropertyListRow[] = rows.map((property) => ({
    address_line1: property.address_line1,
    city: property.city,
    id: property.id,
    leases: property.leases,
    monthly_rent_estimate: property.monthly_rent_estimate,
    name: property.name,
    occupancy_status: property.occupancy_status,
    photoUrl: signedPhotos.get(property.id) ?? null,
    postal_code: property.postal_code,
    rental_mode: property.rental_mode
  }));

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        {showCreate ? (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] px-5 text-sm font-semibold text-[#171d1c]" href="/properties">
            Retour
          </Link>
        ) : (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" href="/properties?new=1" style={{color: '#ffffff'}}>
            + {t('newProperty')}
          </Link>
        )}
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

      {params.error === 'photo_size' ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          La photo est trop lourde pour votre forfait. Choisissez une image plus legere ou reduisez sa taille avant l&apos;envoi.
        </div>
      ) : null}

      {params.error === 'delete_failed' ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Suppression impossible. Verifiez que la policy Supabase de suppression des biens est appliquee.
        </div>
      ) : null}

      {showCreate ? (
        <CreatePropertyForm locale={locale} maxPhotoSizeBytes={planLimits.maxDocumentSizeBytes} photoLimit={photoLimit} />
      ) : (
        <>
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <SummaryCard icon="domain" iconClassName="text-[var(--accent)]" label="Total Biens" note="Patrimoine actif" value={rows.length.toString()} />
            <SummaryCard icon="analytics" iconClassName="text-[var(--secondary)]" label="Taux d'occupation" progress={occupancyRate} value={`${occupancyRate}%`} />
            <SummaryCard icon="payments" iconClassName="text-[var(--accent)]" label="Revenus Mensuels" note="+2.5% vs mois dernier" trend value={`${monthlyRent.toLocaleString('fr-FR')} €`} />
          </section>

          <PropertyListClient initialMode={selectedMode} initialQuery={queryText} locale={locale} rows={listRows} />
        </>
      )}
    </AppShell>
  );
}

function SummaryCard({
  icon,
  iconClassName,
  label,
  note,
  progress,
  trend = false,
  value
}: {
  icon: string;
  iconClassName: string;
  label: string;
  note?: string;
  progress?: number;
  trend?: boolean;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-medium text-[#33413f]">{label}</p>
        <span className={`material-symbols-outlined text-[20px] ${iconClassName}`}>{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      {typeof progress === 'number' ? (
        <div className="mt-4 h-1.5 rounded-full bg-[#d7e0dc]">
          <div className="h-full rounded-full bg-[var(--secondary)]" style={{width: `${Math.min(Math.max(progress, 0), 100)}%`}} />
        </div>
      ) : null}
      {note ? (
        <p className={trend ? 'mt-3 flex items-center gap-1 text-sm font-medium text-[var(--accent)]' : 'mt-3 text-sm text-[var(--muted)]'}>
          {trend ? <span className="material-symbols-outlined text-[14px]">trending_up</span> : null}
          {note}
        </p>
      ) : null}
    </div>
  );
}
