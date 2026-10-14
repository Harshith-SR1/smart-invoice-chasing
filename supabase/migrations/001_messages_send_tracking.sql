-- ============================================================
-- Migration 001: Email Dispatch Tracking
-- Extends public.messages with idempotent send workflow fields.
-- Adds public.message_webhook_events for Resend delivery tracking.
-- ============================================================

-- 1. Extend public.messages
-- Widen delivery_status to cover the full dispatch lifecycle.
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_delivery_status_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_delivery_status_check
  CHECK (delivery_status IN ('draft', 'queued', 'sending', 'sent', 'delivered', 'bounced', 'failed'));

-- Track which Supabase user initiated the send.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Resend's own message ID (opaque string, e.g. "re_aBcDeFg").
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Reason for failure (provider error, block, bounce reason, etc.).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Timestamps for the dispatch lifecycle steps.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;

-- Prevent two concurrent requests from sending the same approved draft.
-- We use a partial unique index: only one row per invoice that is actively
-- in flight (queued or sending). Once the state moves on, the constraint
-- no longer applies.
CREATE UNIQUE INDEX IF NOT EXISTS messages_inflight_unique
  ON public.messages (invoice_id, delivery_status)
  WHERE delivery_status IN ('queued', 'sending');

-- 2. Webhook events table
-- Stores raw (trimmed) webhook payloads from Resend.
-- Idempotency: unique on (provider_message_id, event_type).
CREATE TABLE IF NOT EXISTS public.message_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  provider_message_id TEXT NOT NULL,
  event_type TEXT NOT NULL,          -- e.g. 'email.delivered', 'email.bounced'
  event_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_message_id, event_type)  -- idempotent webhook processing
);

ALTER TABLE public.message_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for webhook events"
  ON public.message_webhook_events FOR ALL
  USING (false)           -- no direct row access for anon/user roles
  WITH CHECK (false);     -- only service role (via SECURITY DEFINER) can write

-- 3. Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_messages_provider_id
  ON public.messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_id
  ON public.message_webhook_events (provider_message_id);

COMMENT ON TABLE public.message_webhook_events IS
  'Raw Resend webhook delivery events. Idempotent on (provider_message_id, event_type).';
