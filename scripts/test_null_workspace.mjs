import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

const envPath = path.join(process.cwd(), '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function testInsert() {
  const { data, error } = await client.from('message_webhook_events').insert({
    workspace_id: null,
    message_id: null,
    provider_message_id: 'probe_null_test_01',
    event_type: 'test.probe',
    event_data: { test: true }
  });

  console.log('Result with workspace_id: null ->', error ? `Code ${error.code}: ${error.message}` : 'SUCCESS');
}

testInsert();
