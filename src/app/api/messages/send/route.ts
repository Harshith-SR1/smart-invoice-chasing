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
import {
  checkAndReserveDispatchRateLimit,
  releaseRateLimitReservation,
} from '@/lib/rateLimiter';

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

  // Verify caller is authorized for the workspace (owner or active member)
  const { data: wsOwner } = await supabaseUser
    .from('workspaces')
    .select('id')
    .eq('id', msg.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  let isAuthorized = Boolean(wsOwner);
  if (!isAuthorized) {
    const { data: member } = await supabaseUser
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', msg.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (member) isAuthorized = true;
  }

  if (!isAuthorized) {
    return errorResponse(403, 'Access denied to target workspace.');
  }

  // ── 6. Collection-state guards ─────────────────────────────────────────────
  const outstanding = Number(invoice.outstanding_amount ?? invoice.amount);

  if (invoice.status === 'draft') {
    await markFailed(msg.id, 'Invoice is in draft status. Dispatch blocked.');
    return errorResponse(409, 'Invoice is in draft status. Only finalized invoices may be dispatched.');
  }

  if (invoice.status === 'paid' || outstanding <= 0) {
    await markFailed(msg.id, 'Invoice is already paid. Sending stopped.');
    return errorResponse(409, 'Invoice is already settled. Email dispatch blocked.');
  }

  if (invoice.status === 'disputed') {
    await markFailed(msg.id, 'Invoice is in disputed state. Automation blocked.');
    return errorResponse(409, 'Invoice is disputed. Automated email blocked — resolve dispute first.');
  }

  if (invoice.status === 'cancelled' || invoice.status === 'void') {
    await markFailed(msg.id, `Invoice is in ${invoice.status} state. Collection stopped.`);
    return errorResponse(409, `Invoice is ${invoice.status}. Email dispatch is permanently blocked.`);
  }

  if (invoice.status === 'held' || invoice.status === 'on_hold') {
    await markFailed(msg.id, 'Invoice is currently on hold. Chasing paused.');
    return errorResponse(409, 'Invoice is on hold. Automated customer communication is paused.');
  }

  // Guard against sending reminders while an unverified customer payment claim is pending review
  const { data: pendingClaims } = await supabaseUser
    .from('payments')
    .select('id')
    .eq('workspace_id', msg.workspace_id)
    .eq('invoice_id', invoice.id)
    .eq('source', 'customer_claim')
    .eq('status', 'pending_verification')
    .limit(1);

  if (pendingClaims && pendingClaims.length > 0) {
    await markFailed(msg.id, 'Invoice has an unverified payment claim pending review. Sending stopped.');
    return errorResponse(409, 'Invoice has an unverified payment claim awaiting verification. Email dispatch blocked until claim is reviewed.');
  }

  // Guard: Recheck confirmed payments to ensure balance is genuinely outstanding
  const { data: confirmedPayments } = await supabaseUser
    .from('payments')
    .select('amount')
    .eq('workspace_id', msg.workspace_id)
    .eq('invoice_id', invoice.id)
    .eq('status', 'confirmed');

  const totalConfirmed = (confirmedPayments || []).reduce(
    (sum: number, p: any) => sum + Number(p.amount || 0),
    0
  );

  if (totalConfirmed >= Number(invoice.amount)) {
    await markFailed(msg.id, 'Invoice is fully settled by confirmed payments. Sending stopped.');
    return errorResponse(409, 'Invoice is fully settled by confirmed payments. Email dispatch blocked.');
  }

  // Guard: Recheck active decision in public.ai_decisions (if present)
  const { data: decision } = await supabaseUser
    .from('ai_decisions')
    .select('id, status, recommended_action')
    .eq('workspace_id', msg.workspace_id)
    .eq('invoice_id', invoice.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (decision) {
    if (decision.status === 'rejected' || decision.status === 'dismissed') {
      await markFailed(msg.id, 'Collection decision for this invoice was dismissed or rejected.');
      return errorResponse(409, 'The collection decision for this invoice was dismissed or rejected.');
    }
    if (decision.status === 'executed') {
      await markFailed(msg.id, 'Collection decision for this invoice was already executed.');
      return errorResponse(409, 'The collection decision for this invoice has already been executed.');
    }
    if (decision.recommended_action === 'STOP') {
      await markFailed(msg.id, 'Collection decision action is STOP. Dispatch blocked.');
      return errorResponse(409, 'The collection decision for this invoice is STOP. Dispatch blocked.');
    }
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

  // ── 8b. Server-enforced rate limit per workspace ──────────────────────────
  // Target: No more than 10 outbound dispatch attempts per minute per workspace.
  // Uses atomic distributed reservation across Vercel instances to prevent race conditions.
  const svcClient = createServiceRoleClient();
  const rateLimit = await checkAndReserveDispatchRateLimit(msg.workspace_id, msg.id, user.id, svcClient);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Rate limit exceeded: maximum ${rateLimit.limit} email dispatches per minute per workspace. Please retry in ${rateLimit.retryAfterSeconds}s.`,
        retryAfter: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetMs / 1000)),
        },
      }
    );
  }

  // ── 9. Atomic state transition: queued → sending ───────────────────────────
  // The partial UNIQUE INDEX on (invoice_id, status) WHERE status IN ('queued','sending')
  // means only one concurrent request can win this update.
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
    // Release the reserved rate limit slot since lock failed
    releaseRateLimitReservation(msg.workspace_id);
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

  // If there is an active decision in ai_decisions for this invoice, advance it to executed
  if (decision && decision.id) {
    await svcClient
      .from('ai_decisions')
      .update({
        status: 'executed',
        executed_at: now,
      })
      .eq('id', decision.id)
      .eq('workspace_id', msg.workspace_id);
  }

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

  return NextResponse.json(
    {
      ok: true,
      messageId: msg.id,
      providerMessageId,
      status: 'sent',
    },
    {
      headers: {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetMs / 1000)),
      },
    }
  );
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
