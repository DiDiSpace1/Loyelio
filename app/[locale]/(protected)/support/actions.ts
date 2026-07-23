'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getCurrentUserWorkspace} from '@/lib/workspace';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function supportHref(locale: string, key: 'error' | 'success', status: string) {
  return `${localizedPath(locale, '/support')}?${key}=${status}`;
}

export async function createPrioritySupportTicketAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const category = value(formData, 'category');
  const subject = value(formData, 'subject');
  const message = value(formData, 'message');

  if (!['technical', 'billing', 'documents', 'tax', 'other'].includes(category) || !subject || !message) {
    redirect(supportHref(locale, 'error', 'missing_fields'));
  }

  const {profile, supabase, user, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const plan = hasPaidAccess(billing) ? normalizeBillingPlan(billing?.plan) : 'free';

  if (plan !== 'plus' && plan !== 'portfolio') {
    redirect(supportHref(locale, 'error', 'upgrade_required'));
  }

  const {data: ticket, error} = await supabase
    .from('support_tickets')
    .insert({
      category,
      created_by: user.id,
      message,
      notification_status: 'pending',
      plan,
      status: 'open',
      subject,
      workspace_id: workspaceId
    })
    .select('id')
    .single<{id: string}>();

  if (error || !ticket) {
    console.error('Priority support ticket insert failed', {error, workspaceId});
    redirect(supportHref(locale, 'error', 'create_failed'));
  }

  let notificationStatus = 'failed';
  const apiKey = process.env.RESEND_KEY;

  if (apiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      body: JSON.stringify({
        from: process.env.RENT_REMINDER_FROM_EMAIL || 'Loyelio <noreply@loyelio.com>',
        reply_to: user.email,
        subject: `[${plan.toUpperCase()}][${ticket.id.slice(0, 8)}] ${subject}`,
        text: [
          `Ticket: ${ticket.id}`,
          `Plan: ${plan}`,
          `Workspace: ${workspaceId}`,
          `Customer: ${profile.full_name || user.email || user.id}`,
          `Email: ${user.email || '-'}`,
          `Category: ${category}`,
          '',
          message
        ].join('\n'),
        to: process.env.SUPPORT_EMAIL || 'support@loyelio.com'
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST'
    });
    notificationStatus = response.ok ? 'sent' : 'failed';
  }

  const admin = createSupabaseAdminClient();
  const {error: notificationError} = await admin.from('support_tickets').update({notification_status: notificationStatus}).eq('id', ticket.id).eq('created_by', user.id);

  if (notificationError) {
    console.error('Priority support notification status update failed', {error: notificationError, ticketId: ticket.id});
  }

  revalidatePath(localizedPath(locale, '/support'));
  redirect(supportHref(locale, 'success', notificationStatus === 'sent' ? 'created' : 'created_notification_failed'));
}
