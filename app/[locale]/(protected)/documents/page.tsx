import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {ConfirmSubmitButton} from '@/components/app/confirm-submit-button';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {deleteDocumentAction} from './actions';
import {DocumentActionDetails} from './document-action-details';
import {DocumentTypeFilter} from './document-type-filter';
import {UploadDocumentModal} from './upload-document-modal';

type PropertyOption = {
  id: string;
  name: string;
};

type TenantOption = {
  id: string;
  full_name: string;
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
  tenants: {
    full_name: string;
  } | null;
  units: {
    name: string;
  } | null;
};

type DocumentWithUrl = DocumentRow & {
  downloadUrl: string | null;
  viewUrl: string | null;
};

type DocumentsPageProps = {
  searchParams: Promise<{
    error?: string;
    property_id?: string;
    q?: string;
    type?: string;
    year?: string;
  }>;
};

const DOCUMENT_TYPES = [
  {className: 'bg-[#d9fbf4] text-[#00685f]', labelKey: 'lease', value: 'lease'},
  {className: 'bg-[#dde1ff] text-[#3755c3]', labelKey: 'rentReceipt', value: 'rent_receipt'},
  {className: 'bg-[#ffdbce] text-[#924628]', labelKey: 'invoice', value: 'invoice'},
  {className: 'bg-[#dee4e1] text-[#3d4947]', labelKey: 'tax', value: 'tax'}
];

const FOLDER_TYPES = [
  {iconClassName: 'bg-[#89f5e7] text-[#00685f]', labelKey: 'lease', value: 'lease'},
  {iconClassName: 'bg-[#ffdbce] text-[#924628]', labelKey: 'invoice', value: 'invoice'},
  {iconClassName: 'bg-[#dde1ff] text-[#3755c3]', labelKey: 'rentReceipt', value: 'rent_receipt'},
  {iconClassName: 'bg-[#dee4e1] text-[#3d4947]', labelKey: 'tax', value: 'tax'}
];

function formatBytes(bytes: number | null) {
  if (!bytes) {
    return '0 KB';
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function yearRange(value: string | undefined) {
  const year = value ? Number.parseInt(value, 10) : null;

  if (!year || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return null;
  }

  return {
    end: `${year + 1}-01-01`,
    start: `${year}-01-01`,
    year
  };
}

function typeMeta(type: string) {
  return DOCUMENT_TYPES.find((item) => item.value === type) ?? DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1];
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {day: '2-digit', month: 'short', year: 'numeric'}).format(new Date(value));
}

