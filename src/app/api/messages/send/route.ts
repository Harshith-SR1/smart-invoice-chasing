/**
 * POST /api/messages/send
 *
 * Secure server-side email dispatch via Resend.
 *
 * Security model:
 *   1. Require authenticated user (via session cookie).
 *   2. Accept ONLY a message_row_id from the request — never trust client-supplied
 *      recipient, subject, body, or authorization.
 *   3. Load canonical invoice + message records from Supabase (with RLS active).
 *   4. Verify workspace membership, message approval, and invoice collection state.
 *   5. Perform an atomic state transition (queued → sending) to prevent duplicate sends.
 *   6. Call Resend. Record provider_message_id and advance state to 'sent' or 'failed'.
 *   7. Write a 'reminder_sent' collection_event only on confirmed provider acceptance.
 *   8. Never expose API keys, service-role credentials, or internal errors to the client.
 *
 * Idempotency / duplicate-send protection:
 *   - DB UNIQUE index on (invoice_id, delivery_status) WHERE status IN ('queued','sending')
 *     prevents two concurrent requests from progressing the same invoice simultaneously.
 *   - The state must be exactly 'queued' before dispatch. Any other state is rejected.
 *   - After dispatch, state is advanced immediately — partial failures are recorded, not retried silently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { getResendClient, getFromAddress, formatFromHeader } from '@/lib/resend';
import { sanitiseMessage, plainTextToHtml } from '@/lib/emailSanitiser';

type JsonBody = { message_row_id?: string; subject_override?: string; body_override?: string };

export async function POST(req: NextRequest) {
  // ── 1. Parse request ───────────────────────────────────────────────────────
  let body: JsonBody;
  try {
    body = (await req.json()) as JsonBody;
  } catch {
    return errorResponse(400, 'Request body must be valid JSON.');
  }

  const { message_row_id } = body;
  if (!message_row_id || typeof message_row_id !== 'string' || !message_row_id.trim()) {
    return errorResponse(400, 'message_row_id is required.');
  }

  // ── 2. Authenticate user ───────────────────────────────────────────────────
  const supabaseUser = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

  if (authError || !user) {
    return errorResponse(401, 'Authentication required.');
  }

  // ── 3. Load message row (RLS ensures workspace membership) ─────────────────
  const { data: msg, error: msgError } = await supabaseUser
    .from('messages')
    .select('id, workspace_id, invoice_id, subject, body, delivery_status, sender_name, sender_email')
    .eq('id', message_row_id)
    .single();

  if (msgError || !msg) {
    return errorResponse(404, 'Message not found or access denied.');
  }

  // ── 4. Verify the message is in 'queued' state ─────────────────────────────
  if (msg.delivery_status !== 'queued') {
    return errorResponse(409, `Cannot send: message is in state '${msg.delivery_status}'. Only 'queued' messages may be dispatched.`);
  }

  // ── 5. Load canonical invoice state ────────────────────────────────────────
  const { data: invoice, error: invError } = await supabaseUser
    .from('invoices')
    .select('id, workspace_id, customer_name, customer_email, outstanding_amount, status, amount, reminders_sent')
    .eq('id', msg.invoice_id)
    .single();

  if (invError || !invoice) {
    return errorResponse(404, 'Associated invoice not found.');
  }

  // Verify message and invoice belong to the same workspace
  if (msg.workspace_id !== invoice.workspace_id) {
    return errorResponse(403, 'Cross-workspace access denied.');
  }

  // ── 6. Collection-state guards ─────────────────────────────────────────────
  const outstanding = Number(invoice.outstanding_amount ?? invoice.amount);

  if (invoice.status === 'paid' || outstanding <= 0) {
    await markFailed(msg.id, 'Invoice is already paid. Sending stopped.');
    return errorResponse(409, 'Invoice is already settled. Email dispatch blocked.');
  }

  if (invoice.status === 'disputed') {
    await markFailed(msg.id, 'Invoice is in disputed state. Automation blocked.');
    return errorResponse(409, 'Invoice is disputed. Automated email blocked — resolve dispute first.');
  }

  // ── 7. Validate Resend is configured ──────────────────────────────────────
  let resend: ReturnType<typeof getResendClient>;
  let fromAddress: string;

  try {
    resend = getResendClient();
    fromAddress = getFromAddress();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Email provider is not configured.';
    console.error('[send] Resend not configured:', message);
    return errorResponse(503, 'Email dispatch is not available. Contact the system administrator.');
  }

  // ── 8. Sanitise recipient and message content ──────────────────────────────
  // Use overrides only if they are the exact same text the UI showed the user.
  // The canonical recipient always comes from the invoice DB record — never the client.
  const subjectToSend = body.subject_override?.trim() || msg.subject;
  const bodyToSend = body.body_override?.trim() || msg.body;

  const sanitised = sanitiseMessage(
    invoice.customer_email,
    invoice.customer_name,
    subjectToSend,
    bodyToSend
  );

  if (!sanitised.ok) {
    return errorResponse(422, sanitised.error);
  }

  // ── 9. Atomic state transition: queued → sending ───────────────────────────
  // The partial UNIQUE INDEX on (invoice_id, status) WHERE status IN ('queued','sending')
  // means only one concurrent request can win this update.
  const svcClient = createServiceRoleClient();
  const { error: lockError } = await svcClient
    .from('messages')
    .update({
      delivery_status: 'sending',
      sent_by: user.id,
      queued_at: new Date().toISOString(),
    })
    .eq('id', msg.id)
    .eq('delivery_status', 'queued'); // guard: only advance from 'queued'

  if (lockError) {
    // Unique index violation → another request already in flight
    if (lockError.code === '23505') {
      return errorResponse(409, 'A send request for this message is already in progress.');
    }
    console.error('[send] Lock error:', lockError);
    return errorResponse(500, 'Failed to reserve message for sending.');
  }

  // ── 10. Dispatch via Resend ────────────────────────────────────────────────
  let providerMessageId: string | undefined;

  try {
    const result = await resend.emails.send({
      from: formatFromHeader(fromAddress, msg.sender_name),
      to: [`${sanitised.message.toName} <${sanitised.message.toEmail}>`],
      subject: sanitised.message.subject,
      html: plainTextToHtml(sanitised.message.body),
      text: sanitised.message.body,
    });

    if (result.error || !result.data?.id) {
      throw new Error(result.error?.message || 'Unknown Resend API error');
    }

    providerMessageId = result.data.id;
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Unknown provider error';
    console.error('[send] Resend dispatch failed:', reason);

    // Mark as failed — do NOT leave in 'sending' state
    await svcClient
      .from('messages')
      .update({
        delivery_status: 'failed',
        failure_reason: reason.slice(0, 500), // cap length
      })
      .eq('id', msg.id);

    return errorResponse(502, 'Email dispatch failed. The message has been marked as failed. Please retry.');
  }

  // ── 11. Record successful send ─────────────────────────────────────────────
  const now = new Date().toISOString();

  await svcClient
    .from('messages')
    .update({
      delivery_status: 'sent',
      provider_message_id: providerMessageId,
      sent_at: now,
    })
    .eq('id', msg.id);

  // Write collection event ONLY after confirmed provider acceptance
  await svcClient
    .from('collection_events')
    .insert({
      workspace_id: msg.workspace_id,
      invoice_id: msg.invoice_id,
      type: 'reminder_sent',
      title: sanitised.message.subject,
      description: `Follow-up email dispatched to ${sanitised.message.toEmail}. Provider ref: ${providerMessageId}`,
      badge: 'Sent via Email',
      actor: 'ai',
      metadata: {
        provider_message_id: providerMessageId,
        sent_by: user.id,
        recipient_email: sanitised.message.toEmail,
      },
    });

  // Update invoice reminder count + last contact date
  const currentReminders = typeof invoice.reminders_sent === 'number' ? invoice.reminders_sent : 0;
  await svcClient
    .from('invoices')
    .update({
      reminders_sent: currentReminders + 1,
      last_contact_date: now.split('T')[0],
    })
    .eq('id', msg.invoice_id);

  return NextResponse.json({
    ok: true,
    messageId: msg.id,
    providerMessageId,
    status: 'sent',
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function errorResponse(status: number, detail: string) {
  return NextResponse.json({ ok: false, error: detail }, { status });
}

async function markFailed(messageId: string, reason: string) {
  try {
    const svc = createServiceRoleClient();
    await svc
      .from('messages')
      .update({ delivery_status: 'failed', failure_reason: reason })
      .eq('id', messageId)
      .eq('delivery_status', 'queued');
  } catch {
    // Best-effort
  }
}
