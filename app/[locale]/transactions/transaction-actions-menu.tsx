'use client';

import {useState} from 'react';
import type {ReactNode} from 'react';

import {deleteTransactionAction, updateTransactionAction} from './actions';

export type TransactionActionRow = {
  amount: number;
  category: string;
  date: string;
  description?: string | null;
  id: string;
  meta: string;
  notes?: string | null;
  paymentMethod?: string | null;
  propertyId?: string | null;
  taxCategoryId?: string | null;
  type: 'expense' | 'revenue';
  vendor?: string | null;
};

export type TransactionActionOption = {
  id: string;
  label: string;
};

function moneyValue(value: number) {
  return Number(value || 0).toFixed(2);
}

export function TransactionActionsMenu({
  locale,
  properties,
  row,
  taxCategories
}: {
  locale: string;
  properties: TransactionActionOption[];
  row: TransactionActionRow;
  taxCategories: TransactionActionOption[];
}) {
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="relative flex justify-end">
      <details
        className="relative inline-block"
        onToggle={(event) => {
          if (!event.currentTarget.open) {
            return;
          }

          document.querySelectorAll('details[data-transaction-actions]').forEach((details) => {
            if (details !== event.currentTarget) {
              (details as HTMLDetailsElement).open = false;
            }
          });
        }}
        data-transaction-actions
      >
        <summary className="focus-ring flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-[#33413f] hover:bg-[#eef2f0]">
          <span className="material-symbols-outlined text-xl">more_horiz</span>
        </summary>
        <div className="absolute right-0 z-50 mt-2 w-44 rounded-lg border border-[var(--line-soft)] bg-white p-1 text-sm shadow-xl">
          <button className="w-full rounded-md px-3 py-2 text-left hover:bg-[#f0f5f2]" onClick={() => setViewOpen(true)} type="button">
            Voir
          </button>
          <button className="w-full rounded-md px-3 py-2 text-left hover:bg-[#f0f5f2]" onClick={() => setEditOpen(true)} type="button">
            Modifier
          </button>
          <form
            action={deleteTransactionAction}
            onSubmit={(event) => {
              if (!window.confirm('Supprimer cette transaction ?')) {
                event.preventDefault();
              }
            }}
          >
            <input name="locale" type="hidden" value={locale} />
            <input name="type" type="hidden" value={row.type} />
            <input name="id" type="hidden" value={row.id} />
            <button className="w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff3f0]" type="submit">
              Supprimer
            </button>
          </form>
        </div>
      </details>

      {viewOpen ? (
        <Modal title="Detail de la transaction" onClose={() => setViewOpen(false)}>
          <dl className="grid gap-3 text-sm">
            <Info label="Type" value={row.type === 'revenue' ? 'Revenu' : 'Depense'} />
            <Info label="Date" value={row.date} />
            <Info label="Categorie" value={row.category} />
            <Info label="Bien / Locataire" value={row.meta} />
            <Info label="Montant" value={`${moneyValue(row.amount)} EUR`} />
            {row.vendor ? <Info label="Fournisseur" value={row.vendor} /> : null}
            {row.description ? <Info label="Description" value={row.description} /> : null}
            {row.notes ? <Info label="Note" value={row.notes} /> : null}
          </dl>
        </Modal>
      ) : null}

      {editOpen ? (
        <Modal title="Modifier la transaction" onClose={() => setEditOpen(false)}>
          <form action={updateTransactionAction} className="grid gap-4">
            <input name="locale" type="hidden" value={locale} />
            <input name="type" type="hidden" value={row.type} />
            <input name="id" type="hidden" value={row.id} />
            <label className="grid gap-2 text-sm text-[#3d4947]">
              Date
              <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3" defaultValue={row.date} name="date" required type="date" />
            </label>
            <label className="grid gap-2 text-sm text-[#3d4947]">
              Montant
              <span className="flex min-h-11 items-center rounded-md border border-[var(--line)] bg-white px-3">
                <input className="min-w-0 flex-1 border-0 bg-transparent outline-none" defaultValue={moneyValue(row.amount)} min="0.01" name="amount" required step="0.01" type="number" />
                <span className="text-sm font-semibold">EUR</span>
              </span>
            </label>
            {row.type === 'revenue' ? (
              <>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  Mode de paiement
                  <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3" defaultValue={row.paymentMethod ?? 'bank_transfer'} name="payment_method">
                    <option value="bank_transfer">Virement bancaire</option>
                    <option value="card">Carte bancaire</option>
                    <option value="cash">Especes</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Autre</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  Note
                  <textarea className="focus-ring min-h-24 rounded-md border border-[var(--line)] px-3 py-3" defaultValue={row.notes ?? ''} name="notes" />
                </label>
              </>
            ) : (
              <>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  Categorie
                  <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3" defaultValue={row.taxCategoryId ?? ''} name="tax_category_id">
                    <option value="">Autres frais</option>
                    {taxCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  Bien
                  <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3" defaultValue={row.propertyId ?? ''} name="property_id">
                    <option value="">Global</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  Fournisseur
                  <input autoComplete="off" className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3" defaultValue={row.vendor ?? ''} name="vendor" />
                </label>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  Description
                  <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3" defaultValue={row.description ?? ''} name="description" />
                </label>
              </>
            )}
            <div className="flex justify-end gap-3 border-t border-[var(--line-soft)] pt-4">
              <button className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-5 text-sm font-semibold" onClick={() => setEditOpen(false)} type="button">
                Annuler
              </button>
              <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Info({label, value}: {label: string; value: string}) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#53615f]">{label}</dt>
      <dd className="font-medium text-[#171d1c]">{value}</dd>
    </div>
  );
}

function Modal({children, onClose, title}: {children: ReactNode; onClose: () => void; title: string}) {
  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="focus-ring rounded-md p-2" onClick={onClose} type="button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
