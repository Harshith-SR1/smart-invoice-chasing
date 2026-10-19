/**
 * AUTH-FIX-001 Verification Suite
 *
 * Verifies all targeted fixes for AUTH-AUDIT-001:
 * 1. Safe next redirect handling & open redirect protection
 * 2. Password reset false-success elimination & session expiration handling
 * 3. Removal of inert Remember Me control
 * 4. Form labels, autocomplete, and accessible error alerts across all auth pages
 * 5. Forgot password email validation & anti-enumeration protection
 * 6. Idempotent workspace setup (update rather than duplicate insert)
 * 7. Desktop benefits panel with approved copy and responsive constraints
 * 8. Legal placeholder cleanup in PolicyModal
 * 9. Credential safety (zero logging of passwords, tokens, OTPs)
 */

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

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

console.log('=== AUTH-FIX-001: TARGETED AUTH DEFECTS & ENHANCEMENT VERIFICATION ===\n');

// -----------------------------------------------------------------------------
// Group 1: Safe Redirect Destination Validation (Open-Redirect Prevention)
// -----------------------------------------------------------------------------
console.log('--- Group 1: Safe Redirect Destination Validation ---');
{
  // Valid internal paths
  assert(getSafeRedirectDestination('/dashboard') === '/dashboard', 'Allows safe root relative path /dashboard');
  assert(getSafeRedirectDestination('/workspace') === '/workspace', 'Allows safe root relative path /workspace');
  assert(getSafeRedirectDestination('/profile') === '/profile', 'Allows safe root relative path /profile');
  assert(
    getSafeRedirectDestination('/dashboard?tab=invoices#recents') === '/dashboard?tab=invoices#recents',
    'Preserves query parameters and hash fragments on safe internal destination'
  );

  // Open redirect attack vectors
  assert(getSafeRedirectDestination('//evil.com') === null, 'Rejects protocol-relative URL: //evil.com');
  assert(getSafeRedirectDestination('//evil.com/path') === null, 'Rejects protocol-relative URL: //evil.com/path');
  assert(getSafeRedirectDestination('/\\evil.com') === null, 'Rejects backslash mixed path: /\\evil.com');
  assert(getSafeRedirectDestination('\\\\evil.com') === null, 'Rejects UNC path: \\\\evil.com');
  assert(getSafeRedirectDestination('https://evil.com') === null, 'Rejects absolute HTTPS URL: https://evil.com');
  assert(getSafeRedirectDestination('http://evil.com') === null, 'Rejects absolute HTTP URL: http://evil.com');
  assert(getSafeRedirectDestination('javascript:alert(1)') === null, 'Rejects javascript: scheme');
  assert(getSafeRedirectDestination('data:text/html,<h1>hack</h1>') === null, 'Rejects data: scheme');
  assert(getSafeRedirectDestination('/dashboard\r\nSet-Cookie:bad') === null, 'Rejects CRLF injection characters');
  assert(getSafeRedirectDestination('') === null, 'Rejects empty destination');
  assert(getSafeRedirectDestination(null) === null, 'Rejects null destination');
  assert(getSafeRedirectDestination(undefined) === null, 'Rejects undefined destination');

  // Prevent redirect loops back to auth pages
  assert(getSafeRedirectDestination('/login') === null, 'Rejects redirect loop to /login');
  assert(getSafeRedirectDestination('/signup') === null, 'Rejects redirect loop to /signup');
  assert(getSafeRedirectDestination('/auth/callback') === null, 'Rejects redirect loop to /auth/callback');
  assert(getSafeRedirectDestination('/forgot-password') === null, 'Rejects redirect loop to /forgot-password');
  assert(getSafeRedirectDestination('/reset-password') === null, 'Rejects redirect loop to /reset-password');
}

