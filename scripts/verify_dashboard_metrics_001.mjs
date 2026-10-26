/**
 * scripts/verify_dashboard_metrics_001.mjs
 *
 * Focused verification test suite for dashboard financial metrics:
 * - totalOutstanding
 * - totalOverdue
 * - activeChasingCount
 */

import assert from 'node:assert';

console.log('=============================================================');
console.log('   DASHBOARD FINANCIAL METRICS VERIFICATION SUITE           ');
console.log('=============================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${description}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

// Logic under test replicating MainDashboard.tsx implementation
const isCollectible = (status) =>
  status !== 'paid' &&
  status !== 'cancelled' &&
  status !== 'void' &&
  status !== 'held' &&
  status !== 'on_hold' &&
  status !== 'draft';

const calculateMetrics = (invoices) => {
  const totalOutstanding = invoices
    .filter((i) => isCollectible(i.status))
    .reduce((acc, curr) => {
      const out = curr.outstandingAmount !== undefined ? curr.outstandingAmount : curr.amount;
      return acc + out;
    }, 0);

  const totalOverdue = invoices
    .filter(
      (i) =>
        isCollectible(i.status) &&
        (i.status === 'overdue' ||
          i.status === 'escalated' ||
          i.status === 'disputed' ||
          i.daysOverdue > 0)
    )
    .reduce((acc, curr) => {
      const out = curr.outstandingAmount !== undefined ? curr.outstandingAmount : curr.amount;
      return acc + out;
    }, 0);

  const activeChasingCount = invoices.filter((i) => isCollectible(i.status)).length;

  return { totalOutstanding, totalOverdue, activeChasingCount };
};

// ── 1. CANCELLED, VOID, HELD, ON-HOLD EXCLUSIONS ─────────────────────────────
console.log('>>> SECTION 1: INELIGIBLE INVOICE STATUS EXCLUSIONS');

test('Cancelled invoice does not inflate totalOutstanding, totalOverdue, or activeChasingCount', () => {
  const sample = [
    { id: '1', amount: 50000, outstandingAmount: 50000, status: 'cancelled', daysOverdue: 60 },
  ];
  const { totalOutstanding, totalOverdue, activeChasingCount } = calculateMetrics(sample);
  assert.strictEqual(totalOutstanding, 0);
  assert.strictEqual(totalOverdue, 0);
  assert.strictEqual(activeChasingCount, 0);
});

test('Void invoice does not inflate totalOutstanding, totalOverdue, or activeChasingCount', () => {
  const sample = [
    { id: '2', amount: 75000, outstandingAmount: 75000, status: 'void', daysOverdue: 90 },
  ];
  const { totalOutstanding, totalOverdue, activeChasingCount } = calculateMetrics(sample);
  assert.strictEqual(totalOutstanding, 0);
  assert.strictEqual(totalOverdue, 0);
  assert.strictEqual(activeChasingCount, 0);
});

test('Held invoice does not inflate totalOutstanding, totalOverdue, or activeChasingCount', () => {
  const sample = [
    { id: '3', amount: 30000, outstandingAmount: 30000, status: 'held', daysOverdue: 15 },
  ];
  const { totalOutstanding, totalOverdue, activeChasingCount } = calculateMetrics(sample);
  assert.strictEqual(totalOutstanding, 0);
  assert.strictEqual(totalOverdue, 0);
  assert.strictEqual(activeChasingCount, 0);
});

test('On-hold invoice does not inflate totalOutstanding, totalOverdue, or activeChasingCount', () => {
  const sample = [
    { id: '4', amount: 45000, outstandingAmount: 45000, status: 'on_hold', daysOverdue: 20 },
  ];
  const { totalOutstanding, totalOverdue, activeChasingCount } = calculateMetrics(sample);
  assert.strictEqual(totalOutstanding, 0);
  assert.strictEqual(totalOverdue, 0);
  assert.strictEqual(activeChasingCount, 0);
});

test('Draft invoice does not inflate totalOutstanding, totalOverdue, or activeChasingCount', () => {
  const sample = [
    { id: '5', amount: 20000, outstandingAmount: 20000, status: 'draft', daysOverdue: 0 },
  ];
  const { totalOutstanding, totalOverdue, activeChasingCount } = calculateMetrics(sample);
  assert.strictEqual(totalOutstanding, 0);
  assert.strictEqual(totalOverdue, 0);
  assert.strictEqual(activeChasingCount, 0);
});

test('Paid invoice does not inflate totalOutstanding, totalOverdue, or activeChasingCount', () => {
  const sample = [
    { id: '6', amount: 100000, outstandingAmount: 0, status: 'paid', daysOverdue: 30 },
  ];
  const { totalOutstanding, totalOverdue, activeChasingCount } = calculateMetrics(sample);
  assert.strictEqual(totalOutstanding, 0);
  assert.strictEqual(totalOverdue, 0);
  assert.strictEqual(activeChasingCount, 0);
});

// ── 2. COLLECTIBLE ACTIVE RECEIVABLES INCLUSIONS ─────────────────────────────
console.log('\n>>> SECTION 2: COLLECTIBLE ACTIVE RECEIVABLES');

test('Active overdue invoice is counted in all metrics', () => {
  const sample = [
    { id: '7', amount: 85000, outstandingAmount: 85000, status: 'overdue', daysOverdue: 45 },
  ];
  const { totalOutstanding, totalOverdue, activeChasingCount } = calculateMetrics(sample);
  assert.strictEqual(totalOutstanding, 85000);
  assert.strictEqual(totalOverdue, 85000);
  assert.strictEqual(activeChasingCount, 1);
});

test('Active chasing invoice not yet overdue is counted in outstanding and active chasing, but not overdue', () => {
  const sample = [
    { id: '8', amount: 60000, outstandingAmount: 60000, status: 'chasing', daysOverdue: 0 },
  ];
  const { totalOutstanding, totalOverdue, activeChasingCount } = calculateMetrics(sample);
  assert.strictEqual(totalOutstanding, 60000);
  assert.strictEqual(totalOverdue, 0);
  assert.strictEqual(activeChasingCount, 1);
});

test('Partially paid invoice correctly contributes only remaining balance to metrics', () => {
  const sample = [
    { id: '9', amount: 100000, paidAmount: 40000, outstandingAmount: 60000, status: 'partially_paid', daysOverdue: 15 },
  ];
  const { totalOutstanding, totalOverdue, activeChasingCount } = calculateMetrics(sample);
  assert.strictEqual(totalOutstanding, 60000);
  assert.strictEqual(totalOverdue, 60000);
  assert.strictEqual(activeChasingCount, 1);
});

test('Promised and disputed invoices remain collectible until settled or cancelled', () => {
  const sample = [
    { id: '10', amount: 50000, outstandingAmount: 50000, status: 'promised', daysOverdue: 10 },
    { id: '11', amount: 40000, outstandingAmount: 40000, status: 'disputed', daysOverdue: 25 },
  ];
  const { totalOutstanding, totalOverdue, activeChasingCount } = calculateMetrics(sample);
  assert.strictEqual(totalOutstanding, 90000);
  assert.strictEqual(totalOverdue, 90000);
  assert.strictEqual(activeChasingCount, 2);
});

// ── 3. MIXED PORTFOLIO ACCURACY ─────────────────────────────────────────────
console.log('\n>>> SECTION 3: MIXED PORTFOLIO RECONCILIATION');

test('Mixed portfolio correctly excludes ineligible statuses while aggregating active collectible receivables', () => {
  const portfolio = [
    // Collectible
    { id: 'a1', amount: 100000, outstandingAmount: 100000, status: 'overdue', daysOverdue: 20 },
    { id: 'a2', amount: 50000, outstandingAmount: 25000, status: 'partially_paid', daysOverdue: 5 },
    { id: 'a3', amount: 80000, outstandingAmount: 80000, status: 'chasing', daysOverdue: 0 },
    // Ineligible (must be excluded)
    { id: 'i1', amount: 200000, outstandingAmount: 0, status: 'paid', daysOverdue: 100 },
    { id: 'i2', amount: 150000, outstandingAmount: 150000, status: 'cancelled', daysOverdue: 90 },
    { id: 'i3', amount: 75000, outstandingAmount: 75000, status: 'void', daysOverdue: 45 },
    { id: 'i4', amount: 60000, outstandingAmount: 60000, status: 'held', daysOverdue: 30 },
    { id: 'i5', amount: 40000, outstandingAmount: 40000, status: 'on_hold', daysOverdue: 15 },
    { id: 'i6', amount: 30000, outstandingAmount: 30000, status: 'draft', daysOverdue: 0 },
  ];

  const { totalOutstanding, totalOverdue, activeChasingCount } = calculateMetrics(portfolio);

  // Collectible outstanding = a1 (100000) + a2 (25000) + a3 (80000) = 205000
  assert.strictEqual(totalOutstanding, 205000);

  // Collectible overdue = a1 (100000) + a2 (25000) = 125000 (a3 is daysOverdue = 0 and status is chasing)
  assert.strictEqual(totalOverdue, 125000);

  // Active chasing count = a1, a2, a3 = 3
  assert.strictEqual(activeChasingCount, 3);
});

console.log('\n=============================================================');
console.log(`   DASHBOARD METRICS TEST RESULTS: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
console.log('=============================================================\n');
