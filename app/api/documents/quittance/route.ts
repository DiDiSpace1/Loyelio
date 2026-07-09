import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {NextResponse} from 'next/server';
import PDFDocument from 'pdfkit';

import {canCreateResource} from '@/lib/billing/limits';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export const runtime = 'nodejs';

type PropertyForReceipt = {
  address_line1: string | null;
  city: string | null;
  id: string;
  name: string;
  postal_code: string | null;
};

type TenantForReceipt = {
  full_name: string;
  id: string;
};

function moneyValue(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]+/g, '-').replace(/-+/g, '-').slice(0, 120);
}

function monthStart(month: string) {
  return `${month}-01`;
}

function formatMonth(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {month: 'long', year: 'numeric'}).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

function formatMoney(amount: number) {
  return `${amount.toLocaleString('fr-FR', {maximumFractionDigits: 2, minimumFractionDigits: 2})} EUR`;
}

function pdfText(text: string | null | undefined) {
  return (text || '-').replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '?');
}

function paymentLabel(method: string) {
  if (method === 'cash') {
    return 'Especes';
  }

  if (method === 'cheque') {
    return 'Cheque';
  }

  if (method === 'card') {
    return 'Carte bancaire';
  }

  if (method === 'other') {
    return 'Autre';
  }

  return 'Virement bancaire';
}

function propertyAddress(property: PropertyForReceipt) {
  return [property.address_line1, [property.postal_code, property.city].filter(Boolean).join(' ')].filter(Boolean).join('\n') || property.name;
}

