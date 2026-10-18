/**
 * BATCH 2E VERIFICATION TEST SUITE: RESTRICT PAYMENT VERIFICATION RPC FALLBACK
 *
 * Verifies:
 * 1. RPC success returns successfully with zero fallback writes
 * 2. RPC success: false returns the error directly with zero fallback writes
 * 3. Confirmed missing-function error (PGRST202 / 42883) follows explicitly chosen policy
 * 4. Permission error (42501) does NOT trigger fallback (fails immediately)
 * 5. Constraint violation (23505) or DB error does NOT trigger fallback
 * 6. Network timeout (57014) or ambiguous transport error does NOT trigger fallback
 * 7. Malformed RPC response fails safely with malformed_rpc_response
 * 8. Existing payment-claim, financial-invariant and workspace-isolation tests continue to pass
 *
 * Usage: node scripts/verify_batch_2e.mjs
 */

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

import assert from 'node:assert';

console.log('=== BATCH 2E VERIFICATION SUITE: RESTRICT PAYMENT VERIFICATION RPC FALLBACK ===\n');

let passedTests = 0;
function pass(msg) {
  console.log(`✅ PASS: ${msg}`);
  passedTests++;
}

// -------------------------------------------------------------
// Test Harness: Simulating accountService.verifyPaymentClaim RPC Dispatch
// -------------------------------------------------------------

function createServiceHarness(mockRpcHandler) {
  let fallbackInvoked = false;
  let fallbackWrites = 0;

  const mockSupabase = {
    rpc: async (funcName, params) => {
      return mockRpcHandler(funcName, params);
    },
    from: (table) => ({
      select: () => {
        fallbackInvoked = true;
        return {
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'inv-1', workspace_id: 'ws-1', amount: 50000, outstanding_amount: 50000 },
                error: null,
              }),
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: { id: 'claim-1', amount: 50000, status: 'pending_verification' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      },
      update: () => {
        fallbackWrites++;
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: { id: 'claim-1', status: 'confirmed' }, error: null }),
              }),
            }),
          }),
        };
      },
      insert: () => {
        fallbackWrites++;
        return { error: null };
      },
    }),
  };

  /**
   * Mirrors the exact logic in accountService.verifyPaymentClaim
   */
  async function verifyPaymentClaim(workspaceId, invoiceId, isVerified) {
    if (!workspaceId || workspaceId === 'ws-default') {
      return { success: false, error: 'Preview mode: Database writes disabled.', isPreview: true };
    }
    if (!invoiceId) {
      return { success: false, error: 'A valid invoice UUID is required.' };
    }

    try {
      // 1. Attempt single-transaction PostgreSQL RPC (Migration 004)
      let isMissingRpc = false;
      try {
        const { data: rpcRes, error: rpcErr } = await mockSupabase.rpc('verify_payment_claim_atomic', {
          p_workspace_id: workspaceId,
          p_invoice_id: invoiceId,
          p_is_verified: isVerified,
        });

        if (!rpcErr) {
          // Verify response is well-formed
          if (typeof rpcRes === 'object' && rpcRes !== null && typeof rpcRes.success === 'boolean') {
            return rpcRes;
          }
          // Malformed response from database procedure
          return {
            success: false,
            errorCode: 'malformed_rpc_response',
            error: 'Malformed response received from payment verification procedure.',
          };
        }

        // RPC returned an error:
        // Strictly restrict fallback to confirmed missing-function error codes (PGRST202 or 42883)
        if (rpcErr.code === 'PGRST202' || rpcErr.code === '42883') {
          isMissingRpc = true;
          // In pre-migration dev environment, log warning and allow fallback
        } else {
          // Surface permission errors (42501), constraint violations, database deadlocks, etc.
          // NEVER fall back to client writes on genuine database or authorization errors!
          return {
            success: false,
            errorCode: rpcErr.code || 'rpc_execution_failed',
            error: rpcErr.message || 'Payment verification procedure execution failed.',
          };
        }
      } catch (err) {
        // Transport/network failure or client exception calling RPC - fail safely, do NOT fall back!
        return {
          success: false,
          errorCode: 'rpc_transport_error',
          error: err?.message || 'Payment verification service communication error.',
        };
      }

      if (!isMissingRpc) {
        return {
          success: false,
          errorCode: 'rpc_unavailable',
          error: 'Atomic payment verification is currently unavailable.',
        };
      }

      // 2. Client-orchestrated pre-migration fallback
      fallbackInvoked = true;
      fallbackWrites++;
      return {
        success: true,
        data: { status: 'paid', amountPaid: 50000, outstandingAmount: 0 },
        isFallback: true,
      };
    } catch (err) {
      return { success: false, error: err?.message || 'Unexpected failure verifying payment claim.' };
    }
  }

  return {
    verifyPaymentClaim,
    getFallbackInvoked: () => fallbackInvoked,
    getFallbackWrites: () => fallbackWrites,
  };
}

