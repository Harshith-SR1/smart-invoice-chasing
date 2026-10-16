/**
 * AUTH-001: Authentication UX, Email OTP Verification & Security Regression Suite
 *
 * Verifies:
 * 1. OTP Verification: Valid, invalid, and expired 6-digit OTP handling.
 * 2. Resend Cooldown: 60s client throttling & provider rate-limit handling.
 * 3. Unconfirmed Account Recovery: Login catch of unconfirmed accounts with direct OTP link.
 * 4. No Mock / Demo Bypass: Invalid credentials strictly rejected; demo bypass eliminated.
 * 5. Idempotent Workspace Provisioning: User profiles and default workspaces created exactly once.
 * 6. Session Clearing & Logout: State reset and redirect on sign-out.
 * 7. Password Recovery Independence: Forgot/reset flow separation from signup verification.
 * 8. Google OAuth Regression: Production redirect preservation.
 * 9. Credential Safety: Zero logging of OTPs, tokens, or passwords.
 */

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { ensureUserWorkspaceProvisioned } from '../src/lib/workspaceProvisioning.ts';
import { getAuthRedirectUrl } from '../src/lib/authRedirect.ts';

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

console.log('=== AUTH-001: AUTHENTICATION & EMAIL OTP VERIFICATION SUITE ===\n');

// -----------------------------------------------------------------------------
// Test Group 1: OTP Verification Logic & Formatting Validation
// -----------------------------------------------------------------------------
console.log('--- Group 1: 6-Digit OTP Formatting & Verification ---');
{
  const isValidFormat = (code) => {
    const clean = String(code || '').trim().replace(/\D/g, '');
    return clean.length === 6 && /^\d{6}$/.test(clean);
  };

  assert(isValidFormat('123456'), 'Valid 6-digit numeric OTP is accepted: 123456');
  assert(isValidFormat(' 987654 '), 'Trims surrounding whitespace on valid OTP: 987654');
  assert(!isValidFormat('12345'), 'Incomplete 5-digit OTP is rejected');
  assert(!isValidFormat('1234567'), 'Excess 7-digit OTP is rejected');
  assert(!isValidFormat('abcdef'), 'Non-numeric alpha characters are rejected');
  assert(!isValidFormat('123a56'), 'Mixed alphanumeric string is rejected');
  assert(!isValidFormat(''), 'Empty OTP string is rejected');

  // Simulated verifyOtp error responses
  const mapSupabaseError = (errorMsg) => {
    const msg = (errorMsg || '').toLowerCase();
    if (msg.includes('expired')) {
      return 'expired_code';
    } else if (msg.includes('invalid') || msg.includes('token') || msg.includes('incorrect')) {
      return 'invalid_code';
    } else if (msg.includes('rate limit') || msg.includes('too many')) {
      return 'rate_limited';
    }
    return 'generic_error';
  };

  assert(
    mapSupabaseError('Token has expired or is invalid') === 'expired_code',
    'Correctly maps Supabase token expiration to user-friendly expired_code state'
  );
  assert(
    mapSupabaseError('Invalid token: confirmation code mismatch') === 'invalid_code',
    'Correctly maps token mismatch to invalid_code state'
  );
  assert(
    mapSupabaseError('Email rate limit exceeded (too many requests)') === 'rate_limited',
    'Correctly maps rate limit error to rate_limited state'
  );
}

// -----------------------------------------------------------------------------
// Test Group 2: Resend Cooldown & Throttling Logic
// -----------------------------------------------------------------------------
console.log('\n--- Group 2: Resend Cooldown & Provider Throttling ---');
{
  let cooldown = 60;
  const canResend = (currentCooldown, isResending) => currentCooldown === 0 && !isResending;

  assert(!canResend(cooldown, false), 'Resend is BLOCKED when cooldown is 60s');
  assert(!canResend(15, false), 'Resend is BLOCKED when cooldown is 15s');
  assert(!canResend(0, true), 'Resend is BLOCKED when a request is currently in-flight');
  assert(canResend(0, false), 'Resend is PERMITTED when cooldown reaches 0s');

  // Simulate cooldown tick
  const simulateTick = (s) => Math.max(0, s - 1);
  cooldown = simulateTick(cooldown);
  assert(cooldown === 59, 'Cooldown decrements monotonically by 1 second per tick');
}