function FileTypeIcon({type}: {type: string}) {
  const color = typeMeta(type).value;
  const className =
    color === 'lease'
      ? 'text-[#00685f]'
      : color === 'rent_receipt'
        ? 'text-[#3755c3]'
        : color === 'invoice'
          ? 'text-[#924628]'
          : 'text-[#3d4947]';

  return (
    <svg aria-hidden="true" className={`h-5 w-5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24">
      <path d="M6 3.75h8.25L18 7.5v12.75H6V3.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M14 4v4h4M8.5 12h7M8.5 15h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="m20 20-4.2-4.2M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M7 3.75h10v16.5l-2-1.25-2 1.25-2-1.25-2 1.25-2-1.25V3.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export default async function DocumentsPage({searchParams}: DocumentsPageProps) {
  const t = await getTranslations('documents');
  const common = await getTranslations('common');
  const locale = await getLocale();
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const selectedPropertyId = params.property_id ?? '';
  const selectedType = FOLDER_TYPES.some((folder) => folder.value === params.type) ? params.type ?? '' : '';
  const currentYear = new Date().getFullYear();
  const selectedYear = yearRange(params.year ?? String(currentYear));
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: properties} = await supabase.from('properties').select('id, name').eq('workspace_id', workspaceId).order('name', {ascending: true}).returns<PropertyOption[]>();
  const {data: tenants} = await supabase.from('tenants').select('id, full_name').eq('workspace_id', workspaceId).order('full_name', {ascending: true}).returns<TenantOption[]>();
  let documentQuery = supabase
    .from('documents')
    .select('id, document_type, file_name, file_path, mime_type, size_bytes, created_at, properties(name), units(name), tenants(full_name)')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false});

  if (selectedPropertyId) {
    documentQuery = documentQuery.eq('property_id', selectedPropertyId);
  }

  if (selectedYear) {
    documentQuery = documentQuery.gte('created_at', selectedYear.start).lt('created_at', selectedYear.end);
  }

  if (query) {
    documentQuery = documentQuery.ilike('file_name', `%${query}%`);
  }

  const {data: documents, error: documentsError} = await documentQuery.limit(50).returns<DocumentRow[]>();
  const documentsWithUrls: DocumentWithUrl[] = await Promise.all(
    (documents ?? []).map(async (document) => {
      const [{data: viewData}, {data: downloadData}] = await Promise.all([
        supabase.storage.from('documents').createSignedUrl(document.file_path, 60 * 10),
        supabase.storage.from('documents').createSignedUrl(document.file_path, 60 * 10, {
          download: document.file_name
        })
      ]);

      return {
        ...document,
        downloadUrl: downloadData?.signedUrl ?? null,
        viewUrl: viewData?.signedUrl ?? null
      };
    })
  );
  const folderCounts = new Map<string, number>();

  for (const document of documents ?? []) {
    folderCounts.set(document.document_type, (folderCounts.get(document.document_type) ?? 0) + 1);
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-5 border-b border-[var(--line-soft)] pb-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[#171d1c] shadow-sm hover:bg-[#f0f5f2]" href="/documents/quittance">
            <ReceiptIcon />
            {t('generateReceipt')}
          </Link>
          <UploadDocumentModal locale={locale} properties={properties ?? []} tenants={tenants ?? []} />
        </div>
      </div>

      {documentsError ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          {t('errors.loadFailed')}
        </div>
      ) : null}

      {params.error === 'plan_limit' ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          {t('errors.planLimit')}
        </div>
      ) : null}

      {params.error === 'storage_limit' ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          {t('errors.storageLimit')}
        </div>
      ) : null}

      {params.error === 'invoice_amount' ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          {t('errors.invoiceAmount')}
        </div>
      ) : null}

      {params.error === 'document_relation_required' ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          {t('errors.relationRequired')}
        </div>
      ) : null}

      <form className="mb-8 flex flex-wrap gap-3 border-b border-[var(--line-soft)] pb-5">
        <label className="relative min-w-0 flex-[1_1_240px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            <SearchIcon />
          </span>
          <input className="focus-ring min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 pl-10 text-sm" defaultValue={query} name="q" placeholder={t('searchPlaceholder')} />
        </label>
        <label className="min-w-0 flex-[1_1_140px]">
          <span className="sr-only">{t('year')}</span>
          <input className="focus-ring min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm" defaultValue={selectedYear?.year ?? ''} max="2100" min="2000" name="year" placeholder={t('year')} type="number" />
        </label>
        <label className="min-w-0 flex-[1_1_170px]">
          <span className="sr-only">{t('type')}</span>
          <select className="focus-ring min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm" data-document-type-select defaultValue={selectedType} name="type">
            <option value="">{common('all')}</option>
            <option value="lease">{t('types.lease')}</option>
            <option value="invoice">{t('types.invoice')}</option>
            <option value="rent_receipt">{t('types.rentReceipt')}</option>
            <option value="tax">{t('types.tax')}</option>
          </select>
        </label>
        <label className="min-w-0 flex-[1_1_220px]">
          <span className="sr-only">{t('property')}</span>
          <select className="focus-ring min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm" defaultValue={selectedPropertyId} name="property_id">
            <option value="">{t('allProperties')}</option>
            {(properties ?? []).map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>
        <button className="focus-ring min-h-11 flex-[0_0_auto] rounded-lg border border-[var(--line)] bg-white px-5 text-sm font-semibold text-[#171d1c] hover:bg-[#f0f5f2]" type="submit">
          {common('filter')}
        </button>
      </form>

      <DocumentTypeFilter
        folders={FOLDER_TYPES.map((folder) => ({
          countLabel: t('fileCount', {count: folderCounts.get(folder.value) ?? 0}),
          iconClassName: folder.iconClassName,
          label: t(`types.${folder.labelKey}`),
          value: folder.value
        }))}
        initialType={selectedType}
      />

      <section className="mb-8 overflow-visible rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-5 py-4">
          <h2 className="text-base font-semibold text-[#171d1c]">{t('recentDocuments')}</h2>
          {selectedType || query || selectedPropertyId || selectedYear ? (
            <Link className="text-xs font-semibold text-[var(--accent)] hover:underline" href="/documents">
              {t('viewAll')}
            </Link>
          ) : null}
        </div>
        {documentsWithUrls.length ? (
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead className="border-b border-[var(--line-soft)] bg-[#f0f5f2] text-[11px] font-semibold uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3">{t('table.fileName')}</th>
                  <th className="px-5 py-3">{t('table.category')}</th>
                  <th className="px-5 py-3">{t('property')}</th>
                  <th className="px-5 py-3">{common('date')}</th>
                  <th className="px-5 py-3">{t('table.size')}</th>
                  <th className="px-5 py-3 text-right">{common('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-soft)]">
                {documentsWithUrls.map((document) => {
                  const meta = typeMeta(document.document_type);

                  return (
                    <tr className="transition hover:bg-[#f8fbfa]" data-document-row data-document-type={document.document_type} hidden={Boolean(selectedType && selectedType !== document.document_type)} key={document.id}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <FileTypeIcon type={document.document_type} />
                          <div>
                            <p className="text-sm font-medium text-[#171d1c]">{document.file_name}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{[document.units?.name, document.tenants?.full_name].filter(Boolean).join(' - ')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded px-2 py-1 text-[11px] font-semibold ${meta.className}`}>{t(`types.${meta.labelKey}`)}</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--muted)]">{document.properties?.name ?? t('global')}</td>
                      <td className="px-5 py-4 text-sm tabular-nums text-[var(--muted)]">{formatDate(document.created_at, locale)}</td>
                      <td className="px-5 py-4 text-sm tabular-nums text-[var(--muted)]">{formatBytes(document.size_bytes)}</td>
                      <td className="px-5 py-4 text-right">
                        <DocumentActionDetails>
                          {document.viewUrl ? (
                            <a className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={document.viewUrl} rel="noreferrer" target="_blank">
                              {common('view')}
                            </a>
                          ) : null}
                          {document.downloadUrl ? (
                            <a className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={document.downloadUrl}>
                              {common('download')}
                            </a>
                          ) : null}
                          <form action={deleteDocumentAction}>
                            <input name="locale" type="hidden" value={locale} />
                            <input name="document_id" type="hidden" value={document.id} />
                            <ConfirmSubmitButton
                              cancelLabel={common('cancel')}
                              className="block w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff1f1]"
                              confirmLabel={common('delete')}
                              description={t('deleteDescription')}
                              title={t('deleteTitle')}
                            >
                              {common('delete')}
                            </ConfirmSubmitButton>
                          </form>
                        </DocumentActionDetails>
                      </td>
                    </tr>
                  );
                })}
                <tr data-document-empty hidden={documentsWithUrls.some((document) => !selectedType || document.document_type === selectedType)}>
                  <td className="px-5 py-10 text-center text-sm text-[var(--muted)]" colSpan={6}>
                    {t('empty')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-[var(--muted)]">{t('empty')}</div>
        )}
      </section>
    </>
  );
}
