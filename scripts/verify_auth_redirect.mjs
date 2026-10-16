/**
 * OAUTH-REDIRECT-001: Comprehensive Google OAuth & Auth Callback Verification Suite
 * 
 * Verifies:
 * 1. Production redirect URL resolution (getAuthRedirectUrl)
 * 2. Localhost development preservation
 * 3. Production fallback protection (never falls back to localhost)
 * 4. Server-side request origin resolution (getRequestOrigin with x-forwarded headers)
 * 5. Supabase OAuth URL generation with canonical redirectTo
 * 6. Code audit: no naked window.location.origin in signInWithOAuth
 * 7. Middleware OAuth code forwarding from / and /login to /auth/callback
 * 8. Live callback route error handling and redirect behavior
 */

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getAuthRedirectUrl, getBaseUrl, getRequestOrigin, PRODUCTION_SITE_URL } from '../src/lib/authRedirect.ts';

// Parse .env.local manually
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

console.log('=== OAUTH-REDIRECT-001: AUTH REDIRECT & CALLBACK VERIFICATION ===\n');

// -----------------------------------------------------------------------------
// Test Group 1: Production URL Resolution
// -----------------------------------------------------------------------------
console.log('--- Group 1: Production URL Resolution ---');
{
  const redirectUrl = getAuthRedirectUrl('/auth/callback');
  assert(
    redirectUrl === `${PRODUCTION_SITE_URL}/auth/callback`,
    `getAuthRedirectUrl('/auth/callback') resolves to canonical production callback: ${redirectUrl}`
  );

  const resetUrl = getAuthRedirectUrl('/reset-password');
  assert(
    resetUrl === `${PRODUCTION_SITE_URL}/reset-password`,
    `getAuthRedirectUrl('/reset-password') resolves to canonical password reset: ${resetUrl}`
  );

  const slashUrl = getAuthRedirectUrl('auth/callback');
  assert(
    slashUrl === `${PRODUCTION_SITE_URL}/auth/callback`,
    `getAuthRedirectUrl sanitizes missing leading slash: ${slashUrl}`
  );
}

// -----------------------------------------------------------------------------
// Test Group 2: Localhost Development Preservation
// -----------------------------------------------------------------------------
console.log('\n--- Group 2: Localhost Development Preservation ---');
{
  // Simulate browser environment on localhost
  const originalWindow = globalThis.window;
  try {
    globalThis.window = {
      location: {
        origin: 'http://localhost:3000',
        hostname: 'localhost',
      },
    };

    const localRedirect = getAuthRedirectUrl('/auth/callback');
    assert(
      localRedirect === 'http://localhost:3000/auth/callback',
      `Local development on localhost preserves local redirect: ${localRedirect}`
    );

    // Test 127.0.0.1
    globalThis.window = {
      location: {
        origin: 'http://127.0.0.1:3000',
        hostname: '127.0.0.1',
      },
    };
    const ipRedirect = getAuthRedirectUrl('/auth/callback');
    assert(
      ipRedirect === 'http://127.0.0.1:3000/auth/callback',
      `Local development on 127.0.0.1 preserves local redirect: ${ipRedirect}`
    );

    // Test production browser domain
    globalThis.window = {
      location: {
        origin: 'https://smart-invoice-chasing.vercel.app',
        hostname: 'smart-invoice-chasing.vercel.app',
      },
    };
    const prodBrowserRedirect = getAuthRedirectUrl('/auth/callback');
    assert(
      prodBrowserRedirect === 'https://smart-invoice-chasing.vercel.app/auth/callback',
      `Browser on production domain uses window.location.origin: ${prodBrowserRedirect}`
    );
  } finally {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      delete globalThis.window;
    }
  }
}

// -----------------------------------------------------------------------------
// Test Group 3: Production Fallback Protection (Never localhost in production)
// -----------------------------------------------------------------------------
console.log('\n--- Group 3: Production Fallback Protection ---');
{
  const originalEnv = process.env.NODE_ENV;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

    const safeUrl = getAuthRedirectUrl('/auth/callback');
    assert(
      safeUrl === `${PRODUCTION_SITE_URL}/auth/callback`,
      `In production mode, localhost NEXT_PUBLIC_SITE_URL is rejected in favor of canonical URL: ${safeUrl}`
    );
  } finally {
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    if (originalSiteUrl !== undefined) {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  }
}

