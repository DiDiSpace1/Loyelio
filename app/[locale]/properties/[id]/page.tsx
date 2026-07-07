import {notFound} from 'next/navigation';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {PageHeader} from '@/components/app/page-header';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {addRentPaymentAction, createLeaseAction, createUnitAction} from '../actions';

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
  rental_mode: string;
  tax_regime: string;
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
    rent_charges: {
      id: string;
      status: string;
    }[];
  }[];
};

type TenantOption = {
  id: string;
  full_name: string;
};

type RentChargeRow = {
  id: string;
  period_month: string;
  rent_amount: number;
  charges_amount: number;
  total_due: number;
  status: string;
  due_date: string | null;
  leases: {
    id: string;
    tenants: {
      full_name: string;
    } | null;
    units: {
      name: string;
    } | null;
  } | null;
  rent_payments: {
    amount: number;
  }[];
};

export default async function PropertyDetailPage({params}: PropertyDetailPageProps) {
  const {id} = await params;
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data, error} = await supabase
    .from('properties')
    .select(
      'id, name, address_line1, postal_code, city, rental_mode, tax_regime, units(id, name, unit_type), leases(id, status, start_date, end_date, monthly_rent, charges_amount, deposit_amount, tenants(full_name), units(name), rent_charges(id, status))'
    )
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single<PropertyDetail>();

  if (error || !data) {
    notFound();
  }

  const property = data;

  const {data: tenants} = await supabase
    .from('tenants')
    .select('id, full_name')
    .eq('workspace_id', workspaceId)
    .order('full_name', {ascending: true})
    .returns<TenantOption[]>();
  const {data: rentCharges} = await supabase
    .from('rent_charges')
    .select('id, period_month, rent_amount, charges_amount, total_due, status, due_date, leases!inner(id, property_id, tenants(full_name), units(name)), rent_payments(amount)')
    .eq('workspace_id', workspaceId)
    .eq('leases.property_id', property.id)
    .order('period_month', {ascending: true})
    .limit(12)
    .returns<RentChargeRow[]>();

  const address = [property.address_line1, property.postal_code, property.city].filter(Boolean).join(', ');

  return (
    <AppShell>
      <PageHeader title={property.name} subtitle={address || 'Adresse a completer'} />

      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-6">
          <section className="rounded-lg border border-[var(--line)] bg-white">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-lg font-semibold">Chambres et unites</h2>
            </div>
            {property.units.length ? (
              <div className="divide-y divide-[var(--line)]">
                {property.units.map((unit) => (
                  <div className="flex items-center justify-between p-5" key={unit.id}>
                    <div>
                      <p className="font-medium">{unit.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{unit.unit_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-sm text-[var(--muted)]">Aucune unite pour ce bien.</div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-white">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-lg font-semibold">Baux actifs</h2>
            </div>
            {property.leases.length ? (
              <div className="divide-y divide-[var(--line)]">
                {property.leases.map((lease) => (
                  <div className="flex items-center justify-between p-5" key={lease.id}>
                    <div>
                      <p className="font-medium">{lease.tenants?.full_name ?? 'Locataire'}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {[lease.units?.name ?? 'Unite non precise', lease.start_date].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{lease.rent_charges.length} echeance(s) generee(s)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{lease.monthly_rent} EUR</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Charges {lease.charges_amount} EUR</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-sm text-[var(--muted)]">Les baux seront ajoutes pendant la prochaine etape.</div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-white">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-lg font-semibold">Echeances de loyer</h2>
            </div>
            {rentCharges?.length ? (
              <div className="divide-y divide-[var(--line)]">
                {rentCharges.map((charge) => {
                  const paidTotal = charge.rent_payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                  return (
                    <div className="grid gap-4 p-5 lg:grid-cols-[1fr_280px]" key={charge.id}>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{charge.period_month.slice(0, 7)}</p>
                          <span className="rounded-full bg-[#f2f0ea] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{charge.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {[charge.leases?.tenants?.full_name, charge.leases?.units?.name].filter(Boolean).join(' · ') || 'Bail'}
                        </p>
                        <p className="mt-2 text-sm">
                          Du {Number(charge.total_due).toFixed(2)} EUR · Paye {paidTotal.toFixed(2)} EUR
                        </p>
                      </div>
                      <form action={addRentPaymentAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] lg:grid-cols-1">
                        <input name="locale" type="hidden" value={locale} />
                        <input name="property_id" type="hidden" value={property.id} />
                        <input name="rent_charge_id" type="hidden" value={charge.id} />
                        <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-2 text-sm" min="0" name="amount" placeholder="Montant" required step="0.01" type="number" />
                        <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-2 text-sm" name="paid_at" type="date" />
                        <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-2 text-sm" name="payment_method" defaultValue="bank_transfer">
                          <option value="bank_transfer">Virement</option>
                          <option value="cash">Especes</option>
                          <option value="cheque">Cheque</option>
                          <option value="card">Carte</option>
                          <option value="other">Autre</option>
                        </select>
                        <button className="focus-ring min-h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white" type="submit">
                          Ajouter paiement
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-sm text-[var(--muted)]">Creez un bail pour generer les echeances mensuelles.</div>
            )}
          </section>
        </div>

        <div className="grid gap-6">
          <form action={createUnitAction} className="rounded-lg border border-[var(--line)] bg-white p-5">
            <input name="locale" type="hidden" value={locale} />
            <input name="property_id" type="hidden" value={property.id} />
            <h2 className="text-lg font-semibold">Ajouter une unite</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Nom
                <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="name" placeholder="Chambre 1" required />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Type
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="unit_type" defaultValue="room">
                  <option value="room">Chambre</option>
                  <option value="apartment">Appartement</option>
                  <option value="other">Autre</option>
                </select>
              </label>
              <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
                Ajouter
              </button>
            </div>
          </form>

          <form action={createLeaseAction} className="rounded-lg border border-[var(--line)] bg-white p-5">
            <input name="locale" type="hidden" value={locale} />
            <input name="property_id" type="hidden" value={property.id} />
            <h2 className="text-lg font-semibold">Ajouter un bail</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Locataire
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="tenant_id" required>
                  <option value="">Choisir un locataire</option>
                  {(tenants ?? []).map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Unite
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="unit_id">
                  <option value="">Non precise</option>
                  {property.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Debut
                  <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="start_date" required type="date" />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Fin
                  <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="end_date" type="date" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-2 text-sm font-medium">
                  Loyer
                  <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" min="0" name="monthly_rent" required step="0.01" type="number" />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Charges
                  <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" min="0" name="charges_amount" step="0.01" type="number" />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Depot
                  <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" min="0" name="deposit_amount" step="0.01" type="number" />
                </label>
              </div>
              <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
                Creer le bail
              </button>
              {!(tenants ?? []).length ? (
                <p className="text-sm leading-6 text-[var(--muted)]">Ajoutez au moins un locataire avant de creer un bail.</p>
              ) : null}
            </div>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
