import {BailManagerView} from './bail-manager-view';
import {BailListView} from './bail-list-view';

type BailPageProps = {
  searchParams: Promise<{
    property_id?: string;
    q?: string;
  }>;
};

export default async function BailPage({searchParams}: BailPageProps) {
  const params = await searchParams;

  if (params.property_id) {
    return <BailManagerView selectedPropertyId={params.property_id} />;
  }

  return <BailListView query={params.q} />;
}