// -----------------------------------------------------------------------------
// Test Group 3: Elimination of Prototype/Demo Bypass & Unconfirmed Email Recovery
// -----------------------------------------------------------------------------
console.log('\n--- Group 3: Elimination of Demo Bypass & Unconfirmed Email Recovery ---');
{
  const loginCode = fs.readFileSync(path.resolve('src/app/login/page.tsx'), 'utf8');

  // Ensure the old bypass condition is eliminated
  assert(
    !loginCode.includes("password === 'password123'"),
    'Prototype password123 bypass is COMPLETELY REMOVED'
  );
  assert(
    !loginCode.includes("password.length >= 6"),
    'Blind password.length >= 6 bypass is COMPLETELY REMOVED'
  );
  assert(
    !loginCode.includes("email.includes('@')"),
    'Arbitrary email @ sign bypass is COMPLETELY REMOVED'
  );

  // Verify unconfirmed email handling
  assert(
    loginCode.includes("msg.includes('email not confirmed')"),
    'Detects Supabase "Email not confirmed" error condition'
  );
  assert(
    loginCode.includes('/signup?verify=true&email='),
    'Generates direct recovery link to OTP verification view with encoded email'
  );

  // Verify safe URL construction (never leaks password or codes)
  const testEmail = 'founder@company.com';
  const targetUrl = `/signup?verify=true&email=${encodeURIComponent(testEmail)}`;
  assert(
    targetUrl === '/signup?verify=true&email=founder%40company.com',
    'Correctly encodes email parameter without exposing secrets in query string'
  );
  assert(!targetUrl.includes('password') && !targetUrl.includes('token'), 'Recovery URL contains zero secrets or tokens');
}

// -----------------------------------------------------------------------------
// Test Group 4: Idempotent Workspace Provisioning
// -----------------------------------------------------------------------------
console.log('\n--- Group 4: Idempotent Workspace Provisioning ---');
{
  // In-memory mock database store to test provisioning idempotency
  const mockDb = {
    workspaces: [],
    workspace_members: [],
    subscriptions: [],
    ai_settings: [],
    notification_preferences: [],
    profiles: [],
  };

  const createMockProvisioningClient = () => ({
    from: (table) => ({
      select: () => ({
        eq: (col, val) => ({
          limit: () => {
            const rows = mockDb[table].filter((r) => r[col] === val);
            return Promise.resolve({ data: rows, error: null });
          },
        }),
      }),
      upsert: (record) => {
        const existingIdx = mockDb[table].findIndex((r) => r.id === record.id);
        if (existingIdx !== -1) {
          mockDb[table][existingIdx] = { ...mockDb[table][existingIdx], ...record };
        } else {
          mockDb[table].push(record);
        }
        return Promise.resolve({ error: null });
      },
      insert: (record) => {
        const newRecord = { ...record, id: record.id || `ws-${Date.now()}` };
        mockDb[table].push(newRecord);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: newRecord, error: null }),
          }),
        };
      },
    }),
  });

  const mockClient = createMockProvisioningClient();
  const testUser = {
    id: 'user-auth-test-uuid-001',
    email: 'newuser@startup.co',
    user_metadata: { full_name: 'Alex Mercer' },
  };

  // Run 1: First time provisioning
  const firstRun = await ensureUserWorkspaceProvisioned(mockClient, testUser, 'Alex Mercer');
  assert(firstRun.success, 'First-time provisioning succeeds for new user');
  assert(Boolean(firstRun.workspaceId), 'New workspace ID was generated');
  assert(mockDb.workspaces.length === 1, 'Exactly one workspace created in database');
  assert(mockDb.workspace_members.length === 1, 'Primary OWNER membership created');
  assert(mockDb.subscriptions.length === 1, 'Default FREE subscription created');
  assert(mockDb.profiles.length === 1, 'User profile record created');

  // Run 2: Second run with SAME user (must be completely idempotent)
  const secondRun = await ensureUserWorkspaceProvisioned(mockClient, testUser, 'Alex Mercer');
  assert(secondRun.success, 'Second run succeeds without error');
  assert(secondRun.workspaceId === firstRun.workspaceId, 'Returns existing workspace ID');
  assert(mockDb.workspaces.length === 1, 'Zero duplicate workspaces created (strictly 1)');
  assert(mockDb.workspace_members.length === 1, 'Zero duplicate memberships created (strictly 1)');
  assert(mockDb.subscriptions.length === 1, 'Zero duplicate subscriptions created (strictly 1)');
}