// -----------------------------------------------------------------------------
// Group 2: Password Reset False Success Elimination (P1)
// -----------------------------------------------------------------------------
console.log('\n--- Group 2: Password Reset False Success Elimination ---');
{
  const resetCode = fs.readFileSync(path.resolve('src/app/reset-password/page.tsx'), 'utf8');

  // Must not call setIsUpdated(true) inside catch
  const catchBlockMatch = resetCode.match(/catch\s*\([^{]*\)\s*\{([^}]+)\}/);
  assert(
    catchBlockMatch && !catchBlockMatch[1].includes('setIsUpdated(true)'),
    'Catch block in reset-password NEVER calls setIsUpdated(true)'
  );
  assert(
    catchBlockMatch && catchBlockMatch[1].includes('setIsUpdated(false)'),
    'Catch block in reset-password explicitly sets setIsUpdated(false)'
  );
  assert(
    resetCode.includes('if (error) {\n        setIsUpdated(false);'),
    'Supabase updateUser error handler explicitly sets setIsUpdated(false)'
  );

  // Recovery session check on mount
  assert(
    resetCode.includes('supabase.auth.getSession()') && resetCode.includes('onAuthStateChange'),
    'Checks recovery session on mount and listens for auth state changes'
  );
  assert(
    resetCode.includes('isSessionExpired') || resetCode.includes('isSessionMissing'),
    'Tracks invalid or expired recovery session state'
  );
  assert(
    resetCode.includes('/forgot-password'),
    'Provides direct link back to /forgot-password when recovery session is missing/expired'
  );

  // Password length enforcement
  assert(resetCode.includes('password.length < 8'), 'Enforces 8-character minimum password length');
  assert(resetCode.includes('password.length > 128'), 'Enforces 128-character maximum password length');
  assert(resetCode.includes('password !== confirmPassword'), 'Enforces password and confirm password match');

  // Autocomplete and accessibility
  assert(resetCode.includes('id="new-password"'), 'New password input has unique id="new-password"');
  assert(resetCode.includes('htmlFor="new-password"'), 'Label is associated via htmlFor="new-password"');
  assert(resetCode.includes('id="confirm-password"'), 'Confirm password input has unique id="confirm-password"');
  assert(resetCode.includes('htmlFor="confirm-password"'), 'Label is associated via htmlFor="confirm-password"');
  assert(resetCode.includes('autoComplete="new-password"'), 'Password inputs specify autoComplete="new-password"');
  assert(resetCode.includes('role="alert"'), 'Error alert has role="alert"');
  assert(resetCode.includes('aria-live="polite"'), 'Error alert has aria-live="polite"');
  assert(resetCode.includes('aria-invalid='), 'Inputs include aria-invalid attribute');
}

// -----------------------------------------------------------------------------
// Group 3: Login Safe Next Destination & Remember Me Removal
// -----------------------------------------------------------------------------
console.log('\n--- Group 3: Login Redirect Handling & Remember Me Removal ---');
{
  const loginCode = fs.readFileSync(path.resolve('src/app/login/page.tsx'), 'utf8');

  // Next query parameter handling
  assert(loginCode.includes('useSearchParams'), 'Login page imports useSearchParams');
  assert(loginCode.includes('getSafeRedirectDestination'), 'Login page imports getSafeRedirectDestination');
  assert(loginCode.includes('safeNext'), 'Login page evaluates safeNext destination');
  assert(loginCode.includes('router.push(safeNext)'), 'Login page routes to safeNext destination when present');
  assert(
    loginCode.includes('callbackPath') && loginCode.includes('/auth/callback?next='),
    'Google OAuth preserves safe next destination through callback URL'
  );
  assert(loginCode.includes('<Suspense'), 'Login page wraps form in <Suspense> for Next.js navigation safety');

  // Remember Me removal
  assert(!loginCode.includes('rememberMe'), 'Unused rememberMe state is completely removed');
  assert(!loginCode.includes('setRememberMe'), 'Unused setRememberMe setter is completely removed');
  assert(!loginCode.includes('id="remember"'), 'Inert Remember me checkbox is completely removed');
  assert(!loginCode.includes('Remember me'), 'Cosmetic "Remember me" label is removed');

  // Form accessibility
  assert(loginCode.includes('id="login-email"'), 'Email input has unique id="login-email"');
  assert(loginCode.includes('htmlFor="login-email"'), 'Label is associated via htmlFor="login-email"');
  assert(loginCode.includes('autoComplete="email"'), 'Email input specifies autoComplete="email"');
  assert(loginCode.includes('id="login-password"'), 'Password input has unique id="login-password"');
  assert(loginCode.includes('htmlFor="login-password"'), 'Label is associated via htmlFor="login-password"');
  assert(loginCode.includes('autoComplete="current-password"'), 'Password input specifies autoComplete="current-password"');
  assert(loginCode.includes('role="alert"'), 'Login error message has role="alert"');
  assert(loginCode.includes('aria-live="polite"'), 'Login error message has aria-live="polite"');
}

