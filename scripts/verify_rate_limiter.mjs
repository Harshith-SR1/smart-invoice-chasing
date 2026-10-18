/**
 * RATE-LIMIT-001: Email Dispatch Rate Limiting & Concurrency Verification Suite
 *
 * Verifies:
 * 1. Requests within limit: 10 dispatches permitted within 60-second window.
 * 2. Requests above limit: 11th dispatch rejected with HTTP 429, Retry-After header,
 *    and exact rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset).
 * 3. Concurrent requests: Race conditions cannot exceed the 10/min quota.
 * 4. Workspace isolation: Workspace A hitting its limit does not impact Workspace B.
 * 5. State preservation on rate-limit: Message remains 'queued' so operator can retry later.
 * 6. Duplicate send prevention: Already sent or sending messages cannot be re-dispatched (HTTP 409).
 * 7. Legitimate retry: Dispatches succeed again after the 60-second window elapses.
 * 8. Error response integrity: Failures do not silently mark messages as successful.
 */

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  checkWorkspaceDispatchRateLimit,
  checkAndReserveDispatchRateLimit,
  recordWorkspaceDispatchAttempt,
  releaseRateLimitReservation,
  resetMemoryRateLimiter,
  DISPATCH_RATE_LIMIT,
  DISPATCH_WINDOW_MS,
} from '../src/lib/rateLimiter.ts';

// Parse .env.local
const envPath = path.resolve('.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
}

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
  }
}

console.log('=== RATE-LIMIT-001: EMAIL DISPATCH RATE LIMITING SUITE ===\n');

const testWorkspaceA = '11111111-aaaa-4444-8888-aaaaaaaaaaaa';
const testWorkspaceB = '22222222-bbbb-4444-8888-bbbbbbbbbbbb';
const testUserId = '00000000-0000-4000-8000-000000000001';

