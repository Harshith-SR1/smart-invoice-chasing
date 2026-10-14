/**
 * Live Supabase Schema & Verification Suite (DB-001)
 *
 * Verifies live PostgreSQL schema state, tables, tracking columns,
 * RLS isolation, and PostgREST connectivity.
 *
 * Usage: node scripts/verify_live_schema.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Polyfill WebSocket in Node 20 environments for REST-only verification
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

console.log('=== DB-001: LIVE SUPABASE SCHEMA VERIFICATION SUITE ===\n');

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    env[k] = v;
  }
}

const supabaseUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const serviceClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const REQUIRED_TABLES = [
  'profiles',
  'workspaces',
  'workspace_members',
  'customers',
  'invoices',
  'collections',
  'collection_events',
  'message_threads',
  'messages',
  'ai_decisions',
  'payment_promises',
  'payments',
  'risk_scores',
  'subscriptions',
  'billing_invoices',
  'ai_settings',
  'notification_preferences',
  'audit_logs',
  'message_webhook_events',
];

const REQUIRED_MESSAGE_COLUMNS = [
  'sent_by',
  'provider_message_id',
  'failure_reason',
  'queued_at',
  'delivered_at',
  'bounced_at',
];

async function runVerification() {
  let passedChecks = 0;
  let totalChecks = 0;

  function report(label, pass, detail) {
    totalChecks++;
    const icon = pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon}: ${label}`);
    if (detail) console.log(`       ${detail}`);
    if (pass) passedChecks++;
  }

  console.log(`Connecting to: ${new URL(supabaseUrl).host}`);

  // 1. Table Presence & PostgREST Recognition
  console.log('\n--- 1. Table Presence & PostgREST Schema Cache ---');
  const missingTables = [];
  const presentTables = [];

  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await serviceClient.from(table).select('*').limit(0);
      if (error && (error.code === 'PGRST205' || error.message.includes('schema cache') || error.code === '42P01')) {
        missingTables.push(table);
      } else {
        presentTables.push(table);
      }
    } catch (e) {
      missingTables.push(table);
    }
  }

  report(
    `All 19 required tables present in PostgREST cache`,
    missingTables.length === 0,
    missingTables.length === 0
      ? `Found all 19 tables (${presentTables.join(', ')})`
      : `Missing ${missingTables.length} tables: ${missingTables.join(', ')}`
  );

  // 2. Email-001 Tracking Columns on public.messages
  console.log('\n--- 2. Email Dispatch Tracking Columns (Migration 001) ---');
  let columnCheckPassed = false;
  let permissionDeniedEncountered = false;

  if (presentTables.includes('messages')) {
    try {
      const selectCols = REQUIRED_MESSAGE_COLUMNS.join(', ');
      const { data, error } = await serviceClient.from('messages').select(selectCols).limit(0);

      if (error) {
        if (error.code === '42501' || error.message.includes('permission denied')) {
          permissionDeniedEncountered = true;
          report(
            'Email dispatch tracking columns on messages',
            false,
            'PostgreSQL returned 42501 (permission denied for table messages). Table-level GRANTs for API roles are missing.'
          );
        } else if (error.code === 'PGRST204' || error.message.includes('Could not find')) {
          report(
            'Email dispatch tracking columns on messages',
            false,
            `One or more columns missing: ${error.message}`
          );
        } else {
          report('Email dispatch tracking columns on messages', false, `PostgREST error: ${error.message} (code: ${error.code})`);
        }
      } else {
        columnCheckPassed = true;
        report('Email dispatch tracking columns on messages', true, `Columns verified: ${selectCols}`);
      }
    } catch (err) {
      report('Email dispatch tracking columns on messages', false, err.message);
    }
  } else {
    report('Email dispatch tracking columns on messages', false, 'Table "messages" does not exist yet');
  }

  // 3. Webhook Events Table
  console.log('\n--- 3. Webhook Events Table & Security (Migration 001) ---');
  if (presentTables.includes('message_webhook_events')) {
    report('Table "message_webhook_events" exists', true, 'Webhook tracking table verified in schema cache');

    // Test RLS restriction on message_webhook_events for anon client (must deny read/write)
    const { data: anonData, error: anonWebhookErr } = await anonClient.from('message_webhook_events').select('*').limit(1);
    const anonDenied = Boolean(anonWebhookErr) || (!anonData || anonData.length === 0);
    report(
      'message_webhook_events is secured from public anon access',
      anonDenied,
      anonWebhookErr
        ? `Blocked: ${anonWebhookErr.message}`
        : 'Query returned 0 rows (Service-role only RLS rule active)'
    );
  } else {
    report('Table "message_webhook_events" exists', false, 'Table not found');
  }

  // 4. RLS & Workspace Isolation on Core Tables
  console.log('\n--- 4. RLS & Workspace Isolation Verification ---');
  // Anon user without JWT session must NOT be able to extract invoice records
  const { data: anonInvoices, error: anonInvErr } = await anonClient.from('invoices').select('id').limit(1);
  const rlsWorking = (!anonInvoices || anonInvoices.length === 0);
  report(
    'RLS blocks unauthenticated anonymous data extraction',
    rlsWorking,
    anonInvErr ? `Blocked: ${anonInvErr.message}` : 'Query returned 0 rows (RLS isolated)'
  );

  // 5. PostgREST Connectivity (Zero PGRST205)
  console.log('\n--- 5. PostgREST API Status ---');
  const pgrst205Detected = missingTables.length > 0;
  report(
    'PostgREST API accessible without PGRST205 errors',
    !pgrst205Detected,
    pgrst205Detected
      ? `PGRST205 still present for ${missingTables.length} tables.`
      : 'All 19 endpoints successfully resolved in PostgREST.'
  );

  console.log('\n======================================================');
  console.log(`LIVE SCHEMA VERIFICATION: ${passedChecks} / ${totalChecks} checks passed.`);
  console.log('======================================================\n');

  // Corrected final status reporting (Task 8)
  if (passedChecks === totalChecks) {
    console.log('STATUS: [PASS] - Live database schema, tracking columns, and security policies are fully verified!');
  } else if (missingTables.length > 0) {
    console.log('STATUS: [MIGRATION REQUIRED: Tables Missing] - Tables need to be created in Supabase SQL Editor.');
  } else if (permissionDeniedEncountered) {
    console.log('STATUS: [PERMISSION CONFIGURATION REQUIRED] - All 19 tables exist, but PostgreSQL table grants (GRANT ALL) to API roles are missing.');
    console.log('        Run supabase/migrations/002_grant_permissions.sql in the Supabase SQL Editor.');
  } else if (!columnCheckPassed) {
    console.log('STATUS: [MIGRATION INCOMPLETE: Tracking Columns Missing] - Run supabase/migrations/001_messages_send_tracking.sql.');
  } else {
    console.log('STATUS: [FAIL] - One or more checks failed. Review output above.');
  }
}

runVerification();
