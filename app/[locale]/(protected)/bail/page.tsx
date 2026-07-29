import {BailManagerView} from './bail-manager-view';
import {BailListView} from './bail-list-view';

type BailPageProps = {
  searchParams: Promise<{
    property_id?: string;
    q?: string;
    renew_from?: string;
    status?: string;
    tenant_id?: string;
  }>;
};

export default async function BailPage({searchParams}: BailPageProps) {
  const params = await searchParams;

  if (params.property_id) {
    return <BailManagerView renewalLeaseId={params.renew_from} selectedPropertyId={params.property_id} selectedTenantId={params.tenant_id} />;
  }

  return <BailListView query={params.q} status={params.status} />;
}
