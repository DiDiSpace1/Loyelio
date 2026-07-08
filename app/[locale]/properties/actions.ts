'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import type {SupabaseClient} from '@supabase/supabase-js';

import {localizedPath} from '@/lib/navigation';
import {getPropertyPhotoLimit} from '@/lib/billing/config';
import {canCreateResource} from '@/lib/billing/limits';
import {buildRentChargesForLease} from '@/lib/rent/charges';
import {getCurrentUserWorkspace} from '@/lib/workspace';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function moneyValue(formData: FormData, key: string) {
  const raw = value(formData, key).replace(',', '.');
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numericValue(formData: FormData, key: string) {
  const raw = value(formData, key).replace(',', '.');
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function imageFiles(formData: FormData) {
  return formData.getAll('photos').filter((entry): entry is File => entry instanceof File && entry.size > 0 && entry.type.startsWith('image/'));
}

async function uploadPropertyPhotos({
  files,
  propertyId,
  supabase,
  workspaceId
}: {
  files: File[];
  propertyId: string;
  supabase: SupabaseClient;
  workspaceId: string;
}) {
  for (const [index, file] of files.entries()) {
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const filePath = `workspace/${workspaceId}/properties/${propertyId}/${crypto.randomUUID()}.${extension}`;
    const {error: uploadError} = await supabase.storage.from('property-photos').upload(filePath, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false
    });

    if (uploadError) {
      return false;
    }

    const {error: photoError} = await supabase.from('property_photos').insert({
      file_name: file.name,
      file_path: filePath,
      is_cover: index === 0,
      mime_type: file.type || null,
      property_id: propertyId,
      size_bytes: file.size,
      sort_order: index,
      workspace_id: workspaceId
    });

    if (photoError) {
      await supabase.storage.from('property-photos').remove([filePath]);
      return false;
    }
  }

  return true;
}

export async function createPropertyAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const name = value(formData, 'name');
  const rentalMode = value(formData, 'rental_mode') || 'shared_rooms';
  const photos = imageFiles(formData);

  if (!name) {
    redirect(`${localizedPath(locale, '/properties')}?error=missing_name`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const planGate = await canCreateResource(supabase, workspaceId, 'properties');

  if (!planGate.allowed) {
    redirect(`${localizedPath(locale, '/properties')}?error=plan_limit`);
  }

  const photoLimit = getPropertyPhotoLimit(planGate.billing?.plan);

  if (photos.length > photoLimit) {
    redirect(`${localizedPath(locale, '/properties')}?error=photo_limit`);
  }

  const {data: property, error} = await supabase
    .from('properties')
    .insert({
      address_line1: value(formData, 'address_line1') || null,
      city: value(formData, 'city') || null,
      country_code: 'FR',
      charges_estimate: moneyValue(formData, 'charges_estimate') || null,
      deposit_estimate: moneyValue(formData, 'deposit_estimate') || null,
      monthly_rent_estimate: moneyValue(formData, 'monthly_rent_estimate') || null,
      name,
      occupancy_status: value(formData, 'occupancy_status') || 'vacant',
      postal_code: value(formData, 'postal_code') || null,
      property_type: value(formData, 'property_type') || 'apartment',
      rental_mode: rentalMode,
      surface_area: numericValue(formData, 'surface_area'),
      tax_regime: 'LMNP',
      workspace_id: workspaceId
    })
    .select('id')
    .single();

  if (error || !property) {
    redirect(`${localizedPath(locale, '/properties')}?error=create_failed`);
  }

  if (rentalMode === 'entire_place') {
    await supabase.from('units').insert({
      name: 'Logement entier',
      property_id: property.id,
      unit_type: 'apartment',
      workspace_id: workspaceId
    });
  }

  if (photos.length) {
    const uploaded = await uploadPropertyPhotos({files: photos, propertyId: property.id, supabase, workspaceId});

    if (!uploaded) {
      redirect(`${localizedPath(locale, `/properties/${property.id}`)}?error=photo_failed`);
    }
  }

  revalidatePath(localizedPath(locale, '/properties'));
  redirect(localizedPath(locale, `/properties/${property.id}`));
}

export async function updatePropertyAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const name = value(formData, 'name');
  const rentalMode = value(formData, 'rental_mode') || 'shared_rooms';

  if (!propertyId || !name) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=missing_property`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {error} = await supabase
    .from('properties')
    .update({
      address_line1: value(formData, 'address_line1') || null,
      city: value(formData, 'city') || null,
      name,
      occupancy_status: value(formData, 'occupancy_status') || 'vacant',
      postal_code: value(formData, 'postal_code') || null,
      property_type: value(formData, 'property_type') || 'apartment',
      rental_mode: rentalMode
    })
    .eq('id', propertyId)
    .eq('workspace_id', workspaceId);

  if (error) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=update_failed`);
  }

  revalidatePath(localizedPath(locale, '/properties'));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  redirect(localizedPath(locale, `/properties/${propertyId}`));
}

