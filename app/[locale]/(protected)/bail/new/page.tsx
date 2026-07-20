import {BailManagerView} from '../bail-manager-view';

type NewBailPageProps = {
  searchParams: Promise<{
    property_id?: string;
    tenant_id?: string;
  }>;
};

export default async function NewBailPage({searchParams}: NewBailPageProps) {
  const params = await searchParams;
  return <BailManagerView selectedPropertyId={params.property_id} selectedTenantId={params.tenant_id} />;
}
