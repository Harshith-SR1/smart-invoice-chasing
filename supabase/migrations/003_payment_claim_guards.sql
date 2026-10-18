-- ============================================================
-- Migration 003: Payment Claim Concurrency & Integrity Guards (CLM-002, DEC-002)
--
-- Security & Concurrency Architecture:
-- 1. Idempotent partial unique index on public.payments:
--    Ensures at most ONE pending unverified claim can exist per invoice per workspace.
--    Prevents concurrent race conditions when duplicate claims are submitted.
-- 2. State transition safety:
--    Payment claims must be explicitly in 'pending_verification' before they can be
--    confirmed or deleted (rejected).
-- ============================================================

-- Step 1: Ensure partial unique index on active pending claims per invoice
CREATE UNIQUE INDEX IF NOT EXISTS payments_pending_claim_unique
  ON public.payments (workspace_id, invoice_id)
  WHERE status = 'pending_verification' AND source = 'customer_claim';
