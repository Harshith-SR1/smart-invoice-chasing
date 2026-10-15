/**
 * POST /api/webhooks/resend
 *
 * Receives Resend delivery status webhooks.
 *
 * Security:
 *   - Verifies the Svix signature Resend attaches to every delivery.
 *   - Rejects payloads with missing or invalid signatures (401).
 *   - Uses raw request body for signature verification (no JSON.parse beforehand).
 *
 * Idempotency:
 *   - Inserts into message_webhook_events with UNIQUE(provider_message_id, event_type).
 *   - On conflict (duplicate delivery), returns 200 without re-processing.
 *
 * State advancement rules:
 *   - Only advance to a "later" delivery state; never downgrade (e.g., delivered → bounced
 *     because an old webhook arrived out of order).
 *   - State order: queued < sending < sent < delivered | bounced | failed
 *
 * Boundaries:
 *   - A webhook event NEVER changes invoice balances or marks payments as verified.
 *   - 'delivered' only means the provider accepted delivery, NOT that a person read it.
 *   - Open tracking is intentionally not implemented (unreliable and privacy-sensitive).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { getWebhookSecret } from '@/lib/resend';

// Delivery state ordering for safe advancement
const STATE_ORDER: Record<string, number> = {
  draft: 0,
  queued: 1,
  sending: 2,
  sent: 3,
  delivered: 4,
  bounced: 4,
  failed: 4,
};

export async function POST(req: NextRequest) {
  // ── 1. Read raw body (required for HMAC verification) ─────────────────────
  const rawBody = await req.text();

  // ── 2. Verify Svix/Resend signature ───────────────────────────────────────
  const webhookSecret = getWebhookSecret();

  // If webhook secret is not configured or empty, reject and disable webhook processing safely
  if (!webhookSecret || webhookSecret.trim() === '' || webhookSecret.includes('placeholder') || webhookSecret.includes('whsec_your_webhook')) {
    console.warn('[webhook] RESEND_WEBHOOK_SECRET is not configured — webhook processing is disabled.');
    return NextResponse.json(
      { error: 'Webhook processing is not configured on this server.' },
      { status: 503 }
    );
  }

  const svixId = req.headers.get('svix-id') ?? '';
  const svixTs = req.headers.get('svix-timestamp') ?? '';
  const svixSig = req.headers.get('svix-signature') ?? '';

  if (!svixId || !svixTs || !svixSig) {
    return NextResponse.json({ error: 'Missing webhook signature headers.' }, { status: 401 });
  }

  const isValid = await verifySvixSignature(webhookSecret, svixId, svixTs, svixSig, rawBody);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  // ── 3. Parse payload ───────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const eventType = (payload.type as string) || '';
  const data = (payload.data as Record<string, unknown>) || {};
  const providerMessageId = (data.email_id as string) || (data.id as string) || '';

  if (!eventType || !providerMessageId) {
    return NextResponse.json({ error: 'Missing event type or email_id.' }, { status: 400 });
  }

  // ── 4. Look up our message record by provider ID ──────────────────────────
  const svc = createServiceRoleClient();

  const { data: message } = await svc
    .from('messages')
    .select('id, workspace_id, invoice_id, delivery_status')
    .eq('provider_message_id', providerMessageId)
    .limit(1)
    .maybeSingle();

  // If the message does not exist in our database (e.g. Resend dashboard test webhook or external email),
  // acknowledge receipt (HTTP 200) so provider knows signature verified, without throwing a NOT NULL error on workspace_id.
  if (!message) {
    return NextResponse.json({
      ok: true,
      tracked: false,
      message: 'Webhook authenticated; provider message ID is not associated with an internal message row.',
    });
  }

  // ── 5. Idempotent insert of webhook event ──────────────────────────────────
  const { error: insertError } = await svc
    .from('message_webhook_events')
    .insert({
      workspace_id: message.workspace_id,
      message_id: message.id,
      provider_message_id: providerMessageId,
      event_type: eventType,
      // Store minimal useful fields — not the entire raw payload
      event_data: extractEventData(eventType, data),
    });

  if (insertError) {
    if (insertError.code === '23505') {
      // Duplicate event — already processed
      return NextResponse.json({
        ok: true,
        duplicate: true,
        tracked: true,
        messageId: message.id,
      });
    }
    console.error('[webhook] Failed to insert event:', insertError);
    return NextResponse.json({ error: 'Failed to record webhook event.' }, { status: 500 });
  }

  // ── 6. Advance message delivery state (never downgrade) ───────────────────
  const newStatus = mapEventToStatus(eventType);
  if (newStatus && shouldAdvanceState(message.delivery_status, newStatus)) {
    const now = new Date().toISOString();
    const updateFields: Record<string, unknown> = { delivery_status: newStatus };

    if (newStatus === 'delivered') {
      updateFields.delivered_at = now;
      if (message.invoice_id) {
        await svc.from('collection_events').insert({
          workspace_id: message.workspace_id,
          invoice_id: message.invoice_id,
          type: 'reminder_delivered',
          title: 'Follow-up Email Delivered',
          description: `Email confirmed delivered to recipient mailbox. Provider ref: ${providerMessageId}`,
          badge: 'Delivered',
          actor: 'system',
          metadata: {
            provider_message_id: providerMessageId,
            message_id: message.id,
            event_type: eventType,
          },
        });
      }
    } else if (newStatus === 'bounced' || newStatus === 'failed') {
      updateFields.bounced_at = now;
      updateFields.failure_reason = extractBounceReason(data);
      if (message.invoice_id) {
        await svc.from('collection_events').insert({
          workspace_id: message.workspace_id,
          invoice_id: message.invoice_id,
          type: 'reminder_failed',
          title: 'Follow-up Delivery Failed / Bounced',
          description: `Email delivery failed: ${extractBounceReason(data)} (Provider ref: ${providerMessageId})`,
          badge: 'Bounced',
          actor: 'system',
          metadata: {
            provider_message_id: providerMessageId,
            message_id: message.id,
            failure_reason: extractBounceReason(data),
          },
        });
      }
    }

    await svc
      .from('messages')
      .update(updateFields)
      .eq('id', message.id);
  }

  return NextResponse.json({
    ok: true,
    tracked: true,
    messageId: message.id,
    deliveryStatus: newStatus || message.delivery_status,
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapEventToStatus(eventType: string): string | null {
  switch (eventType) {
    case 'email.sent':       return 'sent';
    case 'email.delivered':  return 'delivered';
    case 'email.bounced':    return 'bounced';
    case 'email.complained': return 'bounced'; // spam complaint
    case 'email.delivery_delayed': return null; // transient — don't change status
    default:                 return null;
  }
}

function shouldAdvanceState(current: string, next: string): boolean {
  const currentOrder = STATE_ORDER[current] ?? -1;
  const nextOrder = STATE_ORDER[next] ?? -1;
  // Only advance — never go backwards
  return nextOrder > currentOrder;
}

function extractEventData(eventType: string, data: Record<string, unknown>): Record<string, unknown> {
  // Store only the minimum necessary fields
  return {
    event_type: eventType,
    created_at: data.created_at,
    to: data.to,
    bounce_reason: data.reason,
    bounce_description: data.description,
  };
}

function extractBounceReason(data: Record<string, unknown>): string {
  const reason = (data.reason as string) || (data.description as string) || 'Bounce/failure from provider';
  return String(reason).slice(0, 500);
}

/**
 * Verify Svix HMAC-SHA256 signature.
 *
 * Resend uses Svix for webhook delivery. The signature is computed over:
 *   `${svix-id}.${svix-timestamp}.${body}`
 *
 * The svix-signature header may contain multiple space-separated "v1,<base64>" entries.
 * We accept the event if ANY of them matches.
 */
async function verifySvixSignature(
  secret: string,
  svixId: string,
  svixTs: string,
  svixSig: string,
  body: string
): Promise<boolean> {
  try {
    // Reject timestamps more than 5 minutes old
    const tsMs = Number(svixTs) * 1000;
    if (Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
      return false;
    }

    const signingPayload = `${svixId}.${svixTs}.${body}`;

    // Secret is "whsec_<base64>" — strip the prefix
    const secretBase64 = secret.startsWith('whsec_')
      ? secret.slice('whsec_'.length)
      : secret;

    const secretBytes = Uint8Array.from(atob(secretBase64), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );

    const encoder = new TextEncoder();
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signingPayload));
    const computedSig = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // svix-signature may be "v1,<sig1> v1,<sig2>"
    const providedSigs = svixSig
      .split(' ')
      .map((s) => s.split(',')[1])
      .filter(Boolean);

    return providedSigs.includes(computedSig);
  } catch (err) {
    console.error('[webhook] Signature verification error:', err);
    return false;
  }
}
