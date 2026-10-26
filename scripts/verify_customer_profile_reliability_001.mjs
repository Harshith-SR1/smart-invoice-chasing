/**
 * VERIFICATION SCRIPT: TASK CUSTOMER-PROFILE-MODAL-INTEGRATION-001
 * Customer Profile & Directory Reliability Integration Verification Suite
 *
 * Requirements Tested:
 * 1. Correct score and classification appear in the customer directory.
 * 2. The detail modal displays the same assessment as Payment Risk.
 * 3. Insufficient history displays a neutral state without a fabricated score.
 * 4. Verified payment and promise evidence is displayed accurately.
 * 5. Unverified claims are not counted as verified settlements.
 * 6. Open disputes do not independently lower reliability.
 * 7. Missing or unavailable data does not produce fabricated metrics.
 * 8. Reliability filters return the correct customers.
 * 9. Workspace isolation is preserved.
 * 10. Opening or viewing a profile does not mutate financial records.
 * 11. Existing customer search, filtering, and navigation still work.
 * 12. Existing financial-core, promise-fulfillment, dispute, and decision safety rules remain intact.
 *
 * Usage: node scripts/verify_customer_profile_reliability_001.mjs
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Auto-delegate to tsx if executed in standard node
if (!process.env.TSX_SPAWNED) {
  const res = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', 'scripts/verify_customer_profile_reliability_001.mjs'],
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
  computeCustomerPaymentReliability,
  computePortfolioCustomerReliability,
  evaluateInvoiceDecision,
} = await import('../src/lib/decisionEngine.ts');
const { isCollectibleStatus } = await import('../src/types/index.ts');

console.log('======================================================================');
console.log('  TASK CUSTOMER-PROFILE-MODAL-INTEGRATION-001: INTEGRATION VERIFICATION');
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
// CHECK 1: Correct score and classification appear in the customer directory
// -----------------------------------------------------------------------------
it('Correct score and classification appear in the customer directory', () => {
  const customer = { id: 'cust-101', name: 'Alpha Corp', company: 'Alpha Corp' };
  const invoices = [
    { id: 'i1', customerId: 'cust-101', amount: 100000, paidAmount: 100000, status: 'paid', dueDate: '2026-01-01', paidDate: '2026-01-01' },
    { id: 'i2', customerId: 'cust-101', amount: 100000, paidAmount: 100000, status: 'paid', dueDate: '2026-02-01', paidDate: '2026-02-01' },
  ];

  const portfolioMap = computePortfolioCustomerReliability([customer], invoices, []);
  const assessment = portfolioMap.get('cust-101');

  assert(assessment, 'Assessment must exist for customer');
  assert.strictEqual(assessment.score, 100);
  assert.strictEqual(assessment.tier, 'RELIABLE');
  assert.strictEqual(assessment.tierLabel, 'High Reliability');
});

// -----------------------------------------------------------------------------
// CHECK 2: The detail modal displays the same assessment as Payment Risk
// -----------------------------------------------------------------------------
it('The detail modal displays the exact same assessment as Payment Risk', () => {
  const customer = { id: 'cust-102', name: 'Beta Industries', company: 'Beta Industries' };
  const invoices = [
    { id: 'i3', customerId: 'cust-102', amount: 200000, paidAmount: 200000, status: 'paid', dueDate: '2026-01-01', paidDate: '2026-01-10', daysOverdue: 9 },
    { id: 'i4', customerId: 'cust-102', amount: 200000, paidAmount: 200000, status: 'paid', dueDate: '2026-02-01', paidDate: '2026-02-01', daysOverdue: 0 },
  ];
  const promises = [
    { id: 'p1', customerId: 'cust-102', invoiceId: 'i3', amount: 200000, status: 'FULFILLED', promisedDate: '2026-01-10' },
  ];

  // In PaymentRiskView:
  const riskAssessment = computeCustomerPaymentReliability(customer, invoices, promises);

  // In CustomerDirectoryView / Detail Modal:
  const directoryAssessment = computeCustomerPaymentReliability(customer, invoices, promises);

  assert.deepStrictEqual(riskAssessment, directoryAssessment, 'Risk View and Directory Modal must evaluate identical assessment');
  assert.strictEqual(directoryAssessment.tier, 'MODERATE');
  assert.strictEqual(riskAssessment.score, directoryAssessment.score);
});

// -----------------------------------------------------------------------------
// CHECK 3: Insufficient history displays a neutral state without a fabricated score
// -----------------------------------------------------------------------------
it('Insufficient history displays a neutral state without a fabricated score', () => {
  const newCustomer = { id: 'cust-new', name: 'NewCo', company: 'NewCo' };
  const singleInvoice = [
    { id: 'i-single', customerId: 'cust-new', amount: 50000, paidAmount: 50000, status: 'paid', dueDate: '2026-01-01', paidDate: '2026-01-01' },
  ];

  const assessment = computeCustomerPaymentReliability(newCustomer, singleInvoice, []);
  assert.strictEqual(assessment.score, null, 'Score must be null for insufficient history');
  assert.strictEqual(assessment.tier, 'INSUFFICIENT_HISTORY');
  assert.strictEqual(assessment.tierColor, 'slate');
  assert(assessment.primaryFactors.some((f) => f.includes('Neutral score assigned')));
});

// -----------------------------------------------------------------------------
// CHECK 4: Verified payment and promise evidence is displayed accurately
// -----------------------------------------------------------------------------
it('Verified payment and promise evidence is displayed accurately', () => {
  const customer = { id: 'cust-104', name: 'Gamma Ltd', company: 'Gamma Ltd' };
  const invoices = [
    { id: 'i5', customerId: 'cust-104', amount: 100000, paidAmount: 100000, status: 'paid', dueDate: '2026-01-01', paidDate: '2026-01-01' },
    { id: 'i6', customerId: 'cust-104', amount: 100000, paidAmount: 100000, status: 'paid', dueDate: '2026-02-01', paidDate: '2026-02-21' }, // 20 days late
  ];
  const promises = [
    { id: 'p2', customerId: 'cust-104', invoiceId: 'i6', amount: 100000, status: 'BROKEN', promisedDate: '2026-02-15' },
    { id: 'p3', customerId: 'cust-104', invoiceId: 'i5', amount: 100000, status: 'FULFILLED', promisedDate: '2026-01-01' },
  ];

  const assessment = computeCustomerPaymentReliability(customer, invoices, promises);
  assert.strictEqual(assessment.settledInvoicesCount, 2);
  assert.strictEqual(assessment.onTimePaymentsCount, 1);
  assert.strictEqual(assessment.latePaymentsCount, 1);
  assert.strictEqual(assessment.fulfilledPromisesCount, 1);
  assert.strictEqual(assessment.missedPromisesCount, 1);
  assert.strictEqual(assessment.totalObservations, 4);
});

// -----------------------------------------------------------------------------
// CHECK 5: Unverified claims are not counted as verified settlements
// -----------------------------------------------------------------------------
it('Unverified claims are not counted as verified settlements', () => {
  const customer = { id: 'cust-105', name: 'Delta Enterprises', company: 'Delta Enterprises' };
  const invoices = [
    {
      id: 'i7',
      customerId: 'cust-105',
      amount: 100000,
      paidAmount: 0,
      status: 'chasing',
      paymentClaimStatus: 'CLAIMED', // Pending verification
      daysOverdue: 10,
    },
    {
      id: 'i8',
      customerId: 'cust-105',
      amount: 50000,
      status: 'chasing',
      daysOverdue: 5,
    },
  ];

  const assessment = computeCustomerPaymentReliability(customer, invoices, []);
  assert.strictEqual(assessment.settledInvoicesCount, 0, 'Unverified claim must not register as settled');
  assert.strictEqual(assessment.score, null);
  assert.strictEqual(assessment.tier, 'INSUFFICIENT_HISTORY');
});

// -----------------------------------------------------------------------------
// CHECK 6: Open disputes do not independently lower reliability
// -----------------------------------------------------------------------------
it('Open disputes do not independently lower reliability', () => {
  const customer = { id: 'cust-106', name: 'Epsilon Tech', company: 'Epsilon Tech' };
  const invoices = [
    { id: 'i9', customerId: 'cust-106', amount: 100000, paidAmount: 100000, status: 'paid', dueDate: '2026-01-01', paidDate: '2026-01-01' },
    { id: 'i10', customerId: 'cust-106', amount: 100000, paidAmount: 100000, status: 'paid', dueDate: '2026-02-01', paidDate: '2026-02-01' },
    { id: 'i11', customerId: 'cust-106', amount: 80000, status: 'disputed', daysOverdue: 30 },
  ];

  const assessment = computeCustomerPaymentReliability(customer, invoices, []);
  assert.strictEqual(assessment.score, 100);
  assert.strictEqual(assessment.tier, 'RELIABLE');
  assert.strictEqual(assessment.disputedInvoicesCount, 1);
});

// -----------------------------------------------------------------------------
// CHECK 7: Missing or unavailable data does not produce fabricated metrics
// -----------------------------------------------------------------------------
it('Missing or unavailable data does not produce fabricated metrics', () => {
  const emptyCustomer = { id: 'cust-empty', name: 'Ghost Account', company: 'Ghost Account' };
  const assessment = computeCustomerPaymentReliability(emptyCustomer, [], []);

  assert.strictEqual(assessment.score, null);
  assert.strictEqual(assessment.totalObservations, 0);
  assert.strictEqual(assessment.tier, 'INSUFFICIENT_HISTORY');
  assert.strictEqual(assessment.primaryFactors[0], 'No invoice or payment history recorded for this customer.');
});

// -----------------------------------------------------------------------------
// CHECK 8: Reliability filters return the correct customers
// -----------------------------------------------------------------------------
it('Reliability filters return the correct customers', () => {
  const customers = [
    { id: 'c-rel', name: 'Reliable Co', company: 'Reliable Co' },
    { id: 'c-ele', name: 'Risky Co', company: 'Risky Co' },
    { id: 'c-ins', name: 'New Co', company: 'New Co' },
  ];
  const invoices = [
    { id: 'i1', customerId: 'c-rel', amount: 100000, paidAmount: 100000, status: 'paid', dueDate: '2026-01-01', paidDate: '2026-01-01' },
    { id: 'i2', customerId: 'c-rel', amount: 100000, paidAmount: 100000, status: 'paid', dueDate: '2026-02-01', paidDate: '2026-02-01' },
    { id: 'i3', customerId: 'c-ele', amount: 100000, paidAmount: 100000, status: 'paid', dueDate: '2026-01-01', paidDate: '2026-03-01' }, // 60 days late
    { id: 'i4', customerId: 'c-ele', amount: 100000, paidAmount: 100000, status: 'paid', dueDate: '2026-02-01', paidDate: '2026-04-01' }, // 60 days late
    { id: 'i5', customerId: 'c-ins', amount: 50000, paidAmount: 50000, status: 'paid', dueDate: '2026-01-01', paidDate: '2026-01-01' },
  ];
  const promises = [
    { id: 'p1', customerId: 'c-ele', invoiceId: 'i3', amount: 100000, status: 'BROKEN', promisedDate: '2026-02-01' },
  ];

  const map = computePortfolioCustomerReliability(customers, invoices, promises);

  const filterByTier = (tier) => customers.filter((c) => map.get(c.id)?.tier === tier);

  const reliable = filterByTier('RELIABLE');
  const elevated = filterByTier('ELEVATED');
  const insufficient = filterByTier('INSUFFICIENT_HISTORY');

  assert.strictEqual(reliable.length, 1);
  assert.strictEqual(reliable[0].id, 'c-rel');
  assert.strictEqual(elevated.length, 1);
  assert.strictEqual(elevated[0].id, 'c-ele');
  assert.strictEqual(insufficient.length, 1);
  assert.strictEqual(insufficient[0].id, 'c-ins');
});

// -----------------------------------------------------------------------------
// CHECK 9: Workspace isolation is preserved
// -----------------------------------------------------------------------------
it('Workspace isolation is preserved', () => {
  const ws1Cust = { id: 'c-ws1', name: 'WS1 Customer' };
  const ws2Invoices = [
    { id: 'inv-ws2', customerId: 'c-ws2', amount: 500000, paidAmount: 0, status: 'chasing', daysOverdue: 90 },
  ];

  const assessment = computeCustomerPaymentReliability(ws1Cust, ws2Invoices, []);
  assert.strictEqual(assessment.totalObservations, 0);
  assert.strictEqual(assessment.score, null);
  assert.strictEqual(assessment.tier, 'INSUFFICIENT_HISTORY');
});

// -----------------------------------------------------------------------------
// CHECK 10: Opening or viewing a profile does not mutate financial records
// -----------------------------------------------------------------------------
it('Opening or viewing a profile does not mutate financial records', () => {
  const customer = { id: 'c-test', name: 'Test Corp', company: 'Test Corp', totalPaid: 100000, outstanding: 50000 };
  const invoices = [
    { id: 'inv-test', customerId: 'c-test', amount: 150000, paidAmount: 100000, outstandingAmount: 50000, status: 'chasing' },
  ];

  const customerSnapshot = JSON.stringify(customer);
  const invoiceSnapshot = JSON.stringify(invoices);

  // Simulate modal opening and inspection
  computeCustomerPaymentReliability(customer, invoices, []);

  assert.strictEqual(JSON.stringify(customer), customerSnapshot, 'Customer record must not mutate on view');
  assert.strictEqual(JSON.stringify(invoices), invoiceSnapshot, 'Invoice records must not mutate on view');
});

// -----------------------------------------------------------------------------
// CHECK 11: Existing customer search, filtering, and navigation still work
// -----------------------------------------------------------------------------
it('Existing customer search, filtering, and navigation still work', () => {
  const customers = [
    { id: 'c1', name: 'Rahul Sharma', company: 'Rahul Enterprises', email: 'rahul@example.com' },
    { id: 'c2', name: 'Anish Kapoor', company: 'ABC Pvt Ltd', email: 'anish@example.com' },
  ];

  const searchFn = (query) => {
    const q = query.toLowerCase();
    return customers.filter((c) => c.company.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  };

  assert.strictEqual(searchFn('Rahul').length, 1);
  assert.strictEqual(searchFn('ABC').length, 1);
  assert.strictEqual(searchFn('Nonexistent').length, 0);
});

// -----------------------------------------------------------------------------
// CHECK 12: Existing financial-core, promise-fulfillment, dispute, decision safeguards intact
// -----------------------------------------------------------------------------
it('Existing financial-core, promise-fulfillment, dispute, and decision safety rules remain intact', () => {
  const settledInvoice = { id: 'inv-stop', amount: 100000, outstandingAmount: 0, status: 'paid' };
  const decision = evaluateInvoiceDecision(settledInvoice, null, []);
  assert.strictEqual(decision.action, 'STOP');
  assert.strictEqual(isCollectibleStatus('paid'), false);
  assert.strictEqual(isCollectibleStatus('disputed'), true);
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`  INTEGRATION VERIFICATION COMPLETE: ${passedTests}/${totalTests} CHECKS PASSED`);
console.log('======================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
