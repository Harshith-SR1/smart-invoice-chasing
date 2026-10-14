/**
 * Live Database Schema & Table Inspector
 *
 * Performs read-only probes against the live Supabase instance
 * to inspect which tables currently exist in the PostgREST schema cache.
 * Usage: node scripts/inspect_live_db.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Polyfill WebSocket in Node 20 environments for REST-only probes
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

console.log('=== LIVE SUPABASE SCHEMA & TABLE INSPECTION ===\n');

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

const client = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EXPECTED_TABLES = [
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
  'message_webhook_events', // From migration 001
];

async function inspectTables() {
  console.log(`Checking ${EXPECTED_TABLES.length} expected tables against live Supabase project...`);
  console.log(`Host: ${new URL(supabaseUrl).host}\n`);

  const results = [];

  for (const table of EXPECTED_TABLES) {
    try {
      const { data, error, status } = await client.from(table).select('*').limit(0);

      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('schema cache') || error.code === '42P01') {
          results.push({ table, status: 'MISSING', detail: 'Table not found in schema cache' });
        } else if (error.code === '42501' || status === 403) {
          results.push({ table, status: 'EXISTS (RLS Denied)', detail: 'Table exists but RLS denied select' });
        } else {
          results.push({ table, status: 'ERROR', detail: `Code ${error.code}: ${error.message}` });
        }
      } else {
        results.push({ table, status: 'EXISTS', detail: 'Accessible via PostgREST' });
      }
    } catch (err) {
      results.push({ table, status: 'CONN_ERR', detail: err.message });
    }
  }

  console.log('------------------------------------------------------------');
  console.log('| Table Name                  | Live Status    | Detail');
  console.log('------------------------------------------------------------');
  for (const r of results) {
    console.log(`| ${r.table.padEnd(27)} | ${r.status.padEnd(14)} | ${r.detail}`);
  }
  console.log('------------------------------------------------------------\n');

  const existingCount = results.filter((r) => r.status.startsWith('EXISTS')).length;
  const missingCount = results.filter((r) => r.status === 'MISSING').length;

  console.log(`Summary: ${existingCount} tables present, ${missingCount} tables missing.`);
  
  if (existingCount === 0 && missingCount === EXPECTED_TABLES.length) {
    console.log('CONCLUSION: The live database public schema is currently completely empty.');
    console.log('            No application tables or conflicting objects have been created yet.');
  } else if (existingCount > 0) {
    console.log(`CONCLUSION: The database is partially initialized (${existingCount} tables present).`);
  }
}

inspectTables();
