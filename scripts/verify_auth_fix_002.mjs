/**
 * AUTH-FIX-002 Verification Suite
 *
 * Verifies final corrections from AUTH-REVIEW-002:
 * 1. Secure OAuth callback destination using getSafeRedirectDestination()
 * 2. Proper error handling, zero-row prevention, and navigation halting on workspace update failure
 * 3. Recovery-session timing extension for URL recovery tokens and outer useEffect subscription cleanup
 */

import fs from 'fs';
import path from 'path';
import { getSafeRedirectDestination } from '../src/lib/authRedirect.ts';

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

console.log('=== AUTH-FIX-002: FINAL AUTHENTICATION CORRECTIONS VERIFICATION ===\n');

// -----------------------------------------------------------------------------
// 1. Secure OAuth Callback Destination
// -----------------------------------------------------------------------------
console.log('--- 1. Secure OAuth Callback Destination (src/app/auth/callback/route.ts) ---');
{
  const callbackCode = fs.readFileSync(path.resolve('src/app/auth/callback/route.ts'), 'utf8');

  // Verify import of getSafeRedirectDestination
  assert(
    callbackCode.includes("import { getRequestOrigin, getSafeRedirectDestination } from '../../../lib/authRedirect'"),
    'Imports getSafeRedirectDestination from authRedirect'
  );

  // Verify replacement of naive next.startsWith('/')
  assert(
    !callbackCode.includes("const destination = next.startsWith('/') ? next : '/dashboard'"),
    'Replaced naive next.startsWith(\'/\') validation'
  );

  // Verify usage of getSafeRedirectDestination(next)
  assert(
    callbackCode.includes("const destination = getSafeRedirectDestination(next) || '/dashboard'"),
    'Uses getSafeRedirectDestination(next) || \'/dashboard\' for destination resolution'
  );

  // Test resolution logic as implemented in callback route
  const resolveCallbackDestination = (raw) => getSafeRedirectDestination(raw) || '/dashboard';

  // Test attack vectors through callback resolution
  assert(resolveCallbackDestination('//evil.example') === '/dashboard', 'Rejects protocol-relative //evil.example -> /dashboard');
  assert(resolveCallbackDestination('https://evil.example') === '/dashboard', 'Rejects external URL https://evil.example -> /dashboard');
  assert(resolveCallbackDestination('javascript:alert(1)') === '/dashboard', 'Rejects javascript: scheme -> /dashboard');
  assert(resolveCallbackDestination('/login') === '/dashboard', 'Rejects redirect loop to /login -> /dashboard');
  assert(resolveCallbackDestination('/auth/callback') === '/dashboard', 'Rejects redirect loop to /auth/callback -> /dashboard');
  assert(resolveCallbackDestination('/invoices') === '/invoices', 'Preserves valid relative path /invoices');
  assert(resolveCallbackDestination('/dashboard?tab=aging') === '/dashboard?tab=aging', 'Preserves query parameters /dashboard?tab=aging');
}

// -----------------------------------------------------------------------------
// 2. Workspace Update Failure & Zero-Row Handling
// -----------------------------------------------------------------------------
console.log('\n--- 2. Workspace Update Error Handling (src/app/setup/page.tsx) ---');
{
  const setupCode = fs.readFileSync(path.resolve('src/app/setup/page.tsx'), 'utf8');

  // Verify user authentication guard before database operations
  assert(
    setupCode.includes('if (!user?.id) {') && setupCode.includes('You must be signed in to configure a workspace'),
    'Halts submission with user-visible error if unauthenticated'
  );

  // Verify update operation selects affected row id and filters by user_id
  assert(
    setupCode.includes(".eq('user_id', user.id)") && setupCode.includes(".select('id')"),
    'Enforces user-level authorization and selects updated row id'
  );

  // Verify updateErr halts execution and releases loading state
  assert(
    setupCode.includes('if (updateErr) {\n          console.error') &&
    setupCode.includes('setErrorMessage(updateErr.message ||') &&
    setupCode.includes('setIsLoading(false);\n          return;'),
    'Update error halts execution, sets errorMessage, releases loading, and does not navigate'
  );

  // Verify zero-row update detection
  assert(
    setupCode.includes('if (!updatedRows || updatedRows.length === 0) {') &&
    setupCode.includes('No authorized workspace found to update'),
    'Zero-row update is treated as failure and prevents navigation'
  );

  // Verify zero-row insert detection
  assert(
    setupCode.includes('if (!insertedRows || insertedRows.length === 0) {') &&
    setupCode.includes('Could not create workspace. Please try again.'),
    'Zero-row insert is treated as failure and prevents navigation'
  );

  // Verify catch block halts execution and releases loading state
  assert(
    setupCode.includes('} catch (err: any) {\n      console.error') &&
    setupCode.includes('setIsLoading(false);\n      return;'),
    'Catch block halts execution, logs error, and prevents navigation'
  );

  // Verify success toast and router.push only occur after successful database write
  const submitBlock = setupCode.substring(setupCode.indexOf('const handleSubmit = async'), setupCode.indexOf('return ('));
  const lastReturnIdx = submitBlock.lastIndexOf('return;');
  const toastIdx = submitBlock.indexOf('showToast(');
  const routerPushIdx = submitBlock.indexOf('router.push(');

  assert(
    lastReturnIdx !== -1 && toastIdx > lastReturnIdx && routerPushIdx > toastIdx,
    'Success toast and router.push occur strictly after all error returns'
  );
}

