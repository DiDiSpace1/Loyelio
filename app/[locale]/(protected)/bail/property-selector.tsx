'use client';

import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';

import {localizedPath} from '@/lib/navigation';

type PropertyOption = {
  id: string;
  name: string;
};

export function PropertySelector({
  locale,
  properties,
  selectedPropertyId,
  selectedTenantId = ''
}: {
  locale: string;
  properties: PropertyOption[];
  selectedPropertyId?: string;
  selectedTenantId?: string;
}) {
  const router = useRouter();
  const t = useTranslations('bail');

  return (
    <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
      {t('property')}
      <select
        className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-normal"
        defaultValue={selectedPropertyId ?? ''}
        name="property_picker"
        onChange={(event) => {
          const propertyId = event.target.value;
          const params = new URLSearchParams();

          if (propertyId) {
            params.set('property_id', propertyId);
          }

          if (selectedTenantId) {
            params.set('tenant_id', selectedTenantId);
          }

          const path = params.size ? `/bail?${params.toString()}` : '/bail';
          router.push(localizedPath(locale, path as `/${string}`));
        }}
      >
        <option value="">{t('propertyPlaceholder')}</option>
        {properties.map((property) => (
          <option key={property.id} value={property.id}>
            {property.name}
          </option>
        ))}
      </select>
    </label>
  );
}
