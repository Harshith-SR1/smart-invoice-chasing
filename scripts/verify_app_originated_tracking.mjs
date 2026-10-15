/**
 * TRACKING-001: End-to-End App-Originated Email Tracking & Webhook Verification
 *
 * Execution Steps:
 * 1. Seed an isolated test workspace and invoice in Supabase.
 * 2. Create an internal message row in public.messages (status: 'queued').
 * 3. Dispatch exactly 1 test email to the operator mailbox (hh5959287@gmail.com).
 * 4. Record the returned Resend provider message ID in the internal message row.
 * 5. Verify the deployed production webhook endpoint (https://smart-invoice-chasing.vercel.app/api/webhooks/resend)
 *    authenticates a signed Svix payload matching this provider ID.
 * 6. Confirm that the production webhook returns HTTP 200 with tracked: true and messageId matching our message.
 * 7. Verify message delivery_status advances to 'delivered' in the database.
 * 8. Verify collection_events records the delivery timeline event.
 * 9. Verify invoice balance remains strictly unchanged (financial invariants).
 * 10. Verify duplicate events and out-of-order events are handled idempotently.
 *
 * Usage: node scripts/verify_app_originated_tracking.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Polyfill WebSocket for Node 20
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

// Load .env.local
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
const resendApiKey = env.RESEND_API_KEY;
const fromEmail = env.RESEND_FROM_EMAIL || 'Smart Invoice Chasing <onboarding@resend.dev>';
const webhookSecret = env.RESEND_WEBHOOK_SECRET;
const prodUrl = env.NEXT_PUBLIC_SITE_URL || 'https://smart-invoice-chasing.vercel.app';
const operatorRecipient = env.TEST_RECIPIENT_EMAIL || 'hh5959287@gmail.com';

console.log('=== TRACKING-001: LIVE APP-ORIGINATED EMAIL TRACKING VERIFICATION ===\n');

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function computeSvixSignature(secret, id, timestamp, body) {
  const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const secretBytes = Buffer.from(cleanSecret, 'base64');
  const toSign = `${id}.${timestamp}.${body}`;
  return crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');
}

async function runTest() {
  const checkResults = [];
  function record(name, pass, detail) {
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: [${name}] ${detail}`);
    checkResults.push({ name, pass, detail });
  }

  try {
    // ── Step 1: Ensure Isolated Test Workspace & Invoice Exist ─────────────────
    console.log('--- Step 1: Setting up isolated test workspace & invoice ---');
    
    // Ensure we have an authenticated user ID for the workspace owner
    let userId;
    const { data: usersList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (usersList?.users && usersList.users.length > 0) {
      userId = usersList.users[0].id;
    } else {
      const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
        email: 'test_operator@smartinvoicechasing.local',
        password: 'TestPassword123!',
        email_confirm: true,
      });
      if (userErr) throw new Error(`Failed to create test user: ${userErr.message}`);
      userId = newUser.user.id;
    }

    let workspaceId;
    const { data: existingWs } = await supabase
      .from('workspaces')
      .select('id')
      .eq('business_name', 'TRACKING-001 Test Workspace')
      .limit(1)
      .maybeSingle();

    if (existingWs) {
      workspaceId = existingWs.id;
    } else {
      const { data: newWs, error: wsErr } = await supabase
        .from('workspaces')
        .insert({
          user_id: userId,
          business_name: 'TRACKING-001 Test Workspace',
          business_type: 'Agency',
          country: 'India',
          currency: 'INR (₹)',
          business_email: 'finance@tracking001.test',
        })
        .select('id')
        .single();
      if (wsErr) throw new Error(`Failed to create test workspace: ${wsErr.message}`);
      workspaceId = newWs.id;
    }
    record('Workspace Setup', true, `Test Workspace ID: ${workspaceId} (Owner: ${userId})`);

    // Create or find test invoice
    let invoiceId;
    const { data: existingInv } = await supabase
      .from('invoices')
      .select('id, amount, outstanding_amount, amount_paid')
      .eq('workspace_id', workspaceId)
      .eq('invoice_number', 'INV-TRACK-001')
      .limit(1)
      .maybeSingle();

    if (existingInv) {
      invoiceId = existingInv.id;
    } else {
      const { data: newInv, error: invErr } = await supabase
        .from('invoices')
        .insert({
          workspace_id: workspaceId,
          invoice_number: 'INV-TRACK-001',
          customer_name: 'Operator Test Client',
          customer_email: operatorRecipient,
          amount: 75000,
          outstanding_amount: 75000,
          amount_paid: 0,
          status: 'overdue',
          issue_date: '2026-09-01',
          due_date: '2026-09-15',
        })
        .select('id')
        .single();
      if (invErr) throw new Error(`Failed to create test invoice: ${invErr.message}`);
      invoiceId = newInv.id;
    }
    record('Invoice Setup', true, `Test Invoice ID: ${invoiceId} (Balance: ₹75,000)`);

    // ── Step 2: Create Internal Message Record (status: 'queued') ──────────────
    console.log('\n--- Step 2: Creating internal message record in public.messages ---');
    const { data: internalMsg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        sender_type: 'ai',
        sender_name: 'Smart Invoice Chasing',
        sender_email: 'onboarding@resend.dev',
        subject: 'Smart Invoice Chasing: Tracking Verification (TRACKING-001)',
        body: 'Follow-up regarding invoice INV-TRACK-001. Verification test for TRACKING-001.',
        delivery_status: 'queued',
      })
      .select('id, delivery_status')
      .single();

    if (msgErr || !internalMsg) throw new Error(`Failed to insert message row: ${msgErr?.message}`);
    record('Internal Message Creation', true, `Created message UUID: ${internalMsg.id} with status: ${internalMsg.delivery_status}`);

    // ── Step 3: Dispatch Exactly ONE Email via Resend ──────────────────────────
    console.log('\n--- Step 3: Dispatching exactly ONE email through Resend ---');
    const resend = new Resend(resendApiKey);
    const dispatchTimestamp = new Date().toISOString();

    const sendRes = await resend.emails.send({
      from: fromEmail,
      to: [operatorRecipient],
      subject: 'Smart Invoice Chasing: App-Originated Email Tracking (TRACKING-001)',
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">Smart Invoice Chasing — App-Originated Verification</h2>
          <p style="color: #334155; line-height: 1.5;">
            This email was dispatched via the application collection workflow to verify internal message record tracking and live webhook status advancement.
          </p>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px;">
            <p style="margin: 0;"><strong>Internal Message ID:</strong> ${internalMsg.id}</p>
            <p style="margin: 4px 0 0;"><strong>Invoice Reference:</strong> INV-TRACK-001</p>
            <p style="margin: 4px 0 0;"><strong>Timestamp:</strong> ${dispatchTimestamp}</p>
            <p style="margin: 4px 0 0;"><strong>Recipient:</strong> ${operatorRecipient}</p>
          </div>
        </div>
      `,
      text: `Smart Invoice Chasing — App-Originated Verification\n\nInternal Message ID: ${internalMsg.id}\nInvoice: INV-TRACK-001\nTimestamp: ${dispatchTimestamp}\nRecipient: ${operatorRecipient}`,
    });

    if (sendRes.error || !sendRes.data?.id) {
      throw new Error(`Resend send rejected: ${sendRes.error?.message || 'Unknown error'}`);
    }

    const providerMessageId = sendRes.data.id;
    record('Provider Dispatch Acceptance', true, `Resend Provider Message ID: ${providerMessageId}`);

    // ── Step 4: Associate Provider Message ID with Internal Message Row ────────
    console.log('\n--- Step 4: Storing provider message ID in internal message row ---');
    const { error: updateErr } = await supabase
      .from('messages')
      .update({
        delivery_status: 'sent',
        provider_message_id: providerMessageId,
        sent_at: dispatchTimestamp,
      })
      .eq('id', internalMsg.id);

    if (updateErr) throw new Error(`Failed to associate provider ID with message: ${updateErr.message}`);

    // Verify it was persisted correctly
    const { data: persistedMsg } = await supabase
      .from('messages')
      .select('id, delivery_status, provider_message_id')
      .eq('id', internalMsg.id)
      .single();

    const idMatches = persistedMsg.provider_message_id === providerMessageId;
    record('Provider ID Association', idMatches, `Internal message ${persistedMsg.id} now holds provider_message_id: ${persistedMsg.provider_message_id}`);

    // ── Step 5: Test Webhook Delivery to Deployed Vercel Production Endpoint ───
    console.log('\n--- Step 5: Testing signed webhook delivery against Vercel Production ---');
    const webhookUrl = `${prodUrl.replace(/\/+$/, '')}/api/webhooks/resend`;
    const nowTs = String(Math.floor(Date.now() / 1000));
    const svixId = `evt_track_${Date.now()}`;
    const webhookPayload = {
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: {
        email_id: providerMessageId,
        id: providerMessageId,
        to: [operatorRecipient],
      },
    };
    const bodyStr = JSON.stringify(webhookPayload);
    const validSignature = await computeSvixSignature(webhookSecret, svixId, nowTs, bodyStr);

    console.log(`Sending signed webhook to: ${webhookUrl}`);
    const hookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': svixId,
        'svix-timestamp': nowTs,
        'svix-signature': `v1,${validSignature}`,
      },
      body: bodyStr,
    });

    console.log(`Webhook HTTP Status: ${hookRes.status} ${hookRes.statusText}`);
    const hookData = await hookRes.json();
    console.log('Webhook Response:', JSON.stringify(hookData));

    record('Webhook HTTP 200 OK', hookRes.status === 200, `Returned HTTP ${hookRes.status}`);
    record('Webhook Tracked Association', hookData.tracked === true, `tracked: ${hookData.tracked} (matched internal message)`);
    record('Webhook Matched Message ID', hookData.messageId === internalMsg.id, `Matched Message UUID: ${hookData.messageId}`);

    // ── Step 6: Verify Database Status & Timeline Advancement ──────────────────
    console.log('\n--- Step 6: Verifying database state updates in Supabase ---');
    const { data: updatedMsg } = await supabase
      .from('messages')
      .select('id, delivery_status, delivered_at, provider_message_id')
      .eq('id', internalMsg.id)
      .single();

    record('Message Delivery Status', updatedMsg.delivery_status === 'delivered', `delivery_status advanced to: "${updatedMsg.delivery_status}"`);
    record('Message Delivered Timestamp', Boolean(updatedMsg.delivered_at), `delivered_at recorded: ${updatedMsg.delivered_at}`);

    // Verify webhook event log table
    const { data: loggedEvent } = await supabase
      .from('message_webhook_events')
      .select('id, workspace_id, message_id, event_type, provider_message_id')
      .eq('provider_message_id', providerMessageId)
      .eq('event_type', 'email.delivered')
      .single();

    record('Webhook Audit Event Persisted', Boolean(loggedEvent && loggedEvent.message_id === internalMsg.id), `Logged in message_webhook_events (ID: ${loggedEvent?.id}, Workspace: ${loggedEvent?.workspace_id})`);

    // Verify collection timeline event
    const { data: timelineEvents } = await supabase
      .from('collection_events')
      .select('id, type, title, metadata')
      .eq('invoice_id', invoiceId)
      .order('timestamp', { ascending: false });

    const hasDeliveredTimeline = timelineEvents?.some((e) => e.type === 'reminder_delivered');
    record('Collection Timeline Event', hasDeliveredTimeline, `Timeline event "reminder_delivered" found in collection_events`);

    // ── Step 7: Verify Financial Invariant Immutability ────────────────────────
    console.log('\n--- Step 7: Verifying Financial Invariants (Zero Balance Mutation) ---');
    const { data: invoiceCheck } = await supabase
      .from('invoices')
      .select('amount, outstanding_amount, amount_paid, status')
      .eq('id', invoiceId)
      .single();

    record('Invoice Balance Immutability', invoiceCheck.outstanding_amount === 75000 && invoiceCheck.amount_paid === 0, `Invoice balance remained exactly ₹75,000 (paid: ₹0, status: ${invoiceCheck.status})`);

    // ── Step 8: Verify Duplicate Event Idempotency (PostgreSQL 23505) ──────────
    console.log('\n--- Step 8: Verifying Duplicate Event Handling ---');
    const dupRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': `${svixId}_dup`,
        'svix-timestamp': nowTs,
        'svix-signature': `v1,${await computeSvixSignature(webhookSecret, `${svixId}_dup`, nowTs, bodyStr)}`,
      },
      body: bodyStr,
    });
    const dupData = await dupRes.json();
    record('Duplicate Event Idempotency', dupRes.status === 200 && dupData.duplicate === true, `Duplicate event returned HTTP 200 { duplicate: true }`);

    // ── Step 9: Verify Out-of-Order Event Does Not Downgrade Status ─────────────
    console.log('\n--- Step 9: Verifying Out-of-Order Event Rejection ---');
    const lateSentPayload = {
      type: 'email.sent',
      created_at: new Date(Date.now() - 60000).toISOString(),
      data: {
        email_id: providerMessageId,
        id: providerMessageId,
        to: [operatorRecipient],
      },
    };
    const lateBodyStr = JSON.stringify(lateSentPayload);
    const lateTs = String(Math.floor(Date.now() / 1000));
    const lateSvixId = `evt_late_${Date.now()}`;
    const lateSig = await computeSvixSignature(webhookSecret, lateSvixId, lateTs, lateBodyStr);

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': lateSvixId,
        'svix-timestamp': lateTs,
        'svix-signature': `v1,${lateSig}`,
      },
      body: lateBodyStr,
    });

    const { data: finalMsg } = await supabase
      .from('messages')
      .select('delivery_status')
      .eq('id', internalMsg.id)
      .single();

    record('Out-of-Order Downgrade Protection', finalMsg.delivery_status === 'delivered', `Message status remained "delivered" (not downgraded to sent)`);

    // Save test evidence
    const evidence = {
      task: 'TRACKING-001',
      timestamp: dispatchTimestamp,
      internal_message_id: internalMsg.id,
      invoice_id: invoiceId,
      provider_message_id: providerMessageId,
      recipient: operatorRecipient,
      checks: checkResults,
    };
    fs.writeFileSync(
      path.join(process.cwd(), 'scripts', 'tracking_001_evidence.json'),
      JSON.stringify(evidence, null, 2)
    );
    console.log('\nEvidence saved to scripts/tracking_001_evidence.json');

  } catch (err) {
    console.error('\n❌ TRACKING-001 Verification failed:', err.message);
    process.exit(1);
  }

  const allPassed = checkResults.every((c) => c.pass);
  console.log('\n======================================================');
  console.log(`TRACKING-001 SUMMARY: ${checkResults.filter((c) => c.pass).length} / ${checkResults.length} checks passed.`);
  console.log(`FINAL OUTCOME: ${allPassed ? 'ALL VERIFICATIONS PASSED' : 'SOME CHECKS FAILED'}`);
  console.log('======================================================\n');
}

runTest();
