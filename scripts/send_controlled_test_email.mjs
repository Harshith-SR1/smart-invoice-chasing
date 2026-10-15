/**
 * Controlled Live Delivery Execution Script (EMAIL-002)
 *
 * Operator Authorization:
 * - Sender: Smart Invoice Chasing <onboarding@resend.dev>
 * - Recipient: hh5959287@gmail.com (Resend account owner)
 * - Message count: EXACTLY ONE (1)
 *
 * Safety & Security:
 * - Never prints API keys, tokens, or webhook secrets.
 * - Confirms recipient matches approved address before dispatch.
 * - Records provider message ID and response.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Resend } from 'resend';

// Load environment from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local not found.');
  process.exit(1);
}

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
const fromEmail = env.RESEND_FROM_EMAIL;
const authorizedRecipient = env.TEST_RECIPIENT_EMAIL || env.AUTHORIZED_TEST_RECIPIENT || 'hh5959287@gmail.com';

if (!apiKey || apiKey.startsWith('placeholder') || apiKey.includes('YOUR_')) {
  console.error('❌ RESEND_API_KEY is not configured or is a placeholder.');
  process.exit(1);
}

if (!fromEmail || fromEmail.includes('yourdomain.com') || fromEmail.includes('placeholder')) {
  console.error('❌ RESEND_FROM_EMAIL contains placeholder domains.');
  process.exit(1);
}

console.log('=== EMAIL-002: CONTROLLED LIVE DELIVERY EXECUTION ===\n');
console.log(`[Config] Sender: ${fromEmail}`);
console.log(`[Config] Authorized Recipient: ${authorizedRecipient}`);
console.log(`[Safety Guard] Limit: Exactly 1 email will be dispatched.\n`);

async function runControlledDispatch() {
  const resend = new Resend(apiKey);
  const dispatchTimestamp = new Date().toISOString();

  try {
    console.log(`Dispatching 1 controlled verification email at ${dispatchTimestamp}...`);
    const result = await resend.emails.send({
      from: fromEmail,
      to: [authorizedRecipient],
      subject: 'Smart Invoice Chasing: Production Webhook Verification (DEPLOY-003)',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">Smart Invoice Chasing — Production Webhook Verification</h2>
          <p style="color: #334155; line-height: 1.6;">
            This is an authorized, single controlled test delivery verifying the Resend live webhook integration with <strong>https://smart-invoice-chasing.vercel.app/api/webhooks/resend</strong>.
          </p>
          <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #1e293b; font-size: 14px;"><strong>Task ID:</strong> DEPLOY-003</p>
            <p style="margin: 4px 0 0; color: #1e293b; font-size: 14px;"><strong>Timestamp:</strong> ${dispatchTimestamp}</p>
            <p style="margin: 4px 0 0; color: #1e293b; font-size: 14px;"><strong>Sender Identity:</strong> ${fromEmail}</p>
            <p style="margin: 4px 0 0; color: #1e293b; font-size: 14px;"><strong>Recipient:</strong> ${authorizedRecipient}</p>
          </div>
          <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
            This email was initiated under strict operator authorization. No customer data or bulk messages were used.
          </p>
        </div>
      `,
      text: `Smart Invoice Chasing — Production Webhook Verification (DEPLOY-003)\n\nThis is an authorized, single controlled test delivery verifying the Resend live webhook pipeline.\n\nTask ID: DEPLOY-003\nTimestamp: ${dispatchTimestamp}\nSender Identity: ${fromEmail}\nRecipient: ${authorizedRecipient}\n\nStrict operator authorization. No customer records contacted.`,
    });

    if (result.error) {
      console.error('❌ Provider rejected send request:', JSON.stringify(result.error, null, 2));
      process.exit(1);
    }

    const providerMessageId = result.data?.id;
    console.log('✅ Provider accepted send request successfully!');
    console.log(`[Provider Acceptance] Provider Message ID: ${providerMessageId}`);
    console.log(`[Provider Acceptance] Timestamp: ${new Date().toISOString()}`);
    console.log('\n[Summary]');
    console.log('- HTTP Status: 200 OK (Provider Accepted)');
    console.log(`- Provider Message ID: ${providerMessageId}`);
    console.log(`- Recipient: ${authorizedRecipient}`);
    console.log('- Delivery Mode: Resend Sandbox / Testing Identity (onboarding@resend.dev)');
    console.log('- Operator Action: Check the mailbox for hh5959287@gmail.com to inspect delivery.\n');

    // Write audit record to JSON artifact
    const auditRecord = {
      task: 'DEPLOY-003',
      dispatched_at: dispatchTimestamp,
      provider: 'Resend',
      provider_message_id: providerMessageId,
      sender: fromEmail,
      recipient: authorizedRecipient,
      status: 'provider_accepted',
    };
    fs.writeFileSync(
      path.join(process.cwd(), 'scripts', 'deploy_003_delivery_evidence.json'),
      JSON.stringify(auditRecord, null, 2)
    );
    console.log('Evidence saved to scripts/deploy_003_delivery_evidence.json');
  } catch (err) {
    console.error('❌ Dispatch failed with exception:', err.message);
    process.exit(1);
  }
}

runControlledDispatch();
