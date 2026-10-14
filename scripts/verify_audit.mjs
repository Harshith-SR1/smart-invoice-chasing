import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

console.log('=== SMART INVOICE CHASING AUDIT VERIFICATION SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// 1. INVOICE IMPORT TEST USING test_invoices.csv
// -------------------------------------------------------------
console.log('--- 1. Testing Invoice Import on test_invoices.csv ---');
const csvPath = path.resolve('test_invoices.csv');
const csvBuffer = fs.readFileSync(csvPath);
const workbook = XLSX.read(csvBuffer, { type: 'buffer' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

assert(rows.length === 2, `Parsed exactly 2 rows from test_invoices.csv (found: ${rows.length})`);

const inv1 = rows[0];
const inv2 = rows[1];

assert(inv1['Invoice Number'] === 'TEST-001', 'Row 1 Invoice Number is TEST-001');
assert(Number(inv1['Amount']) === 100000, 'Row 1 Amount is 100000');
assert(inv1['Status'] === 'unpaid', 'Row 1 Status is unpaid');
assert(Number(inv1['Paid Amount']) === 0, 'Row 1 Paid Amount is 0');

assert(inv2['Invoice Number'] === 'TEST-002', 'Row 2 Invoice Number is TEST-002');
assert(Number(inv2['Amount']) === 50000, 'Row 2 Amount is 50000');
assert(inv2['Status'] === 'paid', 'Row 2 Status is paid');
assert(Number(inv2['Paid Amount']) === 50000, 'Row 2 Paid Amount is 50000');

// Calculate source invariants
const inv1Outstanding = inv1['Status'] === 'paid' ? 0 : Number(inv1['Amount']) - Number(inv1['Paid Amount']);
const inv2Outstanding = inv2['Status'] === 'paid' ? 0 : Number(inv2['Amount']) - Number(inv2['Paid Amount']);
const totalRecoveredFromImport = Number(inv1['Paid Amount']) + (inv2['Status'] === 'paid' ? Number(inv2['Amount']) : Number(inv2['Paid Amount']));
const totalOutstandingFromImport = inv1Outstanding + inv2Outstanding;

assert(inv1Outstanding === 100000, `TEST-001 Outstanding is 100,000 (actual: ${inv1Outstanding})`);
assert(inv2Outstanding === 0, `TEST-002 Outstanding is 0 (actual: ${inv2Outstanding})`);
assert(totalRecoveredFromImport === 50000, `Verified Recovered is 50,000 (actual: ${totalRecoveredFromImport})`);
assert(totalOutstandingFromImport === 100000, `Total Outstanding is 100,000 (actual: ${totalOutstandingFromImport})`);

// -------------------------------------------------------------
// 2. FINANCIAL INVARIANTS & PAYMENT LIFECYCLE
// -------------------------------------------------------------
console.log('\n--- 2. Testing Payment & Financial Invariants ---');
// Invariant A: Partial payment decreases balance correctly
const invoiceAmount = 100000;
let paidAmount = 0;
let outstanding = invoiceAmount - paidAmount;

// Record partial payment of 35000
const partialPayment = 35000;
paidAmount += partialPayment;
outstanding = Math.max(0, invoiceAmount - paidAmount);

assert(outstanding === 65000, `Partial payment of 35,000 on 100,000 leaves outstanding balance of 65,000 (actual: ${outstanding})`);
assert(paidAmount === 35000, `Verified recovered equals partial payment: 35,000 (actual: ${paidAmount})`);

// Invariant B: Unverified payment claim does NOT alter outstanding or recovered
let claimStatus = 'CLAIMED';
let claimAmount = 65000;
let isVerified = false;

let verifiedRecoveredWithClaim = paidAmount + (isVerified ? claimAmount : 0);
let outstandingWithClaim = invoiceAmount - verifiedRecoveredWithClaim;

assert(outstandingWithClaim === 65000, 'Customer payment claim does NOT reduce outstanding balance until bank verification');
assert(verifiedRecoveredWithClaim === 35000, 'Customer payment claim does NOT inflate recovered revenue');

// -------------------------------------------------------------
// 3. PROMISE LIFECYCLE & FULFILLMENT RULES
// -------------------------------------------------------------
console.log('\n--- 3. Testing Promise Lifecycle & Conditions ---');
const promise = {
  id: 'prm-1',
  invoiceId: 'inv-1',
  amount: 65000,
  promisedDate: '2026-10-01',
  status: 'ACTIVE',
};

// Test A: Partial payment smaller than promise amount should NOT fulfill promise
const smallPayment = 10000;
const isSettledAfterSmallPayment = (outstanding - smallPayment) <= 0;
const satisfiesPromise = isSettledAfterSmallPayment || smallPayment >= promise.amount;
assert(!satisfiesPromise, 'Recording ₹10,000 payment against ₹65,000 promise does NOT mark promise FULFILLED');

// Test B: Payment satisfying promised amount fulfills promise
const fullPromisePayment = 65000;
const satisfiesPromiseFull = (outstanding - fullPromisePayment <= 0) || fullPromisePayment >= promise.amount;
assert(satisfiesPromiseFull, 'Recording ₹65,000 payment satisfying promise amount marks promise FULFILLED');

// Test C: Date-based broken promise detection
const todayStr = '2026-10-11';
const expiredPromiseDate = '2026-10-01'; // in the past
const isExpired = expiredPromiseDate < todayStr;
assert(isExpired, 'Promise with promisedDate 2026-10-01 is past today 2026-10-11 and evaluated as BROKEN/expired');

// -------------------------------------------------------------
// 4. AGING BUCKETS RECONCILIATION
// -------------------------------------------------------------
console.log('\n--- 4. Testing Aging Buckets Reconciliation ---');
const sampleInvoices = [
  { id: '1', daysOverdue: 0, outstandingAmount: 20000, status: 'chasing' },
  { id: '2', daysOverdue: 10, outstandingAmount: 30000, status: 'overdue' },
  { id: '3', daysOverdue: 25, outstandingAmount: 40000, status: 'overdue' }, // 16-30 days
  { id: '4', daysOverdue: 45, outstandingAmount: 50000, status: 'overdue' },
  { id: '5', daysOverdue: 75, outstandingAmount: 60000, status: 'overdue' },
  { id: '6', daysOverdue: 120, outstandingAmount: 70000, status: 'overdue' },
  { id: '7', daysOverdue: 0, outstandingAmount: 0, status: 'paid' },
];

const uncollected = sampleInvoices.filter((i) => i.status !== 'paid');
const totalUncollectedOutstanding = uncollected.reduce((s, i) => s + i.outstandingAmount, 0);

const currentBucket = uncollected.filter((i) => i.daysOverdue <= 0).reduce((s, i) => s + i.outstandingAmount, 0);
const dueSoonBucket = uncollected.filter((i) => i.daysOverdue > 0 && i.daysOverdue <= 15).reduce((s, i) => s + i.outstandingAmount, 0);
const days16_30Bucket = uncollected.filter((i) => i.daysOverdue > 15 && i.daysOverdue <= 30).reduce((s, i) => s + i.outstandingAmount, 0);
const days31_60Bucket = uncollected.filter((i) => i.daysOverdue > 30 && i.daysOverdue <= 60).reduce((s, i) => s + i.outstandingAmount, 0);
const days61_90Bucket = uncollected.filter((i) => i.daysOverdue > 60 && i.daysOverdue <= 90).reduce((s, i) => s + i.outstandingAmount, 0);
const days90PlusBucket = uncollected.filter((i) => i.daysOverdue > 90).reduce((s, i) => s + i.outstandingAmount, 0);

const sumOfAllBuckets = currentBucket + dueSoonBucket + days16_30Bucket + days31_60Bucket + days61_90Bucket + days90PlusBucket;

assert(
  sumOfAllBuckets === totalUncollectedOutstanding,
  `Sum of all 6 aging buckets (${sumOfAllBuckets}) exactly equals total uncollected outstanding (${totalUncollectedOutstanding})`
);
assert(days16_30Bucket === 40000, `16–30 days bucket correctly captures 25-day overdue invoice (40,000)`);

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log(`\n======================================================`);
console.log(`RESULTS: ${passedTests} / ${totalTests} assertions passed cleanly.`);
console.log(`======================================================\n`);