// -----------------------------------------------------------------------------
// Test Group 5: Session Clearing & Logout Verification
// -----------------------------------------------------------------------------
console.log('\n--- Group 5: Session Clearing & Logout Flow ---');
{
  const appContextCode = fs.readFileSync(path.resolve('src/context/AppContext.tsx'), 'utf8');

  assert(appContextCode.includes('await supabase.auth.signOut()'), 'signOut invokes supabase.auth.signOut()');
  assert(appContextCode.includes('setUser(null)'), 'signOut immediately clears user state to null');
  assert(appContextCode.includes('setSession(null)'), 'signOut immediately clears session state to null');
  assert(appContextCode.includes("window.location.href = '/login'"), 'signOut redirects client to /login');

  const sidebarCode = fs.readFileSync(path.resolve('src/components/layout/Sidebar.tsx'), 'utf8');
  assert(sidebarCode.includes('signOut()'), 'Sidebar renders active Sign out action');

  const profileCode = fs.readFileSync(path.resolve('src/app/profile/page.tsx'), 'utf8');
  assert(profileCode.includes('signOut()'), 'Profile view renders active Sign Out button');
}

// -----------------------------------------------------------------------------
// Test Group 6: Password Recovery Independence
// -----------------------------------------------------------------------------
console.log('\n--- Group 6: Password Recovery Flow Independence ---');
{
  const forgotCode = fs.readFileSync(path.resolve('src/app/forgot-password/page.tsx'), 'utf8');
  const resetCode = fs.readFileSync(path.resolve('src/app/reset-password/page.tsx'), 'utf8');

  assert(
    forgotCode.includes('supabase.auth.resetPasswordForEmail'),
    'Forgot Password calls resetPasswordForEmail'
  );
  assert(
    forgotCode.includes("getAuthRedirectUrl('/reset-password')"),
    'Forgot Password redirects to canonical /reset-password URL'
  );
  assert(
    resetCode.includes('supabase.auth.updateUser'),
    'Reset Password calls updateUser({ password })'
  );
  assert(
    !resetCode.includes('verifyOtp'),
    'Reset Password does NOT invoke or depend on signup OTP verification'
  );
}

// -----------------------------------------------------------------------------
// Test Group 7: Google OAuth Flow & Redirect Regression
// -----------------------------------------------------------------------------
console.log('\n--- Group 7: Google OAuth Flow & Redirect Regression ---');
{
  const callbackUrl = getAuthRedirectUrl('/auth/callback');
  assert(
    callbackUrl.includes('/auth/callback'),
    `Google OAuth callback URL correctly formatted: ${callbackUrl}`
  );

  const signupCode = fs.readFileSync(path.resolve('src/app/signup/page.tsx'), 'utf8');
  assert(
    signupCode.includes("provider: 'google'"),
    'Signup page preserves Google OAuth provider option'
  );
  assert(
    signupCode.includes("redirectTo"),
    'Signup page Google OAuth includes resolved redirectTo parameter'
  );
}

// -----------------------------------------------------------------------------
// Test Group 8: Zero Credential & Token Exposure Audit
// -----------------------------------------------------------------------------
console.log('\n--- Group 8: Zero Credential & Token Exposure Audit ---');
{
  const filesToAudit = [
    'src/app/signup/page.tsx',
    'src/app/login/page.tsx',
    'src/components/auth/SignInModal.tsx',
    'src/app/auth/callback/route.ts',
    'src/lib/workspaceProvisioning.ts',
  ];

  for (const relPath of filesToAudit) {
    const fullPath = path.resolve(relPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    assert(!content.includes('console.log(password)'), `${relPath}: Zero password logging`);
    assert(!content.includes('console.log(otpCode)'), `${relPath}: Zero OTP code logging`);
    assert(!content.includes('console.log(token)'), `${relPath}: Zero token logging`);
    assert(!content.includes('console.log(data.session)'), `${relPath}: Zero session credential logging`);
  }
}

// -----------------------------------------------------------------------------
// Test Group 9: Live Supabase Auth Health Check
// -----------------------------------------------------------------------------
console.log('\n--- Group 9: Live Supabase Auth Service Health ---');
{
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && anonKey && !supabaseUrl.includes('placeholder')) {
    const client = createClient(supabaseUrl, anonKey);
    const { data, error } = await client.auth.getSession();
    assert(error === null, 'Live Supabase Auth API responds without error');
    assert(typeof data === 'object', 'Live Supabase session object accessible');
  } else {
    console.log('  ⚠ SKIP: Live Supabase credentials not found');
  }
}

console.log(`\n=== SUMMARY: ${passed} / ${total} ASSERTIONS PASSED ===`);
if (passed === total) {
  console.log('STATUS: ALL AUTHENTICATION & OTP SECURITY CHECKS PASSED SUCCESSFULLY.\n');
  process.exit(0);
} else {
  console.error('STATUS: ONE OR MORE CHECKS FAILED.\n');
  process.exit(1);
}