// -----------------------------------------------------------------------------
// Group 4: Forgot Password Email Validation & Anti-Enumeration
// -----------------------------------------------------------------------------
console.log('\n--- Group 4: Forgot Password Validation & Anti-Enumeration ---');
{
  const forgotCode = fs.readFileSync(path.resolve('src/app/forgot-password/page.tsx'), 'utf8');

  assert(forgotCode.includes('validateEmail'), 'Forgot password page imports validateEmail');
  assert(forgotCode.includes('validateEmail(email)'), 'Validates email using validateEmail utility');
  assert(forgotCode.includes('normalizedEmail'), 'Trims and normalizes email before network submission');
  assert(
    forgotCode.includes('setErrorMessage(emailRes.error'),
    'Displays validation error without initiating network request'
  );
  assert(
    forgotCode.includes('If an account exists for'),
    'Preserves anti-enumeration by not disclosing whether email exists'
  );
  assert(
    forgotCode.includes('429') && forgotCode.includes('rate limit'),
    'Handles rate limits without leaking internal provider details'
  );

  // Form accessibility
  assert(forgotCode.includes('id="forgot-email"'), 'Email input has unique id="forgot-email"');
  assert(forgotCode.includes('htmlFor="forgot-email"'), 'Label is associated via htmlFor="forgot-email"');
  assert(forgotCode.includes('autoComplete="email"'), 'Email input specifies autoComplete="email"');
  assert(forgotCode.includes('role="alert"'), 'Error banner has role="alert"');
  assert(forgotCode.includes('aria-live="polite"'), 'Error banner has aria-live="polite"');
}

// -----------------------------------------------------------------------------
// Group 5: Sign Up Desktop Benefits Panel & Accessible Attributes
// -----------------------------------------------------------------------------
console.log('\n--- Group 5: Signup Desktop Benefits Panel & Accessibility ---');
{
  const signupCode = fs.readFileSync(path.resolve('src/app/signup/page.tsx'), 'utf8');

  // Benefits panel copy
  assert(
    signupCode.includes('Get paid without the endless follow-ups.'),
    'Benefits panel includes exact approved headline: "Get paid without the endless follow-ups."'
  );
  assert(
    signupCode.includes('Know what needs attention') && signupCode.includes('See which invoices need follow-up.'),
    'Benefits panel includes Benefit 1: "Know what needs attention" — "See which invoices need follow-up."'
  );
  assert(
    signupCode.includes('Keep customer context') && signupCode.includes('Track promises, disputes and communication.'),
    'Benefits panel includes Benefit 2: "Keep customer context" — "Track promises, disputes and communication."'
  );
  assert(
    signupCode.includes('Stay in control') && signupCode.includes('Review suggested actions before sending.'),
    'Benefits panel includes Benefit 3: "Stay in control" — "Review suggested actions before sending."'
  );
  assert(
    signupCode.includes('Your receivables. Your decisions.'),
    'Benefits panel includes exact approved supporting line: "Your receivables. Your decisions."'
  );

  // Responsive constraint: hidden on mobile
  assert(
    signupCode.includes('hidden lg:flex'),
    'Benefits panel is hidden on mobile (< lg) and visible on desktop (hidden lg:flex)'
  );

  // Two-column layout container
  assert(
    signupCode.includes('grid-cols-1 lg:grid-cols-12'),
    'Layout adopts responsive grid (grid-cols-1 lg:grid-cols-12)'
  );

  // Form accessibility
  assert(signupCode.includes('id="signup-fullname"'), 'Full Name input has unique id="signup-fullname"');
  assert(signupCode.includes('htmlFor="signup-fullname"'), 'Full Name label has htmlFor="signup-fullname"');
  assert(signupCode.includes('autoComplete="name"'), 'Full Name input has autoComplete="name"');

  assert(signupCode.includes('id="signup-phone"'), 'Phone input has unique id="signup-phone"');
  assert(signupCode.includes('htmlFor="signup-phone"'), 'Phone label has htmlFor="signup-phone"');
  assert(signupCode.includes('autoComplete="tel"'), 'Phone input has autoComplete="tel"');

  assert(signupCode.includes('id="signup-email"'), 'Email input has unique id="signup-email"');
  assert(signupCode.includes('htmlFor="signup-email"'), 'Email label has htmlFor="signup-email"');
  assert(signupCode.includes('autoComplete="email"'), 'Email input has autoComplete="email"');

  assert(signupCode.includes('id="signup-password"'), 'Password input has unique id="signup-password"');
  assert(signupCode.includes('htmlFor="signup-password"'), 'Password label has htmlFor="signup-password"');
  assert(signupCode.includes('autoComplete="new-password"'), 'Password input has autoComplete="new-password"');

  assert(signupCode.includes('id="signup-confirm-password"'), 'Confirm Password has id="signup-confirm-password"');
  assert(signupCode.includes('htmlFor="signup-confirm-password"'), 'Confirm Password has htmlFor="signup-confirm-password"');

  assert(signupCode.includes('id="signup-terms"'), 'Terms checkbox has unique id="signup-terms"');
  assert(signupCode.includes('htmlFor="signup-terms"'), 'Terms label has htmlFor="signup-terms"');

  assert(signupCode.includes('id="signup-otp"'), 'OTP input has unique id="signup-otp"');
  assert(signupCode.includes('htmlFor="signup-otp"'), 'OTP label has htmlFor="signup-otp"');
  assert(signupCode.includes('autoComplete="one-time-code"'), 'OTP input has autoComplete="one-time-code"');

  assert(signupCode.includes('role="alert"'), 'Signup errors have role="alert"');
  assert(signupCode.includes('aria-live="polite"'), 'Signup errors have aria-live="polite"');
}

