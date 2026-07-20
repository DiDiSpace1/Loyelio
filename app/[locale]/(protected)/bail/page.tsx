import {BailManagerView} from './bail-manager-view';
import {BailListView} from './bail-list-view';

type BailPageProps = {
  searchParams: Promise<{
    property_id?: string;
    q?: string;
    tenant_id?: string;
  }>;
};

export default async function BailPage({searchParams}: BailPageProps) {
  const params = await searchParams;

  if (params.property_id) {
    return <BailManagerView selectedPropertyId={params.property_id} selectedTenantId={params.tenant_id} />;
  }

  return <BailListView query={params.q} />;
}