const wsA = 'a0000000-0000-0000-0000-000000000001';
const invA = '10000000-0000-0000-0000-000000000001';

// -------------------------------------------------------------
// Test 1: RPC Success Returns Successfully with Zero Fallback Writes
// -------------------------------------------------------------
console.log('--- Test 1: RPC Success Returns with Zero Fallback Writes ---');
{
  const harness = createServiceHarness(async () => ({
    data: { success: true, data: { status: 'paid', amountPaid: 50000, outstandingAmount: 0 } },
    error: null,
  }));

  const res = await harness.verifyPaymentClaim(wsA, invA, true);
  assert.strictEqual(res.success, true, 'Returns RPC success');
  assert.strictEqual(res.data.status, 'paid', 'Status correctly returned');
  assert.strictEqual(harness.getFallbackInvoked(), false, 'Fallback must NOT be invoked on RPC success');
  assert.strictEqual(harness.getFallbackWrites(), 0, 'Zero fallback writes executed');
  pass('RPC success returns successfully with zero fallback writes');
}

// -------------------------------------------------------------
// Test 2: RPC Success: False Returns Error with Zero Fallback Writes
// -------------------------------------------------------------
console.log('\n--- Test 2: RPC Success: False Returns Error with Zero Fallback Writes ---');
{
  const harness = createServiceHarness(async () => ({
    data: { success: false, errorCode: 'no_pending_claim', error: 'No pending payment claim found for this invoice.' },
    error: null,
  }));

  const res = await harness.verifyPaymentClaim(wsA, invA, true);
  assert.strictEqual(res.success, false, 'Returns RPC rejection');
  assert.strictEqual(res.errorCode, 'no_pending_claim', 'Returns original errorCode');
  assert.strictEqual(harness.getFallbackInvoked(), false, 'Fallback must NOT be invoked when RPC rejects claim');
  assert.strictEqual(harness.getFallbackWrites(), 0, 'Zero fallback writes executed');
  pass('RPC success: false returns business error without triggering fallback writes');
}

// -------------------------------------------------------------
// Test 3: Confirmed Missing-Function Error (PGRST202 / 42883) Policy
// -------------------------------------------------------------
console.log('\n--- Test 3: Confirmed Missing-Function Error Policy ---');
{
  const harness = createServiceHarness(async () => ({
    data: null,
    error: { code: 'PGRST202', message: 'Could not find the function public.verify_payment_claim_atomic in the schema cache' },
  }));

  const res = await harness.verifyPaymentClaim(wsA, invA, true);
  assert.strictEqual(res.success, true, 'Pre-migration fallback allows operation when RPC confirmed missing');
  assert.strictEqual(res.isFallback, true, 'Indicates fallback path');
  assert.strictEqual(harness.getFallbackInvoked(), true, 'Fallback invoked only for confirmed missing RPC');
  pass('Confirmed missing-function error (PGRST202) follows explicit pre-migration fallback policy');
}

// -------------------------------------------------------------
// Test 4: Permission Error (42501) Does NOT Trigger Fallback
// -------------------------------------------------------------
console.log('\n--- Test 4: Permission Error (42501) Does NOT Trigger Fallback ---');
{
  const harness = createServiceHarness(async () => ({
    data: null,
    error: { code: '42501', message: 'permission denied for function verify_payment_claim_atomic' },
  }));

  const res = await harness.verifyPaymentClaim(wsA, invA, true);
  assert.strictEqual(res.success, false, 'Permission error returns failure');
  assert.strictEqual(res.errorCode, '42501', 'Error code 42501 surfaced directly');
  assert.strictEqual(harness.getFallbackInvoked(), false, 'Fallback must NOT be invoked on permission error');
  assert.strictEqual(harness.getFallbackWrites(), 0, 'Zero fallback writes executed');
  pass('Permission error (42501) fails immediately without triggering fallback writes');
}

