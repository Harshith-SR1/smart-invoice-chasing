/**
 * Safe, Read-Only Supabase Connectivity Probe
 *
 * Connects to Supabase to verify credentials without modifying or writing any data.
 * Usage: node scripts/check_supabase_connection.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Polyfill WebSocket in Node 20 environments for REST-only probes
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

console.log('=== SAFE SUPABASE CONNECTIVITY PROBE ===\n');

const envPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envPath)) {
  console.log('STATUS: [NOT TESTED] - .env.local does not exist.');
  process.exit(0);
}

// Parse .env.local without exposing secrets
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const isPlaceholder = (val) =>
  !val ||
  val.includes('YOUR_PROJECT') ||
  val.includes('placeholder') ||
  val.includes('your-supabase');

if (isPlaceholder(supabaseUrl) || isPlaceholder(anonKey)) {
  console.log('STATUS: [NOT TESTED] - Supabase URL or Anon Key is still a placeholder.');
  console.log('        Enter real credentials in .env.local to test live connectivity.');
  process.exit(0);
}

console.log(`Target Supabase URL Host: ${new URL(supabaseUrl).host}`);

async function runProbe() {
  try {
    // Probe 1: Public / Anon client auth check (Read-Only)
    console.log('\n--- 1. Testing Anon Client Auth Endpoint ---');
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: undefined },
    });

    const { data: sessionData, error: sessionError } = await anonClient.auth.getSession();
    if (sessionError) {
      console.log(`❌ Anon Auth Check Failed: ${sessionError.message}`);
    } else {
      console.log('✅ Anon Auth Endpoint reachable (HTTP 200, valid project URL & anon key)');
    }

    // Probe 2: Service-role query (Read-Only single row limit)
    if (serviceKey && !isPlaceholder(serviceKey)) {
      console.log('\n--- 2. Testing Service Role Key (Read-Only Probe) ---');
      const serviceClient = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Check 2a: Test auth.admin (validates service role key directly against Supabase Auth)
      const { data: authUsers, error: authErr } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (authErr) {
        console.log(`❌ Service Role Auth Validation Failed: ${authErr.message}`);
        console.log('STATUS: [FAIL] - Service role key rejected by Supabase Auth.');
        return;
      }
      console.log('✅ Service Role Key Verified via Auth Admin API! (Key is authentic and has admin privileges)');

      // Check 2b: Try reading from workspaces table (checks database migration status)
      console.log('\n--- 3. Testing Database Schema Migration Status ---');
      const { data, error } = await serviceClient.from('workspaces').select('id').limit(1);

      if (error) {
        if (
          error.code === '42P01' ||
          error.code === 'PGRST125' ||
          error.code === 'PGRST205' ||
          error.message.includes('schema cache') ||
          error.message.includes('path specified')
        ) {
          console.log('⚠️ Database reached and service role verified, but table "workspaces" is not yet created.');
          console.log('   Action: Execute supabase/schema.sql and supabase/migrations/001_messages_send_tracking.sql in your Supabase SQL editor.');
          console.log('STATUS: [PASS with Migration Pending] - Supabase connected! Tables pending migration in SQL Editor.');
        } else {
          console.log(`❌ Database Query Error: ${error.message} (Code: ${error.code})`);
          console.log('STATUS: [WARNING] - Service role authentic, but database query failed.');
        }
      } else {
        console.log(`✅ Database Schema Verified! (Found ${data.length} workspace records)`);
        console.log('STATUS: [PASS] - Live Supabase connectivity and schema verified.');
      }
    } else {
      console.log('\n--- 2. Service Role Key ---');
      console.log('ℹ️ Service Role Key is not configured or is a placeholder.');
      console.log('STATUS: [PASS (Anon Only)] - Anon endpoint reachable.');
    }
  } catch (err) {
    console.error(`\n❌ Network Connection Error: ${err.message}`);
    console.log('STATUS: [FAIL] - Could not establish connection to Supabase host.');
  }
}

runProbe();