async function buildQuittancePdf(input: {
  amount: number;
  charges: number;
  ownerName: string;
  paidAt: string;
  paymentMethod: string;
  periodMonth: string;
  property: PropertyForReceipt;
  tenant: TenantForReceipt | null;
}) {
  const doc = new PDFDocument({margin: 56, size: 'A4'});
  const chunks: Buffer[] = [];
  const total = input.amount + input.charges;

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  doc.fillColor('#171d1c').fontSize(23).text('Quittance de loyer', {align: 'center'});
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#3d4947').text(`Periode: ${formatMonth(input.periodMonth)}`, {align: 'center'});
  doc.moveDown(2);

  doc.fillColor('#171d1c').fontSize(12).text('Proprietaire');
  doc.fontSize(11).fillColor('#3d4947').text(pdfText(input.ownerName));
  doc.moveDown();

  doc.fillColor('#171d1c').fontSize(12).text('Locataire');
  doc.fontSize(11).fillColor('#3d4947').text(pdfText(input.tenant?.full_name));
  doc.moveDown();

  doc.fillColor('#171d1c').fontSize(12).text('Bien loue');
  doc.fontSize(11).fillColor('#3d4947').text(pdfText(propertyAddress(input.property)));
  doc.moveDown(1.5);

  doc.fillColor('#171d1c').fontSize(13).text('Detail du paiement');
  doc.moveDown(0.5);
  doc.fontSize(11);
  doc.text(`Loyer hors charges: ${formatMoney(input.amount)}`);
  doc.text(`Charges: ${formatMoney(input.charges)}`);
  doc.fontSize(12).fillColor('#00685f').text(`Total recu: ${formatMoney(total)}`);
  doc.fillColor('#3d4947').fontSize(11).text(`Date de paiement: ${input.paidAt}`);
  doc.text(`Mode de paiement: ${paymentLabel(input.paymentMethod)}`);
  doc.moveDown(1.5);

  doc.fillColor('#171d1c').fontSize(11).text(
    pdfText(`Je soussigne ${input.ownerName || 'le proprietaire'} reconnais avoir recu de ${input.tenant?.full_name ?? 'le locataire'} la somme de ${formatMoney(total)} au titre du loyer et des charges pour la periode ${formatMonth(input.periodMonth)}.`)
  );
  doc.moveDown(2);
  doc.text(pdfText(`Fait a ${input.property.city ?? '-'}, le ${new Date().toLocaleDateString('fr-FR')}`));
  doc.moveDown(1.5);
  doc.text('Signature du proprietaire');
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor('#171d1c').text(pdfText(input.ownerName || '-'));

  doc.end();

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  return Buffer.concat(chunks);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ownerName = String(body.ownerName ?? '').trim();
    const propertyId = String(body.propertyId ?? '').trim();
    const tenantId = String(body.tenantId ?? '').trim();
    const periodMonth = String(body.periodMonth ?? '').trim();
    const paidAt = String(body.paidAt ?? '').trim();
    const paymentMethod = String(body.paymentMethod ?? 'bank_transfer').trim();
    const amount = moneyValue(body.amount);
    const charges = moneyValue(body.charges);

    if (!propertyId || !ownerName || !/^\d{4}-\d{2}$/.test(periodMonth) || !paidAt || amount <= 0 || charges < 0) {
      return NextResponse.json({error: 'Veuillez completer les informations de quittance.'}, {status: 400});
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: {user}
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({error: 'Non authentifie.'}, {status: 401});
    }

    const {data: profile, error: profileError} = await supabase.from('profiles').select('default_workspace_id').eq('id', user.id).single();

    if (profileError || !profile?.default_workspace_id) {
      return NextResponse.json({error: 'Espace de travail introuvable.'}, {status: 400});
    }

    const workspaceId = profile.default_workspace_id as string;
    const planGate = await canCreateResource(supabase, workspaceId, 'documents');

    if (!planGate.allowed) {
      return NextResponse.json({error: 'Votre plan ne permet pas de creer plus de documents.'}, {status: 403});
    }

    const {data: property, error: propertyError} = await supabase
      .from('properties')
      .select('id, name, address_line1, postal_code, city')
      .eq('id', propertyId)
      .eq('workspace_id', workspaceId)
      .single()
      .returns<PropertyForReceipt>();

    if (propertyError || !property) {
      return NextResponse.json({error: 'Bien introuvable pour cet espace.'}, {status: 404});
    }

    let tenant: TenantForReceipt | null = null;

    if (tenantId) {
      const {data: tenantData, error: tenantError} = await supabase.from('tenants').select('id, full_name').eq('id', tenantId).eq('workspace_id', workspaceId).single().returns<TenantForReceipt>();

      if (tenantError || !tenantData) {
        return NextResponse.json({error: 'Locataire introuvable pour cet espace.'}, {status: 404});
      }

      tenant = tenantData;
    }

    const pdf = await buildQuittancePdf({amount, charges, ownerName, paidAt, paymentMethod, periodMonth, property, tenant});
    const documentId = randomUUID();
    const fileName = safeFileName(`Quittance_${periodMonth}_${tenant?.full_name ?? property.name}.pdf`);
    const year = new Date().getUTCFullYear();
    const filePath = `workspace/${workspaceId}/documents/${year}/${documentId}-${fileName}`;
    const {error: uploadError} = await supabase.storage.from('documents').upload(filePath, new Blob([new Uint8Array(pdf)], {type: 'application/pdf'}), {
      contentType: 'application/pdf',
      upsert: false
    });

    if (uploadError) {
      return NextResponse.json({error: "Impossible d'enregistrer le PDF."}, {status: 500});
    }

    const {error: insertError} = await supabase.from('documents').insert({
      document_type: 'rent_receipt',
      extracted_amount: amount + charges,
      extracted_date: paidAt,
      file_name: fileName,
      file_path: filePath,
      id: documentId,
      mime_type: 'application/pdf',
      period_month: monthStart(periodMonth),
      property_id: property.id,
      tenant_id: tenant?.id ?? null,
      unit_id: null,
      size_bytes: pdf.byteLength,
      workspace_id: workspaceId
    });

    if (insertError) {
      await supabase.storage.from('documents').remove([filePath]);
      return NextResponse.json({error: 'Impossible de creer le document quittance.'}, {status: 500});
    }

    const {data: signed} = await supabase.storage.from('documents').createSignedUrl(filePath, 60 * 10, {
      download: fileName
    });

    revalidatePath('/documents');
    revalidatePath('/documents/quittance');

    return NextResponse.json({
      documentId,
      downloadUrl: signed?.signedUrl ?? null
    });
  } catch (error) {
    console.error('Quittance route failed', error);
    return NextResponse.json({error: 'Impossible de generer la quittance.'}, {status: 500});
  }
}