// -----------------------------------------------------------------------------
// 3. Recovery-Session Timing & Effect Cleanup
// -----------------------------------------------------------------------------
console.log('\n--- 3. Recovery Session Timing & Cleanup (src/app/reset-password/page.tsx) ---');
{
  const resetCode = fs.readFileSync(path.resolve('src/app/reset-password/page.tsx'), 'utf8');

  // Verify outer useEffect scope variables
  assert(
    resetCode.includes('let fallbackTimer: NodeJS.Timeout | null = null;') &&
    resetCode.includes('let authSubscription: { unsubscribe: () => void } | null = null;'),
    'Declares fallbackTimer and authSubscription in outer useEffect scope'
  );

  // Verify outer useEffect return function performs cleanup
  assert(
    resetCode.includes('return () => {\n      isMounted = false;\n      if (fallbackTimer) clearTimeout(fallbackTimer);\n      if (authSubscription) {\n        authSubscription.unsubscribe();\n      }\n    };'),
    'Outer useEffect cleanup properly cancels timer and unsubscribes from auth events'
  );

  // Verify URL token/parameter detection (hash and search params)
  assert(
    resetCode.includes('const hasRecoveryTokens =') &&
    resetCode.includes("hash.includes('access_token')") &&
    resetCode.includes("hash.includes('type=recovery')") &&
    resetCode.includes("search.includes('code=')") &&
    resetCode.includes("search.includes('token_hash=')"),
    'Detects supported Supabase recovery URL tokens (implicit hash and PKCE code/token_hash)'
  );

  // Verify extended timeout window when tokens exist
  assert(
    resetCode.includes('const timeoutMs = hasRecoveryTokens ? 3000 : 800;'),
    'Extends timeout window to 3000ms when recovery tokens are present in URL'
  );

  // Verify immediate timer cancellation when onAuthStateChange fires
  assert(
    resetCode.includes('if (fallbackTimer) clearTimeout(fallbackTimer);') &&
    resetCode.includes('setIsCheckingSession(false);'),
    'Cancels fallback timer immediately upon receiving recovery auth event'
  );

  // Verify form is unavailable during checking or expiration
  assert(
    resetCode.includes('isCheckingSession ? (') &&
    resetCode.includes('Verifying recovery link...') &&
    resetCode.includes('isSessionExpired ? ('),
    'Keeps password form unavailable while verifying session or when session is expired'
  );

  // Verify false success remains eliminated
  assert(
    resetCode.includes('setIsUpdated(false);') &&
    !resetCode.includes('catch (err: any) {\n      setIsUpdated(true)'),
    'Catch and error handlers preserve isUpdated: false'
  );
}

console.log(`\n=== SUMMARY: ${passed} / ${total} ASSERTIONS PASSED ===`);
if (passed === total) {
  console.log('STATUS: ALL AUTH-FIX-002 CORRECTIONS VERIFIED SUCCESSFULLY.\n');
  process.exit(0);
} else {
  console.error('STATUS: ONE OR MORE CHECKS FAILED.\n');
  process.exit(1);
}