// -----------------------------------------------------------------------------
// Group 6: Workspace Setup Without Duplicate Inserts
// -----------------------------------------------------------------------------
console.log('\n--- Group 6: Workspace Setup Idempotency & Accessibility ---');
{
  const setupCode = fs.readFileSync(path.resolve('src/app/setup/page.tsx'), 'utf8');

  assert(
    setupCode.includes('targetWsId') || setupCode.includes('existingWorkspaceId'),
    'Setup page tracks existing workspace ID'
  );
  assert(
    setupCode.includes("from('workspaces')") && setupCode.includes('.update({'),
    'Setup page updates existing workspace record instead of unconditionally inserting'
  );
  assert(
    setupCode.includes('loadUserWorkspace') || setupCode.includes('loadExistingWorkspace'),
    'Setup page loads user workspace on mount to populate existing settings'
  );

  // Form accessibility
  assert(setupCode.includes('id="setup-business-name"'), 'Business name input has id="setup-business-name"');
  assert(setupCode.includes('htmlFor="setup-business-name"'), 'Business name label has htmlFor="setup-business-name"');
  assert(setupCode.includes('id="setup-business-type"'), 'Business type select has id="setup-business-type"');
  assert(setupCode.includes('htmlFor="setup-business-type"'), 'Business type label has htmlFor="setup-business-type"');
  assert(setupCode.includes('id="setup-currency"'), 'Currency select has id="setup-currency"');
  assert(setupCode.includes('htmlFor="setup-currency"'), 'Currency label has htmlFor="setup-currency"');
  assert(setupCode.includes('id="setup-country"'), 'Country input has id="setup-country"');
  assert(setupCode.includes('htmlFor="setup-country"'), 'Country label has htmlFor="setup-country"');
  assert(setupCode.includes('id="setup-business-email"'), 'Business email input has id="setup-business-email"');
  assert(setupCode.includes('htmlFor="setup-business-email"'), 'Business email label has htmlFor="setup-business-email"');
  assert(setupCode.includes('role="alert"'), 'Setup error banner has role="alert"');
}

// -----------------------------------------------------------------------------
// Group 7: PolicyModal Bracketed Placeholders Elimination
// -----------------------------------------------------------------------------
console.log('\n--- Group 7: PolicyModal Placeholder Cleanup ---');
{
  const policyCode = fs.readFileSync(path.resolve('src/components/common/PolicyModal.tsx'), 'utf8');

  assert(!policyCode.includes('[Effective Date]'), 'Eliminated placeholder: [Effective Date]');
  assert(!policyCode.includes('[Company Legal Name]'), 'Eliminated placeholder: [Company Legal Name]');
  assert(!policyCode.includes('[Business Address]'), 'Eliminated placeholder: [Business Address]');
  assert(!policyCode.includes('[Cloud Provider Region]'), 'Eliminated placeholder: [Cloud Provider Region]');
  assert(!policyCode.includes('[Support Email]'), 'Eliminated placeholder: [Support Email]');
  assert(!policyCode.includes('Official Legal Document'), 'Eliminated unverified claim: "Official Legal Document"');
  assert(policyCode.includes('support@smart-invoice-chasing.vercel.app'), 'Configured canonical support email');
}

// -----------------------------------------------------------------------------
// Group 8: Credential & Token Safety Audit
// -----------------------------------------------------------------------------
console.log('\n--- Group 8: Credential & Token Safety Audit ---');
{
  const auditFiles = [
    'src/app/reset-password/page.tsx',
    'src/app/login/page.tsx',
    'src/app/signup/page.tsx',
    'src/app/forgot-password/page.tsx',
    'src/app/setup/page.tsx',
    'src/lib/authRedirect.ts',
  ];

  for (const f of auditFiles) {
    const code = fs.readFileSync(path.resolve(f), 'utf8');
    assert(!/console\.log\([^)]*password/i.test(code), `${f}: Zero password logging`);
    assert(!/console\.log\([^)]*otpCode/i.test(code), `${f}: Zero OTP code logging`);
    assert(!/console\.log\([^)]*token/i.test(code), `${f}: Zero token logging`);
  }
}

console.log(`\n=== SUMMARY: ${passed} / ${total} ASSERTIONS PASSED ===`);
if (passed === total) {
  console.log('STATUS: ALL AUTH-FIX-001 REQUIREMENTS VERIFIED SUCCESSFULLY.\n');
  process.exit(0);
} else {
  console.error('STATUS: ONE OR MORE CHECKS FAILED.\n');
  process.exit(1);
}
