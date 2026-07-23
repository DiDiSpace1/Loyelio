const DEFAULT_FROM_EMAIL = 'Loyelio <noreply@loyelio.com>';

export type RentReminderEmailInput = {
  amount: number;
  dueDate: string;
  ownerName: string;
  propertyLabel: string;
  reminderMonth: string;
  tenantEmail: string;
  tenantName: string;
};

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatMoney(value: number) {
  return `${Number(value).toLocaleString('fr-FR')} EUR`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {dateStyle: 'long', timeZone: 'UTC'}).format(parseIsoDate(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {month: 'long', timeZone: 'UTC', year: 'numeric'}).format(parseIsoDate(value));
}

export function rentReminderEmailContent(input: RentReminderEmailInput) {
  const monthLabel = formatMonth(input.reminderMonth);
  const dueDate = formatDate(input.dueDate);
  const amount = formatMoney(input.amount);
  const subject = `Rappel de loyer - ${monthLabel}`;
  const text = [
    `Bonjour ${input.tenantName},`,
    '',
    `Nous vous rappelons que le loyer de ${monthLabel} pour ${input.propertyLabel} est à régler le ${dueDate}.`,
    `Montant attendu : ${amount}.`,
    '',
    `Merci de procéder au paiement selon les modalités prévues dans votre bail.`,
    '',
    `Cordialement,`,
    input.ownerName
  ].join('\n');
  const html = `
    <p>Bonjour ${input.tenantName},</p>
    <p>Nous vous rappelons que le loyer de <strong>${monthLabel}</strong> pour <strong>${input.propertyLabel}</strong> est à régler le <strong>${dueDate}</strong>.</p>
    <p>Montant attendu : <strong>${amount}</strong>.</p>
    <p>Merci de procéder au paiement selon les modalités prévues dans votre bail.</p>
    <p>Cordialement,<br>${input.ownerName}</p>
  `;

  return {html, subject, text};
}

export async function sendRentReminderEmail(input: RentReminderEmailInput) {
  const apiKey = process.env.RESEND_KEY;

  if (!apiKey) {
    throw new Error('Missing RESEND_KEY.');
  }

  if (!input.tenantEmail) {
    throw new Error('Tenant email is missing.');
  }

  const content = rentReminderEmailContent(input);
  const response = await fetch('https://api.resend.com/emails', {
    body: JSON.stringify({
      from: process.env.RENT_REMINDER_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      html: content.html,
      subject: content.subject,
      text: content.text,
      to: input.tenantEmail
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });
  const result = (await response.json().catch(() => ({}))) as {id?: string; message?: string};

  if (!response.ok) {
    throw new Error(result.message || `Resend returned ${response.status}.`);
  }

  return result.id ?? null;
}
