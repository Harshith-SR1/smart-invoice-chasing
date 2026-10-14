/**
 * Diagnostic tool to check Resend API key validity and domain verification status.
 * Never prints secret keys or tokens.
 */

import fs from 'node:fs';
import path from 'node:path';

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

const apiKey = env.RESEND_API_KEY;
if (!apiKey) {
  console.log('RESEND_API_KEY is missing from .env.local');
  process.exit(1);
}

console.log('Testing Resend API Key validity against Resend REST API...');

async function checkResend() {
  try {
    const domainsRes = await fetch('https://api.resend.com/domains', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!domainsRes.ok) {
      console.log(`Resend API returned status ${domainsRes.status} (${domainsRes.statusText})`);
      const errText = await domainsRes.text();
      console.log('Provider response:', errText);
      return;
    }

    const data = await domainsRes.json();
    console.log('Resend API key is VALID.');
    console.log(`Domains found in account: ${data.data?.length ?? 0}`);
    if (data.data && data.data.length > 0) {
      for (const d of data.data) {
        console.log(` - Domain: "${d.name}", Status: "${d.status}", Region: "${d.region}"`);
      }
    } else {
      console.log('No custom domains have been added to this Resend account yet.');
      console.log('Note: Resend provides "onboarding@resend.dev" as a free testing sender for delivery to the registered account email.');
    }

    const apiKeysRes = await fetch('https://api.resend.com/api-keys', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (apiKeysRes.ok) {
      const keysData = await apiKeysRes.json();
      console.log(`API keys count in account: ${keysData.data?.length ?? 0}`);
    }
  } catch (err) {
    console.error('Network or fetch error connecting to Resend:', err.message);
  }
}

checkResend();