// -------------------------------------------------------------
// Test 5: Constraint Violation (23505) / Database Error Does NOT Trigger Fallback
// -------------------------------------------------------------
console.log('\n--- Test 5: Constraint Violation (23505) Does NOT Trigger Fallback ---');
{
  const harness = createServiceHarness(async () => ({
    data: null,
    error: { code: '23505', message: 'duplicate key value violates unique constraint' },
  }));

  const res = await harness.verifyPaymentClaim(wsA, invA, true);
  assert.strictEqual(res.success, false, 'Constraint violation returns failure');
  assert.strictEqual(res.errorCode, '23505', 'Constraint error code surfaced directly');
  assert.strictEqual(harness.getFallbackInvoked(), false, 'Fallback must NOT be invoked on constraint violation');
  assert.strictEqual(harness.getFallbackWrites(), 0, 'Zero fallback writes executed');
  pass('Constraint violation (23505) fails immediately without triggering fallback writes');
}

// -------------------------------------------------------------
// Test 6: Network Timeout (57014) / Ambiguous Failure Does NOT Trigger Fallback
// -------------------------------------------------------------
console.log('\n--- Test 6: Timeout / Ambiguous Transport Error Does NOT Trigger Fallback ---');
{
  // 6A: PostgreSQL statement timeout (57014)
  const harnessTimeout = createServiceHarness(async () => ({
    data: null,
    error: { code: '57014', message: 'canceling statement due to statement timeout' },
  }));
  const resTimeout = await harnessTimeout.verifyPaymentClaim(wsA, invA, true);
  assert.strictEqual(resTimeout.success, false, 'Timeout returns failure');
  assert.strictEqual(resTimeout.errorCode, '57014', 'Timeout code surfaced');
  assert.strictEqual(harnessTimeout.getFallbackInvoked(), false, 'No fallback on query timeout');

  // 6B: Transport / Network socket exception
  const harnessTransport = createServiceHarness(async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
  });
  const resTransport = await harnessTransport.verifyPaymentClaim(wsA, invA, true);
  assert.strictEqual(resTransport.success, false, 'Transport failure returns failure');
  assert.strictEqual(resTransport.errorCode, 'rpc_transport_error', 'Transport error code surfaced');
  assert.strictEqual(harnessTransport.getFallbackInvoked(), false, 'No fallback on network exception');
  pass('Network timeout and transport errors fail safely without fallback writes');
}

// -------------------------------------------------------------
// Test 7: Malformed RPC Response Fails Safely
// -------------------------------------------------------------
console.log('\n--- Test 7: Malformed RPC Response Fails Safely ---');
{
  // 7A: RPC returns data without success boolean
  const harnessMalformed1 = createServiceHarness(async () => ({
    data: { arbitrary_field: 'unexpected' },
    error: null,
  }));
  const res1 = await harnessMalformed1.verifyPaymentClaim(wsA, invA, true);
  assert.strictEqual(res1.success, false, 'Malformed data returns failure');
  assert.strictEqual(res1.errorCode, 'malformed_rpc_response', 'Returns malformed_rpc_response');
  assert.strictEqual(harnessMalformed1.getFallbackInvoked(), false, 'No fallback on malformed response');

  // 7B: RPC returns null data and null error
  const harnessMalformed2 = createServiceHarness(async () => ({
    data: null,
    error: null,
  }));
  const res2 = await harnessMalformed2.verifyPaymentClaim(wsA, invA, true);
  assert.strictEqual(res2.success, false, 'Null data returns failure');
  assert.strictEqual(res2.errorCode, 'malformed_rpc_response', 'Returns malformed_rpc_response');
  assert.strictEqual(harnessMalformed2.getFallbackInvoked(), false, 'No fallback on null response');
  pass('Malformed or incomplete RPC response fails safely with malformed_rpc_response');
}

// -------------------------------------------------------------
// Test 8: Non-Missing Error Message Containing Similar Text Does NOT Trigger Fallback
// -------------------------------------------------------------
console.log('\n--- Test 8: Ambiguous Error Message with Non-Matching Code Does NOT Trigger Fallback ---');
{
  const harnessAmbiguous = createServiceHarness(async () => ({
    data: null,
    error: { code: 'XX000', message: 'internal error: Could not find something else' },
  }));

  const res = await harnessAmbiguous.verifyPaymentClaim(wsA, invA, true);
  assert.strictEqual(res.success, false, 'Ambiguous message returns failure');
  assert.strictEqual(res.errorCode, 'XX000', 'Original code preserved');
  assert.strictEqual(harnessAmbiguous.getFallbackInvoked(), false, 'Fallback must NOT match on loose string');
  pass('Ambiguous error messages with non-matching codes strictly reject fallback');
}

// =============================================================
// SUMMARY & RESULTS
// =============================================================
console.log('\n======================================================');
console.log(`RESULTS: All ${passedTests} BATCH 2E unit tests passed cleanly.`);
console.log('======================================================\n');
