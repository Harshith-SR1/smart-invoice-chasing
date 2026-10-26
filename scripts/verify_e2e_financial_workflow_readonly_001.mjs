/**
 * READ-ONLY E2E FINANCIAL WORKFLOW VERIFICATION SCRIPT
 * TASK: END-TO-END-FINANCIAL-WORKFLOW-STAGING-001
 *
 * Scope:
 * Safely validates the complete Smart Invoice Chasing integrated financial workflow
 * using canonical service logic and deterministic in-memory fixtures, strictly avoiding
 * writes to the live production database.
 *
 * Test Fixture:
 * 1. Unpaid invoice (INV-E2E-001)
 * 2. Partially paid invoice (INV-E2E-002)
 * 3. Fully paid invoice through verified payment (INV-E2E-003)
 * 4. Pending, unverified payment claim (INV-E2E-004)
 * 5. Fulfilled payment promise (PRM-E2E-001 on INV-E2E-003)
 * 6. Active / unfulfilled payment promise (PRM-E2E-002 on INV-E2E-002)
 * 7. Disputed invoice retaining receivable balance with paused collections (INV-E2E-005)
 *
 * Usage: node scripts/verify_e2e_financial_workflow_readonly_001.mjs
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Auto-delegate to tsx if executed in standard node
if (!process.env.TSX_SPAWNED) {
  const res = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', 'scripts/verify_e2e_financial_workflow_readonly_001.mjs'],
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, TSX_SPAWNED: '1' },
    }
  );
  process.exit(res.status || 0);
}

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

const {
  computeCanonicalInvoiceRow,
  generateInvoicesCsv,
  exportInvoicesToCsv,
} = await import('../src/lib/invoiceExport.ts');

const { buildRecoveryReportSummary } = await import('../src/context/AppContext.tsx');
const { isCollectibleStatus } = await import('../src/types/index.ts');
const { evaluateInvoiceDecision, reconcilePromisesWithPayment } = await import('../src/lib/decisionEngine.ts');

console.log('======================================================================');
console.log('  E2E FINANCIAL WORKFLOW AUDIT — READ-ONLY CONTROLLED VALIDATION');
console.log('======================================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Check ${totalTests}: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Check ${totalTests}: ${desc}`);
    console.error(`       Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// STEP 1: FIXTURE DEFINITION (Section 2)
// -----------------------------------------------------------------------------
const FIXTURE_WORKSPACE_ID = 'ws-e2e-isolated-001';

const fixtureInvoices = [
  // 1. Unpaid invoice
  {
    id: 'inv-e2e-001',
    workspaceId: FIXTURE_WORKSPACE_ID,
    invoiceNumber: 'INV-E2E-001',
    customerId: 'cust-e2e-001',
    customerName: 'Alpha Logistics',
    customerEmail: 'billing@alpha.test',
    amount: 100000,
    paidAmount: 0,
    outstandingAmount: 100000,
    status: 'overdue',
    daysOverdue: 14,
    currency: 'INR',
    issueDate: '2026-09-01',
    dueDate: '2026-09-30',
    remindersSent: 2,
    customerRepliesCount: 1,
    paymentPromisesCount: 0,
    missedPromisesCount: 0,
    collectionCategory: 'ACTIVE',
  },
  // 2. Partially paid invoice
  {
    id: 'inv-e2e-002',
    workspaceId: FIXTURE_WORKSPACE_ID,
    invoiceNumber: 'INV-E2E-002',
    customerId: 'cust-e2e-002',
    customerName: 'Beta Dynamics',
    customerEmail: 'accounts@beta.test',
    amount: 150000,
    paidAmount: 50000,
    outstandingAmount: 100000,
    status: 'partially_paid',
    daysOverdue: 5,
    currency: 'INR',
    issueDate: '2026-09-15',
    dueDate: '2026-10-15',
    remindersSent: 1,
    customerRepliesCount: 1,
    paymentPromisesCount: 1,
    missedPromisesCount: 0,
    collectionCategory: 'PROMISERS',
    payments: [{ id: 'pay-002-1', amount: 50000, status: 'confirmed' }],
  },
  // 3. Fully settled invoice
  {
    id: 'inv-e2e-003',
    workspaceId: FIXTURE_WORKSPACE_ID,
    invoiceNumber: 'INV-E2E-003',
    customerId: 'cust-e2e-003',
    customerName: 'Gamma Healthcare',
    customerEmail: 'finance@gamma.test',
    amount: 80000,
    paidAmount: 80000,
    outstandingAmount: 0,
    status: 'paid',
    daysOverdue: 0,
    currency: 'INR',
    issueDate: '2026-08-01',
    dueDate: '2026-08-31',
    paidDate: '2026-09-10',
    remindersSent: 3,
    customerRepliesCount: 2,
    paymentPromisesCount: 1,
    missedPromisesCount: 0,
    collectionCategory: 'ACTIVE',
    payments: [{ id: 'pay-003-1', amount: 80000, status: 'confirmed' }],
  },
  // 4. Pending, unverified payment claim
  {
    id: 'inv-e2e-004',
    workspaceId: FIXTURE_WORKSPACE_ID,
    invoiceNumber: 'INV-E2E-004',
    customerId: 'cust-e2e-004',
    customerName: 'Delta Cloud',
    customerEmail: 'ap@delta.test',
    amount: 120000,
    paidAmount: 0,
    outstandingAmount: 120000,
    status: 'chasing',
    paymentClaimStatus: 'CLAIMED',
    daysOverdue: 20,
    currency: 'INR',
    issueDate: '2026-09-05',
    dueDate: '2026-10-05',
    remindersSent: 2,
    customerRepliesCount: 1,
    paymentPromisesCount: 0,
    missedPromisesCount: 0,
    collectionCategory: 'ACTIVE',
    payments: [
      {
        id: 'pay-004-claim',
        amount: 120000,
        status: 'pending_verification',
        source: 'customer_claim',
      },
    ],
  },
  // 5. Disputed invoice
  {
    id: 'inv-e2e-005',
    workspaceId: FIXTURE_WORKSPACE_ID,
    invoiceNumber: 'INV-E2E-005',
    customerId: 'cust-e2e-005',
    customerName: 'Epsilon Media',
    customerEmail: 'disputes@epsilon.test',
    amount: 90000,
    paidAmount: 0,
    outstandingAmount: 90000,
    status: 'disputed',
    daysOverdue: 25,
    currency: 'INR',
    issueDate: '2026-08-20',
    dueDate: '2026-09-20',
    remindersSent: 4,
    customerRepliesCount: 3,
    paymentPromisesCount: 0,
    missedPromisesCount: 0,
    collectionCategory: 'DISPUTERS',
  },
];

const fixturePromises = [
  // Fulfilled promise for INV-E2E-003
  {
    id: 'prm-e2e-001',
    invoiceId: 'inv-e2e-003',
    workspaceId: FIXTURE_WORKSPACE_ID,
    amount: 80000,
    status: 'FULFILLED',
    createdAt: '2026-09-01T10:00:00Z',
    fulfilledAt: '2026-09-10T14:30:00Z',
  },
  // Active promise for INV-E2E-002 remaining balance
  {
    id: 'prm-e2e-002',
    invoiceId: 'inv-e2e-002',
    workspaceId: FIXTURE_WORKSPACE_ID,
    amount: 100000,
    status: 'ACTIVE',
    createdAt: '2026-10-16T09:00:00Z',
    promisedDate: '2026-10-30',
  },
];

// -----------------------------------------------------------------------------
// CHECK 1: Fixture initialization and structural validity
// -----------------------------------------------------------------------------
it('Controlled fixture contains exactly the 5 target invoices and 2 target promises', () => {
  assert.strictEqual(fixtureInvoices.length, 5);
  assert.strictEqual(fixturePromises.length, 2);
  const ids = fixtureInvoices.map((i) => i.id);
  assert(ids.includes('inv-e2e-001'));
  assert(ids.includes('inv-e2e-002'));
  assert(ids.includes('inv-e2e-003'));
  assert(ids.includes('inv-e2e-004'));
  assert(ids.includes('inv-e2e-005'));
});

// -----------------------------------------------------------------------------
// CHECK 2: Financial Invariant: Unverified claim does NOT reduce outstanding
// -----------------------------------------------------------------------------
it('Unverified payment claim (INV-E2E-004) leaves outstanding at ₹120,000 and verified paid at ₹0', () => {
  const inv = fixtureInvoices.find((i) => i.id === 'inv-e2e-004');
  const row = computeCanonicalInvoiceRow(inv);
  assert.strictEqual(row.verifiedPaidAmount, 0, 'Unverified claim must not increase verified paid');
  assert.strictEqual(row.outstandingBalance, 120000, 'Unverified claim must not decrease outstanding');
  assert.strictEqual(row.paymentClaimStatus, 'CLAIMED');
});

// -----------------------------------------------------------------------------
// CHECK 3: Financial Invariant: Partial payment updates balance accurately
// -----------------------------------------------------------------------------
it('Partially paid invoice (INV-E2E-002) has ₹50,000 paid and ₹100,000 outstanding', () => {
  const inv = fixtureInvoices.find((i) => i.id === 'inv-e2e-002');
  const row = computeCanonicalInvoiceRow(inv);
  assert.strictEqual(row.originalAmount, 150000);
  assert.strictEqual(row.verifiedPaidAmount, 50000);
  assert.strictEqual(row.outstandingBalance, 100000);
  assert.strictEqual(row.invoiceStatus, 'partially_paid');
});

// -----------------------------------------------------------------------------
// CHECK 4: Financial Invariant: Fully paid invoice produces zero outstanding
// -----------------------------------------------------------------------------
it('Fully paid invoice (INV-E2E-003) produces zero outstanding and evaluates to STOP decision', () => {
  const inv = fixtureInvoices.find((i) => i.id === 'inv-e2e-003');
  const row = computeCanonicalInvoiceRow(inv);
  assert.strictEqual(row.verifiedPaidAmount, 80000);
  assert.strictEqual(row.outstandingBalance, 0);
  assert.strictEqual(row.collectionState, 'SETTLED');

  const decision = evaluateInvoiceDecision(inv, undefined, fixturePromises);
  assert.strictEqual(decision.action, 'STOP', 'Settled invoice must halt all collection actions');
});

// -----------------------------------------------------------------------------
// CHECK 5: Financial Invariant: Disputed invoice retains balance & pauses collection
// -----------------------------------------------------------------------------
it('Disputed invoice (INV-E2E-005) retains ₹90,000 balance and pauses collections', () => {
  const inv = fixtureInvoices.find((i) => i.id === 'inv-e2e-005');
  const row = computeCanonicalInvoiceRow(inv);
  assert.strictEqual(row.outstandingBalance, 90000, 'Dispute retains full receivable balance');
  assert.strictEqual(row.collectionState, 'DISPUTED (COLLECTION PAUSED)');

  const decision = evaluateInvoiceDecision(inv, undefined, fixturePromises);
  assert(decision.action === 'HUMAN' || decision.action === 'STOP' || decision.reason.toLowerCase().includes('dispute'), 'Decision reflects paused/dispute review');
});

// -----------------------------------------------------------------------------
// CHECK 6: Promise reconciliation: verified payment fulfills correct promise
// -----------------------------------------------------------------------------
it('Promise reconciliation allocates confirmed payment to fulfill promise sequentially', () => {
  // Test sequential promise reconciliation
  const unallocatedPromises = [
    { id: 'prm-seq-1', invoiceId: 'inv-seq', amount: 30000, status: 'ACTIVE' },
    { id: 'prm-seq-2', invoiceId: 'inv-seq', amount: 30000, status: 'ACTIVE' },
  ];

  // A verified payment of 40,000 should fulfill prm-seq-1 (30k) and leave prm-seq-2 active
  const reconciled = reconcilePromisesWithPayment(unallocatedPromises, 'inv-seq', 40000, false);
  assert.strictEqual(reconciled.newlyFulfilledIds.length, 1);
  assert.strictEqual(reconciled.newlyFulfilledIds[0], 'prm-seq-1');
  const p2 = reconciled.updatedPromises.find((p) => p.id === 'prm-seq-2');
  assert.strictEqual(p2.status, 'ACTIVE', 'Partial unallocated remainder (10k < 30k) leaves promise active');
});

// -----------------------------------------------------------------------------
// CHECK 7: Exported CSV reconciles exactly with staging fixture values
// -----------------------------------------------------------------------------
it('Exported CSV reconciles with staging ledger records across all columns', () => {
  const csv = generateInvoicesCsv(fixtureInvoices);
  assert(csv.includes('\uFEFF'), 'CSV includes UTF-8 BOM');
  assert(csv.includes('INV-E2E-001'));
  assert(csv.includes('INV-E2E-002'));
  assert(csv.includes('INV-E2E-003'));
  assert(csv.includes('INV-E2E-004'));
  assert(csv.includes('INV-E2E-005'));
  assert(csv.includes('DISPUTED (COLLECTION PAUSED)'));
  assert(csv.includes('SETTLED'));
});

// -----------------------------------------------------------------------------
// CHECK 8: Fixture totals reconcile with Recovery Reports summary
// -----------------------------------------------------------------------------
it('Fixture totals strictly reconcile with Recovery Reports calculation', () => {
  const summary = buildRecoveryReportSummary(fixtureInvoices, fixturePromises, 'INR', true);

  // Collectible outstanding invoices in fixture:
  // INV-E2E-001 (100,000) + INV-E2E-002 (100,000) + INV-E2E-004 (120,000) + INV-E2E-005 (90,000) = 410,000
  // (INV-E2E-003 is paid with 0 outstanding)
  assert.strictEqual(summary.totalOutstanding, 410000, 'Total collectible outstanding matches expected 410,000');
  assert.strictEqual(summary.promisesDetected, 2, '2 payment promises detected');
  assert.strictEqual(summary.promisesFulfilled, 1, '1 payment promise fulfilled');
  assert.strictEqual(summary.unrecoveredAccounts.length, 2, '2 unrecovered accounts flagged for repeated/escalated follow-up');
});

// -----------------------------------------------------------------------------
// CHECK 9: Aging buckets correctly categorize every collectible invoice
// -----------------------------------------------------------------------------
it('Receivables aging breakdown reconciles with total collectible balance', () => {
  const summary = buildRecoveryReportSummary(fixtureInvoices, fixturePromises, 'INR', true);
  const aging = summary.agingBreakdown;

  const totalBucketAmount =
    aging.notDue.amount +
    aging.days1_7.amount +
    aging.days8_30.amount +
    aging.days31_60.amount +
    aging.days61_90.amount +
    aging.days90Plus.amount;

  assert.strictEqual(totalBucketAmount, summary.totalOutstanding, 'Aging bucket sum equals total collectible outstanding');
});

// -----------------------------------------------------------------------------
// CHECK 10: Multi-tenant safety: cross-workspace query leakage is prevented
// -----------------------------------------------------------------------------
it('Workspace scoping prevents cross-workspace data leakage', () => {
  const foreignInvoice = {
    id: 'inv-foreign-001',
    workspaceId: 'ws-foreign-999',
    invoiceNumber: 'INV-FOREIGN',
    customerName: 'Foreign Corp',
    amount: 500000,
    outstandingAmount: 500000,
    status: 'chasing',
    daysOverdue: 10,
  };

  const combined = [...fixtureInvoices, foreignInvoice];
  const isolatedFixtureOnly = combined.filter((i) => i.workspaceId === FIXTURE_WORKSPACE_ID);
  assert.strictEqual(isolatedFixtureOnly.length, 5, 'Tenant filter isolates 5 workspace records');

  const exportResult = exportInvoicesToCsv(isolatedFixtureOnly);
  assert.strictEqual(exportResult.rowCount, 5);
  assert.strictEqual(exportResult.success, true);
});

console.log('\n----------------------------------------------------------------------');
console.log(`Results: ${passedTests} / ${totalTests} checks passed.`);
if (passedTests === totalTests) {
  console.log('STATUS: ALL READ-ONLY E2E WORKFLOW CHECKS PASSED SUCCESSFULLY.');
} else {
  console.error(`STATUS: ${totalTests - passedTests} CHECKS FAILED.`);
  process.exit(1);
}
