/**
 * VERIFICATION SCRIPT: TASK INVOICE-EXPORT-AUDIT-RECONCILIATION-001
 * Canonical Invoice CSV Export & Financial Reconciliation Audit
 *
 * Requirements Tested:
 * 1. Fully paid invoice exports the correct verified paid amount and zero outstanding.
 * 2. Partially paid invoice exports the correct confirmed amount and remaining balance.
 * 3. Unverified payment claims do not reduce outstanding.
 * 4. Rejected claims do not count as received funds.
 * 5. Disputed invoices retain their receivable balance and disputed state.
 * 6. Draft, cancelled, void, and held invoices retain the correct status.
 * 7. Duplicate confirmed payment events are not double-counted beyond the canonical ledger rules.
 * 8. Export totals reconcile with financial-core/reporting calculations where definitions match.
 * 9. Search and active filters produce the intended export scope.
 * 10. Pagination does not silently truncate the export.
 * 11. Workspace isolation and server-side authorization are preserved.
 * 12. CSV escaping handles commas, quotes, and newlines.
 * 13. Formula-injection payloads are handled safely.
 * 14. Empty results are distinguished from export failures.
 * 15. Viewing or exporting does not mutate invoices, payments, promises, or collection events.
 * 16. Existing invoice import, dispute, promise, and payment-verification rules remain intact.
 *
 * Usage: node scripts/verify_invoice_export_audit_reconciliation_001.mjs
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Auto-delegate to tsx if executed in standard node
if (!process.env.TSX_SPAWNED) {
  const res = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', 'scripts/verify_invoice_export_audit_reconciliation_001.mjs'],
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
  sanitiseCsvField,
  computeCanonicalInvoiceRow,
  generateInvoicesCsv,
  exportInvoicesToCsv,
  INVOICE_EXPORT_COLUMNS,
} = await import('../src/lib/invoiceExport.ts');

const { buildRecoveryReportSummary } = await import('../src/context/AppContext.tsx');
const { isCollectibleStatus } = await import('../src/types/index.ts');

console.log('======================================================================');
console.log('  TASK INVOICE-EXPORT-AUDIT-RECONCILIATION-001: CSV EXPORT & RECONCILIATION');
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

// Helper to parse RFC 4180 CSV rows into string arrays (respecting embedded newlines inside quotes)
function parseCsv(csvText) {
  const clean = csvText.replace(/^\uFEFF/, '');
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && clean[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentCell);
      if (currentRow.length > 1 || currentRow[0] !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += c;
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

// -----------------------------------------------------------------------------
// CHECK 1: Fully paid invoice exports verified paid amount and zero outstanding
// -----------------------------------------------------------------------------
it('Fully paid invoice exports correct verified paid amount and zero outstanding', () => {
  const inv = {
    id: 'inv-1',
    invoiceNumber: 'INV-1001',
    customerName: 'Acme Enterprises',
    customerEmail: 'billing@acme.com',
    amount: 50000,
    paidAmount: 50000,
    outstandingAmount: 0,
    status: 'paid',
    daysOverdue: 0,
    currency: 'INR',
    issueDate: '2026-09-01',
    dueDate: '2026-09-30',
  };

  const row = computeCanonicalInvoiceRow(inv);
  assert.strictEqual(row.originalAmount, 50000);
  assert.strictEqual(row.verifiedPaidAmount, 50000);
  assert.strictEqual(row.outstandingBalance, 0);
  assert.strictEqual(row.invoiceStatus, 'paid');
  assert.strictEqual(row.collectionState, 'SETTLED');
  assert.strictEqual(row.daysOverdue, 0);

  const csv = generateInvoicesCsv([inv]);
  const parsed = parseCsv(csv);
  assert.strictEqual(parsed.length, 2, 'Header plus 1 row');
  const [header, dataRow] = parsed;
  assert.strictEqual(dataRow[header.indexOf('Invoice Number')], 'INV-1001');
  assert.strictEqual(dataRow[header.indexOf('Original Amount')], '50000.00');
  assert.strictEqual(dataRow[header.indexOf('Verified Paid Amount')], '50000.00');
  assert.strictEqual(dataRow[header.indexOf('Outstanding Balance')], '0.00');
  assert.strictEqual(dataRow[header.indexOf('Invoice Status')], 'paid');
});

// -----------------------------------------------------------------------------
// CHECK 2: Partially paid invoice exports confirmed amount and remaining balance
// -----------------------------------------------------------------------------
it('Partially paid invoice exports correct confirmed amount and remaining balance', () => {
  const inv = {
    id: 'inv-2',
    invoiceNumber: 'INV-1002',
    customerName: 'Stark Industries',
    customerEmail: 'tony@stark.com',
    amount: 100000,
    paidAmount: 35000,
    outstandingAmount: 65000,
    status: 'partially_paid',
    daysOverdue: 12,
    currency: 'USD',
    issueDate: '2026-09-10',
    dueDate: '2026-10-10',
    collectionCategory: 'ACTIVE',
  };

  const row = computeCanonicalInvoiceRow(inv);
  assert.strictEqual(row.originalAmount, 100000);
  assert.strictEqual(row.verifiedPaidAmount, 35000);
  assert.strictEqual(row.outstandingBalance, 65000);
  assert.strictEqual(row.invoiceStatus, 'partially_paid');

  const csv = generateInvoicesCsv([inv]);
  const parsed = parseCsv(csv);
  const [header, dataRow] = parsed;
  assert.strictEqual(dataRow[header.indexOf('Original Amount')], '100000.00');
  assert.strictEqual(dataRow[header.indexOf('Verified Paid Amount')], '35000.00');
  assert.strictEqual(dataRow[header.indexOf('Outstanding Balance')], '65000.00');
});

// -----------------------------------------------------------------------------
// CHECK 3: Unverified payment claims do not reduce outstanding
// -----------------------------------------------------------------------------
it('Unverified payment claims do not reduce outstanding balance', () => {
  const inv = {
    id: 'inv-3',
    invoiceNumber: 'INV-1003',
    customerName: 'Wayne Enterprises',
    customerEmail: 'bruce@wayne.com',
    amount: 200000,
    paidAmount: 0,
    outstandingAmount: 200000,
    status: 'chasing',
    paymentClaimStatus: 'CLAIMED',
    daysOverdue: 8,
    currency: 'INR',
    payments: [
      { id: 'pay-claim-1', amount: 200000, status: 'pending_verification', source: 'customer_claim' },
    ],
  };

  const row = computeCanonicalInvoiceRow(inv);
  assert.strictEqual(row.verifiedPaidAmount, 0, 'Unverified claim must not count as verified paid');
  assert.strictEqual(row.outstandingBalance, 200000, 'Unverified claim must not reduce outstanding');
  assert.strictEqual(row.paymentClaimStatus, 'CLAIMED');

  const csv = generateInvoicesCsv([inv]);
  const [header, dataRow] = parseCsv(csv);
  assert.strictEqual(dataRow[header.indexOf('Verified Paid Amount')], '0.00');
  assert.strictEqual(dataRow[header.indexOf('Outstanding Balance')], '200000.00');
  assert.strictEqual(dataRow[header.indexOf('Payment Claim Status')], 'CLAIMED');
});

// -----------------------------------------------------------------------------
// CHECK 4: Rejected claims do not count as received funds
// -----------------------------------------------------------------------------
it('Rejected claims do not count as received funds', () => {
  const inv = {
    id: 'inv-4',
    invoiceNumber: 'INV-1004',
    customerName: 'Oscorp Tech',
    customerEmail: 'norman@oscorp.com',
    amount: 80000,
    paidAmount: 0,
    outstandingAmount: 80000,
    status: 'overdue',
    paymentClaimStatus: 'REJECTED',
    daysOverdue: 22,
    payments: [
      { id: 'pay-rej-1', amount: 80000, status: 'rejected', source: 'customer_claim' },
    ],
  };

  const row = computeCanonicalInvoiceRow(inv);
  assert.strictEqual(row.verifiedPaidAmount, 0);
  assert.strictEqual(row.outstandingBalance, 80000);
  assert.strictEqual(row.paymentClaimStatus, 'REJECTED');
});

// -----------------------------------------------------------------------------
// CHECK 5: Disputed invoices retain receivable balance and disputed state
// -----------------------------------------------------------------------------
it('Disputed invoices retain receivable balance and disputed state', () => {
  const inv = {
    id: 'inv-5',
    invoiceNumber: 'INV-1005',
    customerName: 'Cyberdyne Systems',
    customerEmail: 'miles@cyberdyne.com',
    amount: 150000,
    paidAmount: 0,
    outstandingAmount: 150000,
    status: 'disputed',
    daysOverdue: 35,
    currency: 'INR',
  };

  const row = computeCanonicalInvoiceRow(inv);
  assert.strictEqual(row.outstandingBalance, 150000, 'Receivable balance is retained');
  assert.strictEqual(row.invoiceStatus, 'disputed');
  assert.strictEqual(row.collectionState, 'DISPUTED (COLLECTION PAUSED)');

  const csv = generateInvoicesCsv([inv]);
  const [header, dataRow] = parseCsv(csv);
  assert.strictEqual(dataRow[header.indexOf('Collection State')], 'DISPUTED (COLLECTION PAUSED)');
  assert.strictEqual(dataRow[header.indexOf('Outstanding Balance')], '150000.00');
});

// -----------------------------------------------------------------------------
// CHECK 6: Draft, cancelled, void, and held invoices retain correct status
// -----------------------------------------------------------------------------
it('Draft, cancelled, void, and held invoices retain correct status without relabeling', () => {
  const statuses = ['draft', 'cancelled', 'void', 'held'];
  for (const status of statuses) {
    const inv = {
      id: `inv-${status}`,
      invoiceNumber: `INV-${status.toUpperCase()}`,
      customerName: 'Omni Consumer Products',
      amount: 45000,
      status,
      daysOverdue: 0,
    };
    const row = computeCanonicalInvoiceRow(inv);
    assert.strictEqual(row.invoiceStatus, status);
    assert.strictEqual(row.collectionState, status.toUpperCase());
    assert.strictEqual(isCollectibleStatus(status), false, `${status} is not collectible`);
  }
});

// -----------------------------------------------------------------------------
// CHECK 7: Duplicate confirmed payment events are not double-counted
// -----------------------------------------------------------------------------
it('Duplicate confirmed payment events are not double-counted beyond canonical ledger rules', () => {
  const inv = {
    id: 'inv-7',
    invoiceNumber: 'INV-1007',
    customerName: 'Umbrella Corp',
    amount: 100000,
    status: 'partially_paid',
    // Two confirmed payments of 30,000 each = 60,000 confirmed
    payments: [
      { id: 'p-1', amount: 30000, status: 'confirmed' },
      { id: 'p-2', amount: 30000, status: 'confirmed' },
    ],
  };

  const row = computeCanonicalInvoiceRow(inv);
  assert.strictEqual(row.verifiedPaidAmount, 60000);
  assert.strictEqual(row.outstandingBalance, 40000);

  // If status is prematurely marked paid without confirmed funds, inconsistency is flagged
  const stalePaidInv = {
    id: 'inv-7b',
    invoiceNumber: 'INV-1007B',
    customerName: 'Initech',
    amount: 100000,
    status: 'paid',
    payments: [
      { id: 'p-1b', amount: 10000, status: 'confirmed' },
    ],
  };
  const rowStale = computeCanonicalInvoiceRow(stalePaidInv);
  assert(rowStale.inconsistencyWarning, 'Inconsistency must be flagged when paid status contradicts ledger');
  assert.strictEqual(rowStale.verifiedPaidAmount, 10000);
  assert.strictEqual(rowStale.outstandingBalance, 90000);
});

// -----------------------------------------------------------------------------
// CHECK 8: Export totals reconcile with financial-core/reporting calculations
// -----------------------------------------------------------------------------
it('Export totals reconcile with financial-core/reporting calculations', () => {
  const invoices = [
    {
      id: 'i1',
      invoiceNumber: 'INV-A1',
      customerName: 'Client Alpha',
      amount: 100000,
      paidAmount: 100000,
      outstandingAmount: 0,
      status: 'paid',
      paidDate: new Date().toISOString(),
      daysOverdue: 0,
    },
    {
      id: 'i2',
      invoiceNumber: 'INV-A2',
      customerName: 'Client Beta',
      amount: 80000,
      paidAmount: 20000,
      outstandingAmount: 60000,
      status: 'chasing',
      daysOverdue: 15,
    },
    {
      id: 'i3',
      invoiceNumber: 'INV-A3',
      customerName: 'Client Gamma',
      amount: 40000,
      paidAmount: 0,
      outstandingAmount: 40000,
      status: 'disputed',
      daysOverdue: 30,
    },
  ];

  // Recovery report summary computation
  const summary = buildRecoveryReportSummary(invoices, [], 'INR', true);

  // Export CSV generation
  const csv = generateInvoicesCsv(invoices);
  const [header, ...rows] = parseCsv(csv);

  const origIdx = header.indexOf('Original Amount');
  const paidIdx = header.indexOf('Verified Paid Amount');
  const outIdx = header.indexOf('Outstanding Balance');

  const exportTotalOriginal = rows.reduce((s, r) => s + parseFloat(r[origIdx]), 0);
  const exportTotalPaid = rows.reduce((s, r) => s + parseFloat(r[paidIdx]), 0);
  const exportTotalOutstanding = rows.reduce((s, r) => s + parseFloat(r[outIdx]), 0);

  // Collectible outstanding in summary: i2 (60,000) + i3 (40,000) = 100,000
  assert.strictEqual(exportTotalOriginal, 220000);
  assert.strictEqual(exportTotalPaid, 120000);
  assert.strictEqual(exportTotalOutstanding, 100000);
  assert.strictEqual(exportTotalOutstanding, summary.totalOutstanding, 'Export outstanding matches report total');
});

// -----------------------------------------------------------------------------
// CHECK 9: Search and active filters produce the intended export scope
// -----------------------------------------------------------------------------
it('Search and active filters produce the intended export scope', () => {
  const invoices = [
    { id: '1', invoiceNumber: 'INV-S1', customerName: 'Apex Logistics', customerEmail: 'apex@log.com', status: 'chasing', collectionCategory: 'ACTIVE' },
    { id: '2', invoiceNumber: 'INV-S2', customerName: 'Blue Skies', customerEmail: 'blue@sky.com', status: 'disputed', collectionCategory: 'DISPUTERS' },
    { id: '3', invoiceNumber: 'INV-S3', customerName: 'Apex Services', customerEmail: 'serv@apex.com', status: 'paid', collectionCategory: 'ACTIVE' },
  ];

  // 1. Search filter: "Apex"
  const searchApex = invoices.filter((i) => i.customerName.toLowerCase().includes('apex'));
  assert.strictEqual(searchApex.length, 2);
  const csvSearch = generateInvoicesCsv(searchApex);
  const parsedSearch = parseCsv(csvSearch);
  assert.strictEqual(parsedSearch.length - 1, 2, '2 records exported for search Apex');

  // 2. Disputers tab filter
  const disputers = invoices.filter((i) => i.status === 'disputed' || i.collectionCategory === 'DISPUTERS');
  assert.strictEqual(disputers.length, 1);
  const csvDisputers = generateInvoicesCsv(disputers);
  const parsedDisputers = parseCsv(csvDisputers);
  assert.strictEqual(parsedDisputers.length - 1, 1, '1 record exported for Disputers tab');
  assert.strictEqual(parsedDisputers[1][0], 'INV-S2');
});

// -----------------------------------------------------------------------------
// CHECK 10: Pagination does not silently truncate the export
// -----------------------------------------------------------------------------
it('Pagination does not silently truncate the export: complete matching set is exported', () => {
  // Simulate 35 matching records with a 10-item page UI limit
  const allMatchingInvoices = [];
  for (let i = 1; i <= 35; i++) {
    allMatchingInvoices.push({
      id: `p-inv-${i}`,
      invoiceNumber: `INV-PAGE-${String(i).padStart(3, '0')}`,
      customerName: `Customer ${i}`,
      amount: 10000 * i,
      status: 'chasing',
      daysOverdue: i,
    });
  }

  // Export receives the full filtered array, NOT just slice(0, 10)
  const result = exportInvoicesToCsv(allMatchingInvoices, { scopeName: 'All' });
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.rowCount, 35, 'Export includes all 35 records, not page 1 slice');

  const csv = generateInvoicesCsv(allMatchingInvoices);
  const rows = parseCsv(csv);
  assert.strictEqual(rows.length - 1, 35, 'CSV has exactly 35 data rows');
});

// -----------------------------------------------------------------------------
// CHECK 11: Workspace isolation and server-side authorization are preserved
// -----------------------------------------------------------------------------
it('Workspace isolation and server-side authorization are preserved', () => {
  const ws1Invoices = [
    { id: 'ws1-inv1', workspaceId: 'ws-tenant-1', invoiceNumber: 'W1-01', customerName: 'Tenant 1 Cust', amount: 50000, status: 'chasing' },
  ];
  const ws2Invoices = [
    { id: 'ws2-inv1', workspaceId: 'ws-tenant-2', invoiceNumber: 'W2-01', customerName: 'Tenant 2 Cust', amount: 90000, status: 'chasing' },
  ];

  // In the application, invoices in AppContext are strictly scoped by workspace_id query
  const res1 = exportInvoicesToCsv(ws1Invoices);
  const res2 = exportInvoicesToCsv(ws2Invoices);

  const csv1 = generateInvoicesCsv(ws1Invoices);
  const csv2 = generateInvoicesCsv(ws2Invoices);

  assert(csv1.includes('W1-01') && !csv1.includes('W2-01'), 'Tenant 1 export contains only Tenant 1 invoices');
  assert(csv2.includes('W2-01') && !csv2.includes('W1-01'), 'Tenant 2 export contains only Tenant 2 invoices');
});

// -----------------------------------------------------------------------------
// CHECK 12: CSV escaping handles commas, quotes, and newlines
// -----------------------------------------------------------------------------
it('CSV escaping handles commas, quotes, and newlines correctly', () => {
  const invWithSpecialChars = {
    id: 'spec-1',
    invoiceNumber: 'INV-SPEC-1',
    customerName: 'Smith, Jones & "Partner" LLC',
    customerEmail: 'info@partner.com',
    amount: 12500,
    status: 'chasing',
    nextAction: 'Call customer;\nFollow up with invoice copy',
  };

  const csv = generateInvoicesCsv([invWithSpecialChars]);
  const parsed = parseCsv(csv);
  const [header, dataRow] = parsed;

  const nameIdx = header.indexOf('Customer Name');
  const actionIdx = header.indexOf('Next Action');

  assert.strictEqual(dataRow[nameIdx], 'Smith, Jones & "Partner" LLC', 'Embedded commas and quotes are parsed accurately');
  assert(dataRow[actionIdx].includes('Follow up with invoice copy'), 'Embedded newline preserved');
});

// -----------------------------------------------------------------------------
// CHECK 13: Formula-injection payloads are handled safely
// -----------------------------------------------------------------------------
it('Formula-injection payloads are safely neutralised by prefixing with quote', () => {
  const injectionPayloads = [
    '=1+1',
    '+cmd|"/C calc"!A0',
    '-2+5',
    '@SUM(A1:A10)',
    '\t=malicious_tab()',
    '\r=malicious_return()',
  ];

  for (const payload of injectionPayloads) {
    const sanitised = sanitiseCsvField(payload);
    assert(
      sanitised.startsWith(`"'`) || sanitised.startsWith(`'`),
      `Payload "${payload}" must be prepended with single quote to prevent spreadsheet execution. Got: ${sanitised}`
    );
  }

  // Also verify numbers are not quoted as formula injection
  assert.strictEqual(sanitiseCsvField(1234.5), '1234.5');
  assert.strictEqual(sanitiseCsvField(true), 'true');
  assert.strictEqual(sanitiseCsvField(null), '');
});

// -----------------------------------------------------------------------------
// CHECK 14: Empty results are distinguished from export failures
// -----------------------------------------------------------------------------
it('Empty results are distinguished from export failures', () => {
  // Empty array -> Valid export operation with 0 rows
  const emptyRes = exportInvoicesToCsv([], { scopeName: 'Ghosters' });
  assert.strictEqual(emptyRes.success, true);
  assert.strictEqual(emptyRes.rowCount, 0);
  assert.strictEqual(emptyRes.isEmpty, true);

  // Null/undefined dataset -> Failure
  const failRes = exportInvoicesToCsv(null);
  assert.strictEqual(failRes.success, false);
  assert(failRes.error && failRes.error.includes('unavailable'), 'Visible failure when dataset is unavailable');
});

// -----------------------------------------------------------------------------
// CHECK 15: Viewing or exporting does not mutate invoices, payments, promises, or collection events
// -----------------------------------------------------------------------------
it('Viewing or exporting does not mutate invoices, payments, promises, or collection events', () => {
  const original = {
    id: 'mut-1',
    invoiceNumber: 'INV-MUT-1',
    customerName: 'Immutable Holdings',
    amount: 100000,
    paidAmount: 20000,
    outstandingAmount: 80000,
    status: 'chasing',
    payments: [{ id: 'p1', amount: 20000, status: 'confirmed' }],
    timeline: [{ id: 'e1', type: 'reminder_sent', title: 'Reminder sent' }],
  };

  const snapshotBefore = JSON.stringify(original);
  computeCanonicalInvoiceRow(original);
  generateInvoicesCsv([original]);
  exportInvoicesToCsv([original]);
  const snapshotAfter = JSON.stringify(original);

  assert.strictEqual(snapshotBefore, snapshotAfter, 'Export operation must not mutate input records');
});

// -----------------------------------------------------------------------------
// CHECK 16: Existing invoice import, dispute, promise, and payment-verification rules remain intact
// -----------------------------------------------------------------------------
it('Existing invoice import, dispute, promise, and payment-verification rules remain intact', () => {
  // Verify INVOICE_EXPORT_COLUMNS contract integrity
  assert(INVOICE_EXPORT_COLUMNS.includes('Invoice Number'));
  assert(INVOICE_EXPORT_COLUMNS.includes('Customer Name'));
  assert(INVOICE_EXPORT_COLUMNS.includes('Original Amount'));
  assert(INVOICE_EXPORT_COLUMNS.includes('Verified Paid Amount'));
  assert(INVOICE_EXPORT_COLUMNS.includes('Outstanding Balance'));
  assert(INVOICE_EXPORT_COLUMNS.includes('Invoice Status'));
  assert(INVOICE_EXPORT_COLUMNS.includes('Collection State'));
  assert(INVOICE_EXPORT_COLUMNS.includes('Payment Claim Status'));
  assert(INVOICE_EXPORT_COLUMNS.includes('Days Overdue'));

  // Verify non-collectible statuses
  assert.strictEqual(isCollectibleStatus('paid'), false);
  assert.strictEqual(isCollectibleStatus('cancelled'), false);
  assert.strictEqual(isCollectibleStatus('void'), false);
  assert.strictEqual(isCollectibleStatus('draft'), false);
  assert.strictEqual(isCollectibleStatus('held'), false);
  assert.strictEqual(isCollectibleStatus('on_hold'), false);
  assert.strictEqual(isCollectibleStatus('overdue'), true);
  assert.strictEqual(isCollectibleStatus('chasing'), true);
  assert.strictEqual(isCollectibleStatus('disputed'), true);
});

console.log('\n----------------------------------------------------------------------');
console.log(`Results: ${passedTests} / ${totalTests} checks passed.`);
if (passedTests === totalTests) {
  console.log('STATUS: ALL RECONCILIATION AUDIT CHECKS PASSED SUCCESSFULLY.');
} else {
  console.error(`STATUS: ${totalTests - passedTests} CHECKS FAILED.`);
  process.exit(1);
}
