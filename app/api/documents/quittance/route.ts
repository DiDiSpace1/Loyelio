import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {NextResponse} from 'next/server';

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

function escapePdfText(value: string) {
  return pdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}

function wrapPdfText(value: string, maxLength = 70) {
  const words = pdfText(value).replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : ['-'];
}

function textCommand(text: string, x: number, y: number, size = 11, bold = false) {
  return `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
}

function buildQuittancePdf(input: {
  amount: number;
  charges: number;
  ownerName: string;
  paidAt: string;
  paymentMethod: string;
  periodMonth: string;
  property: PropertyForReceipt;
  tenant: TenantForReceipt | null;
}) {
  const total = input.amount + input.charges;
  const lines: string[] = [];
  let y = 770;

  const add = (text: string, options?: {bold?: boolean; gap?: number; size?: number; x?: number}) => {
    lines.push(textCommand(text, options?.x ?? 56, y, options?.size ?? 11, options?.bold));
    y -= options?.gap ?? 18;
  };

  add('Quittance de loyer', {bold: true, gap: 22, size: 22, x: 190});
  add(`Periode: ${formatMonth(input.periodMonth)}`, {gap: 34, x: 218});
  add('Proprietaire', {bold: true, gap: 16, size: 12});
  add(input.ownerName, {gap: 26});
  add('Locataire', {bold: true, gap: 16, size: 12});
  add(input.tenant?.full_name ?? '-', {gap: 26});
  add('Bien loue', {bold: true, gap: 16, size: 12});

  for (const line of wrapPdfText(propertyAddress(input.property), 72)) {
    add(line, {gap: 16});
  }

  y -= 10;
  add('Detail du paiement', {bold: true, gap: 22, size: 13});
  add(`Loyer hors charges: ${formatMoney(input.amount)}`);
  add(`Charges: ${formatMoney(input.charges)}`);
  add(`Total recu: ${formatMoney(total)}`, {bold: true, gap: 26, size: 12});
  add(`Date de paiement: ${input.paidAt}`);
  add(`Mode de paiement: ${paymentLabel(input.paymentMethod)}`, {gap: 28});

  for (const line of wrapPdfText(`Je soussigne ${input.ownerName || 'le proprietaire'} reconnais avoir recu de ${input.tenant?.full_name ?? 'le locataire'} la somme de ${formatMoney(total)} au titre du loyer et des charges pour la periode ${formatMonth(input.periodMonth)}.`, 86)) {
    add(line, {gap: 16});
  }

  y -= 16;
  add(`Fait a ${input.property.city ?? '-'}, le ${new Date().toLocaleDateString('fr-FR')}`, {gap: 34});
  add('Signature du proprietaire', {gap: 22});
  add(input.ownerName || '-', {bold: true, size: 13});

  const content = lines.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
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

    const pdf = buildQuittancePdf({amount, charges, ownerName, paidAt, paymentMethod, periodMonth, property, tenant});
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