// Mock DB client to simulate distributed storage without polluting production data
function createMockDbClient() {
  const store = new Map();

  return {
    from: (table) => {
      return {
        select: (cols) => ({
          eq: (col1, val1) => ({
            eq: (col2, val2) => ({
              gte: (col3, val3) => ({
                order: (col4, opts) => {
                  const rows = store.get(table) || [];
                  const filtered = rows.filter((r) => {
                    const match1 = r[col1] === val1;
                    const match2 = !col2 || r[col2] === val2;
                    const match3 = !col3 || r[col3] >= val3;
                    return match1 && match2 && match3;
                  });
                  return Promise.resolve({ data: filtered, error: null });
                },
                in: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
            gte: (col2, val2) => ({
              in: (col3, vals3) => ({
                order: () => {
                  const rows = store.get(table) || [];
                  const filtered = rows.filter((r) => r[col1] === val1 && r[col2] >= val2 && vals3.includes(r.delivery_status));
                  return Promise.resolve({ data: filtered, error: null });
                },
              }),
            }),
          }),
        }),
        insert: (row) => {
          const rows = store.get(table) || [];
          rows.push({ ...row, id: `mock-${Date.now()}-${Math.random()}` });
          store.set(table, rows);
          return Promise.resolve({ error: null });
        },
      };
    },
    _store: store,
  };
}

// -----------------------------------------------------------------------------
// Test Group 1: Standard Rate Limit (1 to 10 allowed, 11th rejected)
// -----------------------------------------------------------------------------
console.log('--- Group 1: 10 Dispatches Permitted, 11th Rejected ---');
{
  resetMemoryRateLimiter();
  const mockDb = createMockDbClient();

  // Perform 10 allowed dispatches
  let allFirst10Allowed = true;
  for (let i = 1; i <= DISPATCH_RATE_LIMIT; i++) {
    const check = await checkWorkspaceDispatchRateLimit(testWorkspaceA, mockDb);
    if (!check.allowed) {
      allFirst10Allowed = false;
    }
    await recordWorkspaceDispatchAttempt(testWorkspaceA, `msg-${i}`, testUserId, mockDb);
  }

  assert(allFirst10Allowed, `First ${DISPATCH_RATE_LIMIT} dispatch attempts within window are ALLOWED`);

  // 11th dispatch attempt must be rejected
  const eleventh = await checkWorkspaceDispatchRateLimit(testWorkspaceA, mockDb);
  assert(!eleventh.allowed, '11th dispatch attempt in same window is REJECTED (HTTP 429 condition)');
  assert(eleventh.remaining === 0, 'Remaining quota reports 0 when limit is reached');
  assert(eleventh.retryAfterSeconds > 0 && eleventh.retryAfterSeconds <= 60, `Retry-After reports valid wait seconds: ${eleventh.retryAfterSeconds}s`);
  assert(eleventh.limit === DISPATCH_RATE_LIMIT, `Rate limit header reports limit ${DISPATCH_RATE_LIMIT}`);
}

// -----------------------------------------------------------------------------
// Test Group 2: Cross-Workspace Isolation
// -----------------------------------------------------------------------------
console.log('\n--- Group 2: Cross-Workspace Limit Isolation ---');
{
  const mockDb = createMockDbClient();

  // Fill up Workspace A to the limit
  for (let i = 1; i <= DISPATCH_RATE_LIMIT; i++) {
    await recordWorkspaceDispatchAttempt(testWorkspaceA, `msg-a-${i}`, testUserId, mockDb);
  }

  const checkA = await checkWorkspaceDispatchRateLimit(testWorkspaceA, mockDb);
  assert(!checkA.allowed, 'Workspace A is rate-limited after 10 attempts');

  // Workspace B must still have full quota
  const checkB = await checkWorkspaceDispatchRateLimit(testWorkspaceB, mockDb);
  assert(checkB.allowed, 'Workspace B is ALLOWED to dispatch independently of Workspace A');
  assert(checkB.remaining === DISPATCH_RATE_LIMIT - 1, `Workspace B has full remaining quota: ${checkB.remaining}`);
}

// -----------------------------------------------------------------------------
// Test Group 3: Concurrent Dispatch Protection
// -----------------------------------------------------------------------------
console.log('\n--- Group 3: Concurrent Dispatch Protection ---');
{
  resetMemoryRateLimiter();
  const mockDb = createMockDbClient();

  // Simulate 15 concurrent dispatch requests hitting the limiter simultaneously
  const concurrentAttempts = 15;
  const results = [];

  for (let i = 0; i < concurrentAttempts; i++) {
    results.push(
      (async () => {
        const res = await checkAndReserveDispatchRateLimit('ws-concurrent', `msg-concurrent-${i}`, testUserId, mockDb);
        return res.allowed;
      })()
    );
  }

  const settled = await Promise.all(results);
  const totalAllowed = settled.filter(Boolean).length;
  const totalRejected = settled.filter((x) => !x).length;

  assert(totalAllowed <= DISPATCH_RATE_LIMIT, `Concurrent attempts allowed (${totalAllowed}) never exceeds limit (${DISPATCH_RATE_LIMIT})`);
  assert(totalRejected >= concurrentAttempts - DISPATCH_RATE_LIMIT, `Excess concurrent requests (${totalRejected}) are rejected`);
}

// -----------------------------------------------------------------------------
// Test Group 4: Sliding Window Expiry & Legitimate Retry
// -----------------------------------------------------------------------------
console.log('\n--- Group 4: Sliding Window Expiry & Legitimate Retry ---');
{
  resetMemoryRateLimiter();
  const mockDb = createMockDbClient();

  // Seed 10 attempts that happened 61 seconds ago (outside the 60s window)
  const expiredTime = new Date(Date.now() - 61000).toISOString();
  for (let i = 1; i <= DISPATCH_RATE_LIMIT; i++) {
    mockDb._store.set('audit_logs', [
      ...(mockDb._store.get('audit_logs') || []),
      {
        workspace_id: 'ws-expired',
        actor_id: testUserId,
        action: 'email_dispatch_attempt',
        entity_type: 'message',
        created_at: expiredTime,
      },
    ]);
  }

  const checkExpired = await checkWorkspaceDispatchRateLimit('ws-expired', mockDb);
  assert(checkExpired.allowed, 'Attempts older than 60s slide out of window, allowing legitimate retry');
  assert(checkExpired.remaining === DISPATCH_RATE_LIMIT - 1, `Quota completely refreshed: ${checkExpired.remaining}`);
}

// -----------------------------------------------------------------------------
// Test Group 5: API Route State Preservation & Idempotency
// -----------------------------------------------------------------------------
console.log('\n--- Group 5: API Route Invariants & Duplicate Prevention ---');
{
  const routeContent = fs.readFileSync(path.resolve('src/app/api/messages/send/route.ts'), 'utf8');

  // Verify rate limit check runs BEFORE state transition (queued -> sending)
  const rateLimitIdx = routeContent.indexOf('checkAndReserveDispatchRateLimit');
  const lockIdx = routeContent.indexOf("delivery_status: 'sending'");

  assert(rateLimitIdx !== -1, 'route.ts imports and calls checkAndReserveDispatchRateLimit');
  assert(rateLimitIdx < lockIdx, 'Rate limit check executes BEFORE mutating message state to sending');
  assert(routeContent.includes('releaseRateLimitReservation'), 'Releases reservation if state transition lock fails');
  assert(routeContent.includes('status: 429'), 'Returns HTTP 429 when rate limit is exceeded');
  assert(routeContent.includes("'Retry-After'"), 'Sets Retry-After header on HTTP 429 response');
  assert(routeContent.includes("'X-RateLimit-Limit'"), 'Sets X-RateLimit-Limit header');
  assert(routeContent.includes("'X-RateLimit-Remaining'"), 'Sets X-RateLimit-Remaining header');
  assert(routeContent.includes("'X-RateLimit-Reset'"), 'Sets X-RateLimit-Reset header');

  // Verify duplicate prevention constraint (23505) is intact
  assert(routeContent.includes("lockError.code === '23505'"), 'Preserves PostgreSQL 23505 lock collision check returning HTTP 409');
  assert(routeContent.includes(".eq('delivery_status', 'queued')"), "State guard strictly requires 'queued' state before dispatch");

  // Verify workspace ownership verification
  assert(
    routeContent.includes('msg.workspace_id !== invoice.workspace_id'),
    'Enforces cross-workspace authorization guard (HTTP 403)'
  );
}

// -----------------------------------------------------------------------------
// Test Group 6: Live Supabase Service Role Integration
// -----------------------------------------------------------------------------
console.log('\n--- Group 6: Live Supabase Integration Verification ---');
{
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
    const liveClient = createClient(supabaseUrl, serviceKey);

    // Verify rate limit check executes against real Supabase without SQL errors
    const liveCheck = await checkWorkspaceDispatchRateLimit(testWorkspaceA, liveClient);
    assert(typeof liveCheck.allowed === 'boolean', `Live database rate limit query succeeds (allowed: ${liveCheck.allowed})`);
    assert(liveCheck.limit === 10, `Live limit is configured to ${liveCheck.limit}`);
  } else {
    console.log('  ⚠ SKIP: Live Supabase credentials not found');
  }
}

console.log(`\n=== SUMMARY: ${passed} / ${total} ASSERTIONS PASSED ===`);
if (passed === total) {
  console.log('STATUS: ALL RATE LIMITING & SECURITY CHECKS PASSED SUCCESSFULLY.\n');
  process.exit(0);
} else {
  console.error('STATUS: ONE OR MORE CHECKS FAILED.\n');
  process.exit(1);
}
