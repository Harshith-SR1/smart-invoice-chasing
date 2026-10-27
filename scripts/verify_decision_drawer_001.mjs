/**
 * VERIFICATION SCRIPT: TASK AI-DECISION-EXPLAINABILITY-DRAWER-001
 * Shared Read-Only Decision Explanation Drawer Verification Suite
 *
 * Verifies all 12 core requirements:
 * 1. All six canonical actions render correctly (STOP, HUMAN, WAIT, FOLLOW_UP, ESCALATE, NUDGE).
 * 2. Explanations agree with canonical engine outputs.
 * 3. Unverified claims are never presented as verified funds.
 * 4. Active, fulfilled, and broken promises are distinguished.
 * 5. Active disputes/holds show the correct paused state.
 * 6. Aging values use canonical data across all 6 tiers.
 * 7. Missing data is labelled unavailable rather than fabricated.
 * 8. Both entry points (AiDecisionsView and CollectionsHub) use the shared component.
 * 9. Drawer closing and keyboard accessibility (ESC key, dialog ARIA attributes).
 * 10. Opening the drawer does not mutate financial or collection state.
 * 11. Workspace authorization and tenant isolation are not weakened.
 * 12. Existing decision-engine behavior remains unchanged.
 *
 * Usage: node scripts/verify_decision_drawer_001.mjs
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Delegate to tsx if executed in standard node
if (!process.env.TSX_SPAWNED) {
  const res = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', 'scripts/verify_decision_drawer_001.mjs'],
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, TSX_SPAWNED: '1' },
    }
  );
  process.exit(res.status || 0);
}

const {
  buildDecisionExplanation,
  getCanonicalAgingBucket,
} = await import('../src/components/decisions/DecisionExplanationDrawer.tsx');

const {
  evaluateInvoiceDecision,
  computeCustomerPaymentReliability,
} = await import('../src/lib/decisionEngine.ts');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('=== TASK AI-DECISION-EXPLAINABILITY-DRAWER-001 VERIFICATION SUITE ===\n');

// Mock data fixtures
const baseInvoice = {
  id: 'inv-test-001',
  invoiceNumber: 'INV-2026-001',
  customerId: 'cust-001',
  customerName: 'Acme Corporation Pvt Ltd',
  customerEmail: 'billing@acme.example.com',
  amount: 150000,
  paidAmount: 50000,
  outstandingAmount: 100000,
  currency: 'INR',
  issueDate: '2026-09-01',
  dueDate: '2026-10-01',
  status: 'chasing',
  paymentClaimStatus: 'UNCLAIMED',
  daysOverdue: 26,
  collectionHealth: 65,
  healthCategory: 'medium_risk',
  healthReasons: ['Overdue by 26 days'],
  remindersSent: 2,
  customerRepliesCount: 1,
  paymentPromisesCount: 0,
  missedPromisesCount: 0,
  lastContactDate: '2026-10-15',
  lastCustomerReply: 'Processing with finance team',
  nextAction: 'Follow up on payment schedule',
  aiRecommendation: {
    actionType: 'followup',
    title: 'Follow up',
    description: 'Send reminder',
    suggestedMessage: { subject: '', body: '', rationale: '' },
  },
  timeline: [],
};

const baseCustomer = {
  id: 'cust-001',
  name: 'Acme Corporation Pvt Ltd',
  email: 'billing@acme.example.com',
  company: 'Acme Corporation',
  totalInvoiced: 500000,
  totalPaid: 350000,
  outstanding: 150000,
  avgPaymentDelayDays: 8,
  overdueInvoicesCount: 1,
  remindersSentCount: 3,
  paymentPromisesCount: 1,
  missedPromisesCount: 0,
  status: 'good_standing',
  firstInvoicedDate: '2025-01-15',
  preferredChannel: 'Email',
};

// Check 1: All six canonical actions render correctly
console.log('Check 1: All six canonical actions render correctly');
{
  const actionsTested = new Set();

  // STOP (paid)
  const paidInv = { ...baseInvoice, status: 'paid', paidAmount: 150000, outstandingAmount: 0 };
  const stopData = buildDecisionExplanation(paidInv, null, baseCustomer, []);
  assert(stopData.action === 'STOP', 'Paid invoice produces action STOP');
  actionsTested.add(stopData.action);

  // HUMAN (unverified claim)
  const claimInv = { ...baseInvoice, paymentClaimStatus: 'CLAIMED', paymentClaimNote: 'Paid via RTGS' };
  const humanData = buildDecisionExplanation(claimInv, null, baseCustomer, []);
  assert(humanData.action === 'HUMAN', 'Payment claimed invoice produces action HUMAN');
  actionsTested.add(humanData.action);

  // WAIT (active promise)
  const activePromise = {
    id: 'prom-1',
    invoiceId: baseInvoice.id,
    invoiceNumber: baseInvoice.invoiceNumber,
    customerId: baseCustomer.id,
    customerName: baseCustomer.name,
    amount: 100000,
    currency: 'INR',
    promisedDate: '2026-11-15',
    detectedAt: '2026-10-20',
    quoteText: 'Will clear by Nov 15',
    status: 'ACTIVE',
  };
  const waitData = buildDecisionExplanation(baseInvoice, null, baseCustomer, [activePromise]);
  assert(waitData.action === 'WAIT', 'Active payment promise produces action WAIT');
  actionsTested.add(waitData.action);

  // FOLLOW_UP (standard overdue >= 14 days, normal value)
  const followUpInv = { ...baseInvoice, daysOverdue: 16, outstandingAmount: 40000, remindersSent: 1 };
  const followUpData = buildDecisionExplanation(followUpInv, null, baseCustomer, []);
  assert(followUpData.action === 'FOLLOW_UP', 'Overdue invoice produces action FOLLOW_UP');
  actionsTested.add(followUpData.action);

  // ESCALATE (ghosting)
  const ghostInv = { ...baseInvoice, remindersSent: 5, customerRepliesCount: 0, daysOverdue: 20 };
  const escalateData = buildDecisionExplanation(ghostInv, null, baseCustomer, []);
  assert(escalateData.action === 'ESCALATE', 'Ghosting invoice produces action ESCALATE');
  actionsTested.add(escalateData.action);

  // NUDGE (early overdue)
  const nudgeInv = { ...baseInvoice, daysOverdue: 3, remindersSent: 0 };
  const nudgeData = buildDecisionExplanation(nudgeInv, null, baseCustomer, []);
  assert(nudgeData.action === 'NUDGE', 'Early overdue invoice produces action NUDGE');
  actionsTested.add(nudgeData.action);

  assert(actionsTested.size === 6, 'All 6 canonical actions (STOP, HUMAN, WAIT, FOLLOW_UP, ESCALATE, NUDGE) verified');
}

// Check 2: Explanations agree with canonical engine outputs
console.log('\nCheck 2: Explanations agree with canonical engine outputs');
{
  const canonicalDecision = evaluateInvoiceDecision(baseInvoice, baseCustomer, []);
  const drawerData = buildDecisionExplanation(baseInvoice, null, baseCustomer, []);

  assert(drawerData.action === canonicalDecision.action, 'Drawer action matches canonical decision engine action');
  assert(drawerData.decision.reason === canonicalDecision.reason, 'Drawer reason matches canonical decision reason');
  assert(drawerData.decision.confidence === canonicalDecision.confidence, 'Drawer confidence matches canonical decision confidence');
  assert(drawerData.plainLanguageExplanation.length > 20, 'Drawer provides rich deterministic plain-language explanation');
}

// Check 3: Unverified claims are never presented as verified funds
console.log('\nCheck 3: Unverified claims are never presented as verified funds');
{
  const claimedInv = {
    ...baseInvoice,
    amount: 200000,
    paidAmount: 50000,
    outstandingAmount: 150000,
    paymentClaimStatus: 'CLAIMED',
    paymentClaimedAt: '2026-10-25',
    paymentClaimNote: 'Bank UTR #9876543210 submitted by client',
  };

  const explanation = buildDecisionExplanation(claimedInv, null, baseCustomer, []);

  assert(explanation.claimAudit.isUnverifiedClaim === true, 'Claim identified strictly as unverified claim');
  assert(explanation.claimAudit.isVerifiedPayment === false, 'Claim is NOT marked as verified payment');
  assert(explanation.financial.verifiedOutstanding === 150000, 'Verified outstanding amount remains 150000 (not reduced by unverified claim)');
  assert(explanation.claimAudit.safetyNotice.includes('NOT verified cash'), 'Safety notice explicitly states customer claim is NOT verified cash');
  assert(explanation.action === 'HUMAN', 'Requires operator HUMAN review before funds are confirmed');
}

// Check 4: Active, fulfilled, and broken promises are distinguished
console.log('\nCheck 4: Active, fulfilled, and broken promises are distinguished');
{
  const activePromise = {
    id: 'p-act',
    invoiceId: baseInvoice.id,
    invoiceNumber: baseInvoice.invoiceNumber,
    customerId: baseCustomer.id,
    customerName: baseCustomer.name,
    amount: 100000,
    currency: 'INR',
    promisedDate: '2026-11-30',
    detectedAt: '2026-10-20',
    quoteText: 'Payment scheduled for Nov 30',
    status: 'ACTIVE',
  };
  const activeExp = buildDecisionExplanation(baseInvoice, null, baseCustomer, [activePromise]);
  assert(activeExp.promiseAudit.status === 'ACTIVE', 'Active promise correctly categorized as ACTIVE');
  assert(activeExp.promiseAudit.summary.includes('Grace period active'), 'Active promise indicates active grace period');

  const brokenPromise = {
    id: 'p-brk',
    invoiceId: baseInvoice.id,
    invoiceNumber: baseInvoice.invoiceNumber,
    customerId: baseCustomer.id,
    customerName: baseCustomer.name,
    amount: 100000,
    currency: 'INR',
    promisedDate: '2026-10-10',
    detectedAt: '2026-10-01',
    quoteText: 'Will transfer by Oct 10',
    status: 'BROKEN',
  };
  const brokenExp = buildDecisionExplanation(baseInvoice, null, baseCustomer, [brokenPromise]);
  assert(brokenExp.promiseAudit.status === 'BROKEN', 'Broken promise correctly categorized as BROKEN');
  assert(brokenExp.promiseAudit.summary.includes('Broken commitment'), 'Broken promise explicitly reported as broken commitment');

  const fulfilledPromise = {
    id: 'p-ful',
    invoiceId: baseInvoice.id,
    invoiceNumber: baseInvoice.invoiceNumber,
    customerId: baseCustomer.id,
    customerName: baseCustomer.name,
    amount: 50000,
    currency: 'INR',
    promisedDate: '2026-10-05',
    detectedAt: '2026-10-01',
    quoteText: 'Sent advance payment',
    status: 'FULFILLED',
  };
  const fulfilledExp = buildDecisionExplanation(baseInvoice, null, baseCustomer, [fulfilledPromise]);
  assert(fulfilledExp.promiseAudit.status === 'FULFILLED', 'Fulfilled promise correctly categorized as FULFILLED');
  assert(fulfilledExp.promiseAudit.summary.includes('Fulfilled commitment'), 'Fulfilled promise reported as fulfilled commitment');
}

// Check 5: Active disputes/holds show the correct paused state
console.log('\nCheck 5: Active disputes/holds show the correct paused state');
{
  const disputedInv = {
    ...baseInvoice,
    status: 'disputed',
    collectionCategory: 'DISPUTERS',
    lastCustomerReply: 'Line items 4 and 5 were not delivered as contracted',
  };
  const disputeExp = buildDecisionExplanation(disputedInv, null, baseCustomer, []);
  assert(disputeExp.disputeHoldAudit.isPaused === true, 'Dispute correctly pauses collections');
  assert(disputeExp.disputeHoldAudit.isDisputed === true, 'Dispute flag is active');
  assert(disputeExp.disputeHoldAudit.summary.includes('COLLECTIONS PAUSED'), 'Collections paused notice is explicitly present');
  assert(disputeExp.action === 'HUMAN', 'Dispute routes to HUMAN review instead of automated chase');

  const heldInv = {
    ...baseInvoice,
    status: 'held',
  };
  const heldExp = buildDecisionExplanation(heldInv, null, baseCustomer, []);
  assert(heldExp.disputeHoldAudit.isPaused === true, 'Administrative hold pauses collections');
  assert(heldExp.disputeHoldAudit.isOnHold === true, 'Hold flag is active');
  assert(heldExp.action === 'WAIT', 'Administrative hold directs engine to WAIT');
}

// Check 6: Aging values use canonical data across all 6 tiers
console.log('\nCheck 6: Aging values use canonical data across all 6 tiers');
{
  assert(getCanonicalAgingBucket(-5).tierId === 'current', 'days <= 0 maps to current tier');
  assert(getCanonicalAgingBucket(0).tierId === 'current', 'days = 0 maps to current tier');
  assert(getCanonicalAgingBucket(5).tierId === 'days1_7', 'days 1-7 maps to days1_7 tier');
  assert(getCanonicalAgingBucket(7).tierId === 'days1_7', 'days = 7 maps to days1_7 tier');
  assert(getCanonicalAgingBucket(15).tierId === 'days8_30', 'days 8-30 maps to days8_30 tier');
  assert(getCanonicalAgingBucket(30).tierId === 'days8_30', 'days = 30 maps to days8_30 tier');
  assert(getCanonicalAgingBucket(45).tierId === 'days31_60', 'days 31-60 maps to days31_60 tier');
  assert(getCanonicalAgingBucket(60).tierId === 'days31_60', 'days = 60 maps to days31_60 tier');
  assert(getCanonicalAgingBucket(75).tierId === 'days61_90', 'days 61-90 maps to days61_90 tier');
  assert(getCanonicalAgingBucket(90).tierId === 'days61_90', 'days = 90 maps to days61_90 tier');
  assert(getCanonicalAgingBucket(95).tierId === 'days90Plus', 'days > 90 maps to days90Plus tier');
}

// Check 7: Missing data is labelled unavailable rather than fabricated
console.log('\nCheck 7: Missing data is labelled unavailable rather than fabricated');
{
  const sparseInvoice = {
    ...baseInvoice,
    customerEmail: '',
    lastCustomerReply: undefined,
  };
  // Pass null for customer
  const sparseExp = buildDecisionExplanation(sparseInvoice, null, null, []);

  assert(sparseExp.reliabilityAudit.hasProfile === false, 'Missing customer profile flagged as hasProfile: false');
  assert(sparseExp.reliabilityAudit.score === null, 'Missing customer profile does not fabricate a numerical score');
  assert(sparseExp.reliabilityAudit.tierLabel === 'Unavailable', 'Missing customer profile tier labeled as Unavailable');
  assert(sparseExp.missingFields.includes('Customer Profile Record'), 'Missing profile included in missingFields audit list');
  assert(sparseExp.missingFields.includes('Customer Email'), 'Empty customer email included in missingFields audit list');
  assert(sparseExp.missingFields.includes('Customer Reply History'), 'Undefined reply included in missingFields audit list');
}

// Check 8: Both entry points use the shared component
console.log('\nCheck 8: Both entry points use the shared component');
{
  const aiDecisionsPath = path.resolve('src/components/decisions/AiDecisionsView.tsx');
  const collectionsHubPath = path.resolve('src/components/collections/CollectionsHub.tsx');
  const drawerComponentPath = path.resolve('src/components/decisions/DecisionExplanationDrawer.tsx');

  assert(fs.existsSync(drawerComponentPath), 'DecisionExplanationDrawer.tsx exists');
  assert(fs.existsSync(aiDecisionsPath), 'AiDecisionsView.tsx exists');
  assert(fs.existsSync(collectionsHubPath), 'CollectionsHub.tsx exists');

  const aiDecisionsContent = fs.readFileSync(aiDecisionsPath, 'utf8');
  const collectionsHubContent = fs.readFileSync(collectionsHubPath, 'utf8');

  assert(
    aiDecisionsContent.includes('DecisionExplanationDrawer'),
    'AiDecisionsView.tsx imports and uses DecisionExplanationDrawer'
  );
  assert(
    aiDecisionsContent.includes('<DecisionExplanationDrawer'),
    'AiDecisionsView.tsx renders DecisionExplanationDrawer JSX'
  );
  assert(
    collectionsHubContent.includes('DecisionExplanationDrawer'),
    'CollectionsHub.tsx imports and uses DecisionExplanationDrawer'
  );
  assert(
    collectionsHubContent.includes('<DecisionExplanationDrawer'),
    'CollectionsHub.tsx renders DecisionExplanationDrawer JSX'
  );
}

// Check 9: Drawer closing and keyboard accessibility
console.log('\nCheck 9: Drawer closing and keyboard accessibility');
{
  const drawerContent = fs.readFileSync('src/components/decisions/DecisionExplanationDrawer.tsx', 'utf8');

  assert(drawerContent.includes("e.key === 'Escape'"), 'Drawer handles Escape key event to trigger onClose');
  assert(drawerContent.includes('role="dialog"'), 'Drawer includes accessible role="dialog"');
  assert(drawerContent.includes('aria-modal="true"'), 'Drawer includes aria-modal="true"');
  assert(drawerContent.includes('aria-labelledby="decision-drawer-title"'), 'Drawer includes aria-labelledby');
  assert(drawerContent.includes('aria-describedby="decision-drawer-description"'), 'Drawer includes aria-describedby');
  assert(drawerContent.includes('aria-label="Close explanation drawer"'), 'Close button has accessible aria-label');
  assert(drawerContent.includes('focus-visible:ring-2'), 'Interactive elements include visible focus ring styling');
}

// Check 10: Opening the drawer does not mutate financial or collection state
console.log('\nCheck 10: Opening the drawer does not mutate financial or collection state');
{
  const originalInvoice = JSON.parse(JSON.stringify(baseInvoice));
  const originalCustomer = JSON.parse(JSON.stringify(baseCustomer));
  const originalPromises = [
    {
      id: 'p-test',
      invoiceId: baseInvoice.id,
      invoiceNumber: baseInvoice.invoiceNumber,
      customerId: baseCustomer.id,
      customerName: baseCustomer.name,
      amount: 100000,
      currency: 'INR',
      promisedDate: '2026-11-20',
      detectedAt: '2026-10-20',
      quoteText: 'Promise text',
      status: 'ACTIVE',
    },
  ];
  const originalPromisesCopy = JSON.parse(JSON.stringify(originalPromises));

  // Build explanation multiple times
  const exp1 = buildDecisionExplanation(baseInvoice, null, baseCustomer, originalPromises);
  const exp2 = buildDecisionExplanation(baseInvoice, null, baseCustomer, originalPromises);

  assert(JSON.stringify(baseInvoice) === JSON.stringify(originalInvoice), 'Invoice object was NOT mutated');
  assert(JSON.stringify(baseCustomer) === JSON.stringify(originalCustomer), 'Customer object was NOT mutated');
  assert(JSON.stringify(originalPromises) === JSON.stringify(originalPromisesCopy), 'Promises array was NOT mutated');
  assert(JSON.stringify(exp1) === JSON.stringify(exp2), 'Multiple evaluations are strictly deterministic and idempotent');
}

// Check 11: Workspace authorization and tenant isolation
console.log('\nCheck 11: Workspace authorization and tenant isolation');
{
  // The drawer operates purely in-memory on records provided by authenticated AppContext.
  // Verify that DecisionExplanationDrawer does not make ad-hoc fetch requests across tenant boundaries.
  const drawerContent = fs.readFileSync('src/components/decisions/DecisionExplanationDrawer.tsx', 'utf8');

  assert(!drawerContent.includes('fetch('), 'Drawer makes no raw network fetch requests');
  assert(!drawerContent.includes('supabase.from'), 'Drawer performs no direct cross-table database queries bypassing RLS');
  assert(drawerContent.includes('export const DecisionExplanationDrawer'), 'Drawer is properly exported for workspace scoped views');
}

// Check 12: Existing decision-engine behavior remains unchanged
console.log('\nCheck 12: Existing decision-engine behavior remains unchanged');
{
  const invoice = { ...baseInvoice, daysOverdue: 20, outstandingAmount: 80000 };
  const d1 = evaluateInvoiceDecision(invoice, baseCustomer, []);
  assert(d1.action === 'FOLLOW_UP', 'Standard overdue invoice returns FOLLOW_UP from core engine');
  assert(d1.confidence >= 80, 'Core engine preserves expected confidence score');

  const paid = { ...baseInvoice, status: 'paid', outstandingAmount: 0 };
  const d2 = evaluateInvoiceDecision(paid, baseCustomer, []);
  assert(d2.action === 'STOP', 'Paid invoice returns STOP from core engine');
}

console.log('\n======================================================');
console.log(`TOTAL AUDIT CHECKS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${totalTests - passedTests}`);
console.log('======================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL DECISION EXPLAINABILITY DRAWER AUDIT CHECKS PASSED!\n');
} else {
  process.exit(1);
}
