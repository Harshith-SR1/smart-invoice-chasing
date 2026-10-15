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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function check() {
  const { data: workspaces, error: wsErr } = await client.from('workspaces').select('id, business_name').limit(5);
  console.log('Workspaces found:', workspaces?.length ?? 0);
  if (workspaces) {
    for (const w of workspaces) console.log(` - Workspace: ${w.id} (${w.business_name})`);
  }

  const { data: messages, error: msgErr } = await client.from('messages').select('id, workspace_id, provider_message_id, delivery_status').limit(10);
  console.log('Messages found:', messages?.length ?? 0);
  if (messages) {
    for (const m of messages) console.log(` - Message: ${m.id}, workspace: ${m.workspace_id}, providerId: ${m.provider_message_id}, status: ${m.delivery_status}`);
  }

  const { data: events, error: evErr } = await client.from('message_webhook_events').select('*').limit(5);
  console.log('Webhook events found:', events?.length ?? 0, evErr ? evErr.message : '');
}

check();
