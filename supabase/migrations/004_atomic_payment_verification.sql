-- ============================================================
-- Migration 004: Atomic Payment Claim Verification RPC (BATCH 2D)
--
-- Security & Transaction Model:
-- 1. Single Database Transaction:
--    All operations (claim transition, authoritative balance recalculation,
--    promise fulfillment, and collection event logging) occur within a single
--    PostgreSQL transaction. Any failure triggers a complete automatic rollback.
--
-- 2. Authorization & Tenant Isolation:
--    Caller must be authenticated and authorized for the target workspace.
--    If auth.uid() is provided, public.is_workspace_member(p_workspace_id, auth.uid())
--    is strictly verified before any state reads or mutations occur.
--
-- 3. Row-Level Concurrency Control:
--    SELECT ... FOR UPDATE locks the pending claim row and invoice row,
--    serializing concurrent requests and preventing race conditions.
--
-- 4. Authoritative Financial Accounting:
--    Invoice balance is recalculated directly via SUM() over all confirmed
--    payments in public.payments. Unverified claims are NEVER counted as payments.
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_payment_claim_atomic(
  p_workspace_id UUID,
  p_invoice_id UUID,
  p_is_verified BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice RECORD;
  v_claim RECORD;
  v_prior_confirmed_paid NUMERIC(12, 2);
  v_authoritative_outstanding NUMERIC(12, 2);
  v_total_confirmed_paid NUMERIC(12, 2);
  v_current_outstanding NUMERIC(12, 2);
  v_new_outstanding NUMERIC(12, 2);
  v_new_status TEXT;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Step 1a: Validate parameters explicitly (prevent NULL from entering rejection branch)
  IF p_is_verified IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'invalid_parameter',
      'error', 'Parameter p_is_verified must be an explicit boolean (true or false) and cannot be null.'
    );
  END IF;

  -- Step 1b: Caller Authorization Check
  -- Explicitly reject authenticated callers if auth.uid() is missing or not a workspace member.
  IF auth.role() = 'authenticated' THEN
    IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id, auth.uid()) THEN
      RETURN jsonb_build_object(
        'success', false,
        'errorCode', 'unauthorized',
        'error', 'Caller is not authorized to access or modify records in this workspace.'
      );
    END IF;
  ELSIF auth.role() = 'service_role' THEN
    -- Trusted server-side caller (service_role key); proceed
    NULL;
  ELSE
    -- Anonymous or any other caller role
    IF auth.uid() IS NOT NULL THEN
      IF NOT public.is_workspace_member(p_workspace_id, auth.uid()) THEN
        RETURN jsonb_build_object(
          'success', false,
          'errorCode', 'unauthorized',
          'error', 'Caller is not authorized to access or modify records in this workspace.'
        );
      END IF;
    ELSE
      -- Unauthenticated call without a valid identity
      RETURN jsonb_build_object(
        'success', false,
        'errorCode', 'unauthorized',
        'error', 'Authentication required to execute payment claim verification.'
      );
    END IF;
  END IF;

  -- Step 2: Lock and verify invoice belongs to the specified workspace
  SELECT *
    INTO v_invoice
    FROM public.invoices
   WHERE id = p_invoice_id
     AND workspace_id = p_workspace_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'invoice_not_found',
      'error', 'Invoice not found in the specified workspace or access denied.'
    );
  END IF;

  -- Verify invoice state: Cancelled or void invoices cannot accept payment confirmation
  IF p_is_verified AND v_invoice.status IN ('cancelled', 'void') THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'invoice_cancelled',
      'error', format('Invoice %s is in "%s" status. Payment confirmation is not permitted on cancelled or void invoices.',
        v_invoice.invoice_number, v_invoice.status)
    );
  END IF;

  -- Step 3: Lock and retrieve the unverified pending payment claim
  SELECT *
    INTO v_claim
    FROM public.payments
   WHERE workspace_id = p_workspace_id
     AND invoice_id = p_invoice_id
     AND source = 'customer_claim'
     AND status = 'pending_verification'
   ORDER BY created_at DESC
   LIMIT 1
     FOR UPDATE;

  -- Step 4: Reject missing, rejected, or already-resolved claims
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'no_pending_claim',
      'error', 'No pending payment claim found for this invoice. Verification cannot proceed without an active unverified claim.'
    );
  END IF;

  -- Step 5: Route Confirmation vs Rejection
  IF p_is_verified THEN
    -- 5a. Authoritative Ledger Calculation & Consistency Check (Confirmation only)
    SELECT COALESCE(SUM(amount), 0)
      INTO v_prior_confirmed_paid
      FROM public.payments
     WHERE workspace_id = p_workspace_id
       AND invoice_id = p_invoice_id
       AND status = 'confirmed';

    -- Detect existing ledger overpayment at currency precision (NUMERIC 12,2)
    IF v_prior_confirmed_paid > v_invoice.amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'errorCode', 'ledger_overpayment_detected',
        'error', format('Confirmed payments (%s %s) exceed invoice total (%s %s). Ledger is inconsistent; manual reconciliation required.',
          COALESCE(v_invoice.currency, 'INR'), v_prior_confirmed_paid,
          COALESCE(v_invoice.currency, 'INR'), v_invoice.amount)
      );
    END IF;

    v_authoritative_outstanding := GREATEST(0, v_invoice.amount - v_prior_confirmed_paid);

    -- Fail safely if invoice cached balance contradicts payment rows
    IF v_invoice.outstanding_amount IS NOT NULL AND v_invoice.outstanding_amount <> v_authoritative_outstanding THEN
      RETURN jsonb_build_object(
        'success', false,
        'errorCode', 'ledger_balance_mismatch',
        'error', format('Invoice balance (outstanding: %s) does not reconcile with confirmed payment ledger (expected: %s). Manual ledger reconciliation required.',
          v_invoice.outstanding_amount, v_authoritative_outstanding)
      );
    END IF;

    IF v_invoice.amount_paid IS NOT NULL AND v_invoice.amount_paid <> v_prior_confirmed_paid THEN
      RETURN jsonb_build_object(
        'success', false,
        'errorCode', 'ledger_balance_mismatch',
        'error', format('Invoice amount_paid (%s) does not reconcile with confirmed payment ledger (%s). Manual ledger reconciliation required.',
          v_invoice.amount_paid, v_prior_confirmed_paid)
      );
    END IF;

    -- 5b. Validate claim amount against authoritative financial state
    IF v_claim.amount IS NULL OR v_claim.amount <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'errorCode', 'invalid_claim_amount',
        'error', 'Payment claim amount must be greater than zero.'
      );
    END IF;

    -- Block any claim that would cause total confirmed payments to exceed invoice total
    IF (v_prior_confirmed_paid + v_claim.amount) > v_invoice.amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'errorCode', 'claim_exceeds_outstanding',
        'error', format('Claimed amount (%s %s) exceeds the authoritative outstanding balance (%s %s).',
          COALESCE(v_invoice.currency, 'INR'), v_claim.amount,
          COALESCE(v_invoice.currency, 'INR'), v_authoritative_outstanding
        )
      );
    END IF;

    -- 5c. Transition pending claim to confirmed
    UPDATE public.payments
       SET status = 'confirmed'
     WHERE id = v_claim.id;

    -- 5d. Recalculate authoritative total confirmed paid for invoice without double-counting
    v_total_confirmed_paid := v_prior_confirmed_paid + v_claim.amount;
    v_new_outstanding := GREATEST(0, v_invoice.amount - v_total_confirmed_paid);
    v_new_status := CASE WHEN v_new_outstanding = 0 THEN 'paid' ELSE 'partially_paid' END;

    -- 5e. Update invoice state consistently (preserve collection_health and health_category on partial payments)
    UPDATE public.invoices
       SET amount_paid = v_total_confirmed_paid,
           outstanding_amount = v_new_outstanding,
           status = v_new_status,
           paid_date = CASE WHEN v_new_status = 'paid' THEN COALESCE(v_invoice.paid_date, v_today) ELSE v_invoice.paid_date END,
           collection_health = CASE WHEN v_new_status = 'paid' THEN 100 ELSE COALESCE(v_invoice.collection_health, 50) END,
           health_category = CASE WHEN v_new_status = 'paid' THEN 'low_risk' ELSE COALESCE(v_invoice.health_category, 'medium_risk') END,
           next_action = CASE
             WHEN v_new_status = 'paid' THEN 'Payment confirmed. Chasing stopped.'
             ELSE format('Chase remaining %s %s', COALESCE(v_invoice.currency, 'INR'), v_new_outstanding)
           END,
           updated_at = NOW()
     WHERE id = p_invoice_id;

    -- 5f. Fulfill active payment promises sequentially based on cumulative verified funds
    IF v_new_status = 'paid' THEN
      -- Full settlement fulfills all remaining pending promises for this invoice
      UPDATE public.payment_promises
         SET status = 'fulfilled',
             fulfilled_at = NOW()
       WHERE workspace_id = p_workspace_id
         AND invoice_id = p_invoice_id
         AND status = 'pending';
    ELSE
      -- Partial payment: Fulfill pending promises sequentially based on cumulative unallocated verified funds
      -- Promises are satisfied by cumulative verified payments; earlier commitments must be fully met before subsequent ones.
      DECLARE
        v_fulfilled_consumed NUMERIC(12, 2) := 0;
        v_available_funds NUMERIC(12, 2);
        v_promise RECORD;
      BEGIN
        SELECT COALESCE(SUM(promised_amount), 0)
          INTO v_fulfilled_consumed
          FROM public.payment_promises
         WHERE workspace_id = p_workspace_id
           AND invoice_id = p_invoice_id
           AND status = 'fulfilled';

        v_available_funds := GREATEST(0, v_total_confirmed_paid - v_fulfilled_consumed);

        FOR v_promise IN
          SELECT id, promised_amount
            FROM public.payment_promises
           WHERE workspace_id = p_workspace_id
             AND invoice_id = p_invoice_id
             AND status = 'pending'
           ORDER BY promised_date ASC, detected_at ASC, id ASC
             FOR UPDATE
        LOOP
          IF v_available_funds >= v_promise.promised_amount THEN
            UPDATE public.payment_promises
               SET status = 'fulfilled',
                   fulfilled_at = NOW()
             WHERE id = v_promise.id;
            v_available_funds := v_available_funds - v_promise.promised_amount;
          ELSE
            -- Cumulative funds cannot yet satisfy this promise;
            -- Stop sequential allocation so subsequent promises cannot jump ahead.
            EXIT;
          END IF;
        END LOOP;
      END;
    END IF;

    -- 5g. Insert collection event audit log
    INSERT INTO public.collection_events (
      workspace_id,
      invoice_id,
      type,
      title,
      description,
      badge,
      actor,
      metadata
    ) VALUES (
      p_workspace_id,
      p_invoice_id,
      'payment_verified',
      'Payment Claim Verified & Confirmed ✅',
      format('Bank verified payment of %s %s credited.', COALESCE(v_invoice.currency, 'INR'), v_claim.amount),
      CASE WHEN v_new_status = 'paid' THEN 'SETTLED' ELSE 'PARTIAL VERIFIED' END,
      'user',
      jsonb_build_object(
        'claim_id', v_claim.id,
        'claim_amount', v_claim.amount,
        'amount_paid', v_total_confirmed_paid,
        'outstanding_amount', v_new_outstanding,
        'status', v_new_status
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'status', v_new_status,
        'amountPaid', v_total_confirmed_paid,
        'outstandingAmount', v_new_outstanding,
        'claimId', v_claim.id,
        'claimAmount', v_claim.amount
      )
    );

  -- Step 6: Rejection Branch
  -- Rejection does NOT require valid or non-excessive amounts; an invalid or excessive claim is explicitly rejectable.
  -- Leaves confirmed payments, amount paid, and outstanding balance 100% unaltered.
  ELSE
    DELETE FROM public.payments
     WHERE id = v_claim.id;

    UPDATE public.invoices
       SET next_action = 'Payment claim unconfirmed in bank. Follow-up resumed.',
           updated_at = NOW()
     WHERE id = p_invoice_id;

    INSERT INTO public.collection_events (
      workspace_id,
      invoice_id,
      type,
      title,
      description,
      badge,
      actor,
      metadata
    ) VALUES (
      p_workspace_id,
      p_invoice_id,
      'escalation_triggered',
      'Payment Claim Rejected ❌',
      'Payment claim could not be verified in bank ledger. Collection resumed.',
      'CLAIM REJECTED',
      'user',
      jsonb_build_object(
        'claim_id', v_claim.id,
        'rejected_amount', v_claim.amount
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'rejected', true,
        'claimId', v_claim.id
      )
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Any unexpected failure rolls back the entire transaction automatically
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'transaction_failed',
      'error', SQLERRM
    );
END;
$$;

-- Revoke execute from public/anon and grant to authenticated and service_role
REVOKE ALL ON FUNCTION public.verify_payment_claim_atomic(UUID, UUID, BOOLEAN) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_payment_claim_atomic(UUID, UUID, BOOLEAN) TO authenticated, service_role;

COMMENT ON FUNCTION public.verify_payment_claim_atomic IS
  'Atomically verifies or rejects a customer payment claim within a single PostgreSQL transaction with row-level locks, RLS workspace authorization, and zero double-counting.';
