'use client';

import Link from 'next/link';

import {deletePropertyAction} from './actions';

export function PropertyActionsMenu({locale, propertyId}: {locale: string; propertyId: string}) {
  return (
    <details className="relative inline-block">
      <summary className="focus-ring flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-xl text-[var(--muted)] hover:bg-[#eaefed]">
        ...
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-[var(--line-soft)] bg-white p-1 text-left text-sm shadow-lg">
        <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/properties/${propertyId}`}>
          Voir
        </Link>
        <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/properties/${propertyId}/edit`}>
          Modifier
        </Link>
        <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/properties/${propertyId}/tenants`}>
          Gerer locataires
        </Link>
        <form
          action={deletePropertyAction}
          onSubmit={(event) => {
            if (!window.confirm('Confirmer la suppression de ce bien ? Cette action supprimera aussi les unites, baux et echeances associes.')) {
              event.preventDefault();
            }
          }}
        >
          <input name="locale" type="hidden" value={locale} />
          <input name="property_id" type="hidden" value={propertyId} />
          <button className="block w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff1f1]" type="submit">
            Supprimer
          </button>
        </form>
      </div>
    </details>
  );
}
