'use client';

export function DeleteTenantButton() {
  return (
    <button
      className="block w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff1f1]"
      onClick={(event) => {
        const confirmed = window.confirm('Supprimer ce locataire supprimera aussi ses donnees historiques liees aux baux, loyers et documents. Continuer ?');

        if (!confirmed) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      Supprimer
    </button>
  );
}
