'use client';

import {useState} from 'react';

const roomCountOptions = [1, 2, 3, 4, 5, 6, 7, 8];

function MoneyInput({label, name, placeholder}: {label: string; name: string; placeholder: string}) {
  return (
    <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
      {label}
      <span className="flex min-h-11 items-center rounded-md border border-[var(--line)] bg-white px-3">
        <input className="min-w-0 flex-1 border-0 bg-transparent text-sm font-normal outline-none" min="0" name={name} placeholder={placeholder} step="0.01" type="number" />
        <span className="text-sm font-semibold">EUR</span>
      </span>
    </label>
  );
}

export function PropertyCreateFields() {
  const [rentalMode, setRentalMode] = useState('entire_place');
  const [roomCount, setRoomCount] = useState(3);
  const isShared = rentalMode === 'shared_rooms';

  return (
    <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <h2 className="mb-5 flex items-center gap-3 text-base font-semibold">
        <span className="text-[var(--accent)]">▣</span>
        2. Aspects Financiers
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          Type de bien
          <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="property_type" defaultValue="studio">
            <option value="studio">Studio</option>
            <option value="apartment">Appartement</option>
            <option value="house">Maison</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          Surface habitable (m2)
          <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" min="0" name="surface_area" placeholder="35" step="0.01" type="number" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          Mode de location
          <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="rental_mode" value={rentalMode} onChange={(event) => setRentalMode(event.target.value)}>
            <option value="entire_place">Entier</option>
            <option value="shared_rooms">Colocation</option>
          </select>
        </label>
        {isShared ? (
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            Nombre de chambres
            <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="room_count" value={roomCount} onChange={(event) => setRoomCount(Number(event.target.value))}>
              {roomCountOptions.map((count) => (
                <option key={count} value={count}>
                  {count} chambre{count > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input name="room_count" type="hidden" value="1" />
        )}
      </div>

      {isShared ? (
        <div className="grid gap-4">
          {Array.from({length: roomCount}, (_, index) => {
            const roomNumber = index + 1;

            return (
              <div className="rounded-lg border border-[var(--line-soft)] bg-[#f8fbfa] p-4" key={roomNumber}>
                <h3 className="text-sm font-semibold text-[#171d1c]">Chambre {roomNumber}</h3>
                <input name="unit_name" type="hidden" value={`Chambre ${roomNumber}`} />
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <MoneyInput label="Loyer mensuel HC" name="unit_monthly_rent_estimate" placeholder="450" />
                  <MoneyInput label="Charges provisionnelles" name="unit_charges_estimate" placeholder="50" />
                  <MoneyInput label="Depot de garantie" name="unit_deposit_estimate" placeholder="900" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <MoneyInput label="Loyer mensuel HC" name="monthly_rent_estimate" placeholder="850" />
          <MoneyInput label="Charges provisionnelles" name="charges_estimate" placeholder="60" />
          <MoneyInput label="Depot de garantie" name="deposit_estimate" placeholder="1700" />
        </div>
      )}
    </section>
  );
}
