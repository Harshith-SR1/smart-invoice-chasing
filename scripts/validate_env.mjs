/**
 * Safe Local Environment Configuration Validator
 *
 * Verifies environment variables without making network calls or printing secret values.
 * Usage: node scripts/validate_env.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

console.log('=== SMART INVOICE CHASING: ENVIRONMENT CONFIGURATION AUDIT ===\n');

const projectRoot = process.cwd();
const envLocalPath = path.join(projectRoot, '.env.local');
const envExamplePath = path.join(projectRoot, '.env.example');
const gitignorePath = path.join(projectRoot, '.gitignore');

// 1. Verify .gitignore protection
console.log('--- 1. Git Protection Audit ---');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  const ignoresEnv = gitignoreContent.split('\n').some((line) => {
    const trimmed = line.trim();
    return trimmed === '.env*' || trimmed === '.env.local' || trimmed === '.env*.local';
  });

  if (ignoresEnv) {
    console.log('✅ PASS: .env.local is protected by .gitignore');
  } else {
    console.warn('⚠️ WARNING: .env.local might not be explicitly ignored in .gitignore');
  }
} else {
  console.log('ℹ️ NOTE: No .gitignore found in current directory.');
}

// 2. Parse .env.local without exposing values
console.log('\n--- 2. File Presence Audit ---');
if (!fs.existsSync(envLocalPath)) {
  console.error('❌ FAIL: .env.local does not exist. Run setup to generate it.');
  process.exit(1);
}
console.log('✅ PASS: .env.local exists on disk');

const envContent = fs.readFileSync(envLocalPath, 'utf-8');
const parsed = {};
const duplicates = [];
const lines = envContent.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (parsed[key] !== undefined) {
      duplicates.push({ key, line: i + 1 });
    }
    parsed[key] = val;
  }
}

if (duplicates.length > 0) {
  console.log('⚠️ WARNING: Duplicate variable definitions detected:');
  duplicates.forEach((d) => console.log(`   - ${d.key} on line ${d.line} overwrote earlier value`));
}

// 3. Validation Rules
console.log('\n--- 3. Variables & Boundaries Audit ---');

const PLACEHOLDERS = [
  'placeholder',
  'your_project',
  'your-supabase',
  'your_supabase',
  're_your_resend',
  'whsec_your_webhook',
  'verified-sender@yourdomain',
  'yourdomain.com',
];

function checkStatus(key, value, options = {}) {
  if (!value || value.length === 0) {
    return { status: 'MISSING', reason: 'Variable not set in .env.local' };
  }
  const matchedPh = PLACEHOLDERS.find((p) => value.toLowerCase().includes(p.toLowerCase()));
  if (matchedPh) {
    return { 
      status: 'PLACEHOLDER', 
      reason: `Still contains template placeholder '${matchedPh}' (length: ${value.length})` 
    };
  }
  if (options.isUrl) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        return { status: 'INVALID', reason: 'Must be an HTTP(S) URL' };
      }
    } catch {
      return { status: 'INVALID', reason: 'Invalid URL format' };
    }
  }
  if (options.prefix && !value.startsWith(options.prefix)) {
    return { status: 'WARNING', reason: `Expected prefix '${options.prefix}'` };
  }
  return { status: 'CONFIGURED', reason: `Value is set (${value.length} characters)` };
}

// Define specs
const specs = [
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    label: 'Supabase Project URL',
    scope: 'Client (Public)',
    required: true,
    isUrl: true,
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    label: 'Supabase Anon Key',
    scope: 'Client (Public)',
    required: true,
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    label: 'Supabase Service Role Key',
    scope: 'Server-Only (Private)',
    required: true,
  },
  {
    key: 'NEXT_PUBLIC_SITE_URL',
    label: 'App Site URL',
    scope: 'Client (Public)',
    required: false,
    isUrl: true,
  },
  {
    key: 'RESEND_API_KEY',
    label: 'Resend API Key',
    scope: 'Server-Only (Private)',
    required: true,
    prefix: 're_',
  },
  {
    key: 'RESEND_FROM_EMAIL',
    label: 'Resend From Address',
    scope: 'Server-Only (Private)',
    required: true,
  },
  {
    key: 'RESEND_WEBHOOK_SECRET',
    label: 'Resend Webhook Secret',
    scope: 'Server-Only (Private)',
    required: false,
    prefix: 'whsec_',
  },
];

let configuredCount = 0;
let placeholderCount = 0;
let missingCount = 0;

for (const spec of specs) {
  const result = checkStatus(spec.key, parsed[spec.key], spec);
  const icon =
    result.status === 'CONFIGURED'
      ? '🟢'
      : result.status === 'PLACEHOLDER'
      ? '🟡'
      : result.status === 'WARNING'
      ? '🟠'
      : '🔴';

  console.log(`${icon} [${result.status.padEnd(11)}] ${spec.key}`);
  console.log(`     Scope:   ${spec.scope}`);
  console.log(`     Detail:  ${result.reason}`);

  if (result.status === 'CONFIGURED') configuredCount++;
  else if (result.status === 'PLACEHOLDER') placeholderCount++;
  else missingCount++;
}

// 4. Security Isolation Audit
console.log('\n--- 4. Security Isolation Audit ---');
const leaks = Object.keys(parsed).filter(
  (k) =>
    k.startsWith('NEXT_PUBLIC_') &&
    (k.includes('SERVICE_ROLE') || k.includes('RESEND_API') || k.includes('WEBHOOK_SECRET'))
);

if (leaks.length === 0) {
  console.log('✅ PASS: No private server credentials are exposed via NEXT_PUBLIC_ prefixes.');
} else {
  console.error('❌ CRITICAL SECURITY LEAK: Private variables exposed to client:');
  leaks.forEach((k) => console.error(`   - ${k}`));
}

// 5. Summary
console.log('\n======================================================');
console.log(`AUDIT SUMMARY:`);
console.log(`  Configured:   ${configuredCount} / ${specs.length}`);
console.log(`  Placeholders: ${placeholderCount} / ${specs.length} (pending real credentials)`);
console.log(`  Missing:      ${missingCount} / ${specs.length}`);
console.log('======================================================\n');

if (placeholderCount > 0) {
  console.log('ℹ️  Action Required: Replace placeholders in .env.local with your real keys.');
} else if (configuredCount === specs.length) {
  console.log('🚀 Ready: All local environment variables are properly formatted!');
}