export async function deletePropertyAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');

  if (!propertyId) {
    redirect(`${localizedPath(locale, '/properties')}?error=missing_property`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: photos} = await supabase.from('property_photos').select('file_path').eq('property_id', propertyId).eq('workspace_id', workspaceId);
  const {error} = await supabase.from('properties').delete().eq('id', propertyId).eq('workspace_id', workspaceId);

  if (error) {
    redirect(`${localizedPath(locale, '/properties')}?error=delete_failed`);
  }

  const paths = (photos ?? []).map((photo: {file_path: string}) => photo.file_path);

  if (paths.length) {
    await supabase.storage.from('property-photos').remove(paths);
  }

  revalidatePath(localizedPath(locale, '/properties'));
  redirect(localizedPath(locale, '/properties'));
}

export async function createUnitAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const name = value(formData, 'name');
  const unitType = value(formData, 'unit_type') || 'room';

  if (!propertyId || !name) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=missing_unit`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {error} = await supabase.from('units').insert({
    name,
    property_id: propertyId,
    unit_type: unitType,
    workspace_id: workspaceId
  });

  if (error) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=unit_failed`);
  }

  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  redirect(localizedPath(locale, `/properties/${propertyId}`));
}

export async function createLeaseAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const tenantId = value(formData, 'tenant_id');
  const unitId = value(formData, 'unit_id');
  const startDate = value(formData, 'start_date');
  const endDate = value(formData, 'end_date');

  if (!propertyId || !tenantId || !startDate) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=missing_lease`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const chargesAmount = moneyValue(formData, 'charges_amount');
  const monthlyRent = moneyValue(formData, 'monthly_rent');
  const {data: lease, error} = await supabase
    .from('leases')
    .insert({
      charges_amount: chargesAmount,
      deposit_amount: moneyValue(formData, 'deposit_amount'),
      end_date: endDate || null,
      monthly_rent: monthlyRent,
      property_id: propertyId,
      start_date: startDate,
      status: 'active',
      tenant_id: tenantId,
      unit_id: unitId || null,
      workspace_id: workspaceId
    })
    .select('id')
    .single();

  if (error || !lease) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=lease_failed`);
  }

  const rentCharges = buildRentChargesForLease({
    chargesAmount,
    endDate: endDate || null,
    leaseId: lease.id,
    monthlyRent,
    startDate,
    workspaceId
  });

  if (rentCharges.length) {
    const {error: chargeError} = await supabase.from('rent_charges').insert(rentCharges);

    if (chargeError) {
      redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=charges_failed`);
    }
  }

  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  redirect(localizedPath(locale, `/properties/${propertyId}`));
}

export async function addRentPaymentAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const rentChargeId = value(formData, 'rent_charge_id');
  const amount = moneyValue(formData, 'amount');
  const paidAt = value(formData, 'paid_at') || new Date().toISOString().slice(0, 10);
  const paymentMethod = value(formData, 'payment_method') || 'bank_transfer';

  if (!propertyId || !rentChargeId || amount <= 0) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=payment_missing`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: charge, error: chargeError} = await supabase
    .from('rent_charges')
    .select('id, total_due')
    .eq('id', rentChargeId)
    .eq('workspace_id', workspaceId)
    .single();

  if (chargeError || !charge) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=charge_not_found`);
  }

  const {error: paymentError} = await supabase.from('rent_payments').insert({
    amount,
    paid_at: paidAt,
    payment_method: paymentMethod,
    rent_charge_id: rentChargeId,
    workspace_id: workspaceId
  });

  if (paymentError) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=payment_failed`);
  }

  const {data: payments, error: paymentsError} = await supabase
    .from('rent_payments')
    .select('amount')
    .eq('rent_charge_id', rentChargeId)
    .eq('workspace_id', workspaceId);

  if (paymentsError) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=payment_status_failed`);
  }

  const paidTotal = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const totalDue = Number(charge.total_due);
  const status = paidTotal <= 0 ? 'unpaid' : paidTotal >= totalDue ? 'paid' : 'partial';

  await supabase.from('rent_charges').update({status}).eq('id', rentChargeId).eq('workspace_id', workspaceId);

  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  revalidatePath(localizedPath(locale, '/dashboard'));
  redirect(localizedPath(locale, `/properties/${propertyId}`));
}
