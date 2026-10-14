/**
 * Diagnostic Script: Table-by-Table Permission Inspector
 *
 * Inspects the exact PostgREST response code and message for all 19 tables
 * using serviceClient and anonClient.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
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

const TABLES = [
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

async function diagnose() {
  console.log('=== TABLE PERMISSION DIAGNOSTIC ===\n');

  console.log('Checking serviceClient access across all tables:');
  for (const table of TABLES) {
    const { data, error, status } = await serviceClient.from(table).select('*').limit(0);
    if (error) {
      console.log(`❌ [${table.padEnd(25)}] HTTP ${status} | Code: ${error.code} | Msg: ${error.message}`);
    } else {
      console.log(`✅ [${table.padEnd(25)}] HTTP ${status} | OK (Accessible)`);
    }
  }

  console.log('\nChecking anonClient access across all tables (RLS verification):');
  for (const table of ['workspaces', 'invoices', 'messages', 'message_webhook_events']) {
    const { data, error, status } = await anonClient.from(table).select('*').limit(0);
    if (error) {
      console.log(`🔒 [${table.padEnd(25)}] HTTP ${status} | Code: ${error.code} | Msg: ${error.message}`);
    } else {
      console.log(`⚠️ [${table.padEnd(25)}] HTTP ${status} | Accessible (Rows returned: ${data?.length})`);
    }
  }
}

diagnose();
