import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {PageHeader} from '@/components/app/page-header';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createExpenseAction, deleteDocumentAction, uploadDocumentAction} from './actions';

type PropertyOption = {
  id: string;
  name: string;
};

type DocumentRow = {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  properties: {
    name: string;
  } | null;
};

type DocumentWithUrl = DocumentRow & {
  signedUrl: string | null;
};

type ExpenseRow = {
  id: string;
  amount: number;
  currency: string;
  expense_date: string;
  receipt_status: string;
  vendor: string | null;
  tax_categories: {
    label: string;
  } | null;
  properties: {
    name: string;
  } | null;
};

type TaxCategory = {
  id: string;
  label: string;
};

type DocumentsPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function formatBytes(bytes: number | null) {
  if (!bytes) {
    return '0 KB';
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function DocumentsPage({searchParams}: DocumentsPageProps) {
  const t = await getTranslations('documents');
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: properties} = await supabase
    .from('properties')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .order('name', {ascending: true})
    .returns<PropertyOption[]>();
  const {data: documents, error: documentsError} = await supabase
    .from('documents')
    .select('id, document_type, file_name, file_path, mime_type, size_bytes, created_at, properties(name)')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false})
    .limit(20)
    .returns<DocumentRow[]>();
  const {data: expenses, error: expensesError} = await supabase
    .from('expenses')
    .select('id, amount, currency, expense_date, receipt_status, vendor, tax_categories(label), properties(name)')
    .eq('workspace_id', workspaceId)
    .order('expense_date', {ascending: false})
    .limit(20)
    .returns<ExpenseRow[]>();
  const {data: categories} = await supabase
    .from('tax_categories')
    .select('id, label')
    .eq('country_code', 'FR')
    .eq('tax_regime', 'LMNP')
    .eq('active', true)
    .order('sort_order', {ascending: true})
    .returns<TaxCategory[]>();
  const documentsWithUrls: DocumentWithUrl[] = await Promise.all(
    (documents ?? []).map(async (document) => {
      const {data} = await supabase.storage.from('documents').createSignedUrl(document.file_path, 60 * 10, {
        download: document.file_name
      });

      return {
        ...document,
        signedUrl: data?.signedUrl ?? null
      };
    })
  );

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {documentsError || expensesError ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Impossible de charger les documents ou depenses. Lancez la migration Supabase de la phase documents.
        </div>
      ) : null}

      {params.error === 'plan_limit' ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Le plan gratuit inclut 10 documents. Passez a Pro depuis les parametres pour televerser plus de fichiers.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          <section className="rounded-lg border border-[var(--line)] bg-white">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-lg font-semibold">Documents recents</h2>
            </div>
            {documentsWithUrls.length ? (
              <div className="divide-y divide-[var(--line)]">
                {documentsWithUrls.map((document) => (
                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" key={document.id}>
                    <div>
                      <p className="font-medium">{document.file_name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {[document.document_type, document.properties?.name, formatBytes(document.size_bytes)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#f2f0ea] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{document.mime_type ?? 'file'}</span>
                      {document.signedUrl ? (
                        <a className="focus-ring rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:bg-[#f2f0ea]" href={document.signedUrl}>
                          Telecharger
                        </a>
                      ) : null}
                      <form action={deleteDocumentAction}>
                        <input name="locale" type="hidden" value={locale} />
                        <input name="document_id" type="hidden" value={document.id} />
                        <button className="focus-ring rounded-md border border-[#efd0ca] px-3 py-2 text-xs font-semibold text-[#9d2f1f] hover:bg-[#fff4f1]" type="submit">
                          Supprimer
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-[var(--muted)]">Aucun document pour le moment.</div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-white">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-lg font-semibold">Depenses recentes</h2>
            </div>
            {expenses?.length ? (
              <div className="divide-y divide-[var(--line)]">
                {expenses.map((expense) => (
                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" key={expense.id}>
                    <div>
                      <p className="font-medium">{expense.vendor || expense.tax_categories?.label || 'Depense'}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {[expense.expense_date, expense.properties?.name, expense.receipt_status].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {Number(expense.amount).toFixed(2)} {expense.currency}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-[var(--muted)]">Aucune depense pour le moment.</div>
            )}
          </section>
        </div>

        <div className="grid gap-6">
          <form action={uploadDocumentAction} className="rounded-lg border border-[var(--line)] bg-white p-5">
            <input name="locale" type="hidden" value={locale} />
            <h2 className="text-lg font-semibold">Televerser un document</h2>
            <div className="mt-5 grid gap-4">
              <input accept=".pdf,image/png,image/jpeg" className="focus-ring rounded-md border border-[var(--line)] px-3 py-3 text-sm" name="file" required type="file" />
              <label className="grid gap-2 text-sm font-medium">
                Type
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="document_type" defaultValue="invoice">
                  <option value="invoice">Facture</option>
                  <option value="lease">Bail</option>
                  <option value="rent_receipt">Quittance</option>
                  <option value="insurance">Assurance</option>
                  <option value="tax">Fiscal</option>
                  <option value="other">Autre</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Bien
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="property_id">
                  <option value="">Non precise</option>
                  {(properties ?? []).map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Mois
                <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="period_month" type="date" />
              </label>
              <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
                Televerser
              </button>
            </div>
          </form>

          <form action={createExpenseAction} className="rounded-lg border border-[var(--line)] bg-white p-5">
            <input name="locale" type="hidden" value={locale} />
            <h2 className="text-lg font-semibold">Ajouter une depense</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Date
                <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="expense_date" required type="date" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Montant
                <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" min="0" name="amount" required step="0.01" type="number" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Fournisseur
                <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="vendor" placeholder="Plombier, assurance..." />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Categorie
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="tax_category_id">
                  <option value="">A classer</option>
                  {(categories ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Bien
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="property_id">
                  <option value="">Non precise</option>
                  {(properties ?? []).map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Justificatif
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="document_id">
                  <option value="">Aucun document lie</option>
                  {documentsWithUrls.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.file_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Description
                <textarea className="focus-ring min-h-20 rounded-md border border-[var(--line)] px-3 py-3" name="description" />
              </label>
              <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
                Ajouter
              </button>
            </div>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