// -----------------------------------------------------------------------------
// Test Group 4: Server-Side Request Origin Resolution
// -----------------------------------------------------------------------------
console.log('\n--- Group 4: Server-Side Request Origin Resolution ---');
{
  // 4a. Vercel reverse proxy with x-forwarded headers
  const reqVercel = new Request('https://internal-lambda/auth/callback?code=test1234', {
    headers: {
      'x-forwarded-host': 'smart-invoice-chasing.vercel.app',
      'x-forwarded-proto': 'https',
    },
  });
  const originVercel = getRequestOrigin(reqVercel);
  assert(
    originVercel === 'https://smart-invoice-chasing.vercel.app',
    `getRequestOrigin resolves x-forwarded headers from Vercel: ${originVercel}`
  );

  // 4b. Local development request
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const reqLocal = new Request('http://localhost:3000/auth/callback?code=test1234', {
    headers: {
      host: 'localhost:3000',
    },
  });
  const originLocal = getRequestOrigin(reqLocal);
  assert(
    originLocal === 'http://localhost:3000',
    `getRequestOrigin preserves localhost in development: ${originLocal}`
  );

  // 4c. Production mode request with localhost header
  process.env.NODE_ENV = 'production';
  const reqProdMismatch = new Request('http://localhost:3000/auth/callback?code=test1234', {
    headers: {
      host: 'localhost:3000',
    },
  });
  const originProdSafe = getRequestOrigin(reqProdMismatch);
  assert(
    originProdSafe === PRODUCTION_SITE_URL,
    `getRequestOrigin rejects localhost in production mode: ${originProdSafe}`
  );
  if (originalEnv !== undefined) {
    process.env.NODE_ENV = originalEnv;
  } else {
    delete process.env.NODE_ENV;
  }
}

// -----------------------------------------------------------------------------
// Test Group 5: Supabase OAuth URL Generation
// -----------------------------------------------------------------------------
console.log('\n--- Group 5: Supabase OAuth Provider URL Generation ---');
{
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const targetRedirect = getAuthRedirectUrl('/auth/callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: targetRedirect,
        skipBrowserRedirect: true,
      },
    });

    assert(!error, 'Supabase signInWithOAuth executes without client error');
    assert(
      data?.url && data.url.includes(encodeURIComponent('https://smart-invoice-chasing.vercel.app/auth/callback')),
      `OAuth authorization URL embeds canonical redirect_to parameter: ${data?.url?.slice(0, 100)}...`
    );
  } else {
    console.log('  ⚠ SKIP: Live Supabase keys not available for OAuth URL test');
  }
}

// -----------------------------------------------------------------------------
// Test Group 6: Code Audit (No Naked origin in Auth Calls)
// -----------------------------------------------------------------------------
console.log('\n--- Group 6: Code Audit for Auth Redirect Consistency ---');
{
  const filesToCheck = [
    { file: 'src/app/login/page.tsx', name: 'Login Page' },
    { file: 'src/app/signup/page.tsx', name: 'Signup Page' },
    { file: 'src/components/auth/SignInModal.tsx', name: 'SignIn Modal' },
    { file: 'src/app/forgot-password/page.tsx', name: 'Forgot Password Page' },
    { file: 'src/app/auth/callback/route.ts', name: 'Auth Callback Route' },
  ];

  for (const { file, name } of filesToCheck) {
    const content = fs.readFileSync(path.resolve(file), 'utf8');
    const hasNakedOrigin = content.includes("window.location.origin : ''") || content.includes('window.location.origin : ""');
    assert(!hasNakedOrigin, `${name} does not use brittle naked window.location.origin fallback`);
  }

  // Check middleware forwards codes from /
  const middlewareContent = fs.readFileSync(path.resolve('src/middleware.ts'), 'utf8');
  assert(
    middlewareContent.includes("searchParams.has('code')") && middlewareContent.includes("callbackUrl.pathname = '/auth/callback'"),
    'src/middleware.ts forwards OAuth codes on / and /login to /auth/callback'
  );
}

// -----------------------------------------------------------------------------
// Test Group 7: Callback Error Redirect Handling
// -----------------------------------------------------------------------------
console.log('\n--- Group 7: Live Callback Route Error Handling ---');
{
  // Test simulated request to /auth/callback with OAuth error parameter
  const reqError = new Request('https://smart-invoice-chasing.vercel.app/auth/callback?error=access_denied&error_description=User+cancelled', {
    headers: {
      'x-forwarded-host': 'smart-invoice-chasing.vercel.app',
      'x-forwarded-proto': 'https',
    },
  });

  const { GET } = await import('../src/app/auth/callback/route.ts');
  const res = await GET(reqError);

  assert(res.status === 307 || res.status === 302, `Error redirect returns redirect status (${res.status})`);
  const location = res.headers.get('location');
  assert(
    location && location.startsWith('https://smart-invoice-chasing.vercel.app/login?error=') && location.includes('User'),
    `Error redirect sends user to production login with descriptive error: ${location}`
  );
}

console.log(`\n=== SUMMARY: ${passed} / ${total} ASSERTIONS PASSED ===`);
if (passed === total) {
  console.log('STATUS: ALL AUTH REDIRECT & CALLBACK CHECKS PASSED SUCCESSFULLY.\n');
  process.exit(0);
} else {
  console.error('STATUS: ONE OR MORE CHECKS FAILED.\n');
  process.exit(1);
}
