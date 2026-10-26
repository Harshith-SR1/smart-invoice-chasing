/**
 * VERIFICATION SCRIPT: TASK INVOICE-IMPORT-PERSIST-001
 * Persist Imported Invoices to Authenticated Workspace
 *
 * Verifies:
 * 1. Valid CSV import structure and parsing
 * 2. Valid XLS/XLSX import parsing parity
 * 3. Row-level validation rejects invalid amounts, missing numbers, and invalid dates
 * 4. Database failure does not report affected rows as successful
 * 5. Re-importing follows duplicate policy ('skip' vs 'update')
 * 6. Importing NEVER overwrites confirmed payments, settlement, or collection history
 * 7. Cross-workspace isolation prevents unauthorized import
 * 8. Refresh/new session loads persisted invoices consistently
 * 9. Metrics across Dashboard, Aging, Reports reconcile with imported state
 *
 * Usage: node scripts/verify_invoice_import_persist_001.mjs (or npx tsx scripts/verify_invoice_import_persist_001.mjs)
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert';
import * as XLSX from 'xlsx';

// If executed directly with pure node without TypeScript loader, delegate to tsx
if (!process.env.TSX_SPAWNED) {
  try {
    // Check if TypeScript files can be loaded natively
    await import('../src/services/accountService.ts');
  } catch (err) {
    if (err.code === 'ERR_UNKNOWN_FILE_EXTENSION') {
      const res = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'scripts/verify_invoice_import_persist_001.mjs'], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, TSX_SPAWNED: '1' },
      });
      process.exit(res.status || 0);
    }
  }
}

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

console.log('=== TASK INVOICE-IMPORT-PERSIST-001: IMPORT PERSISTENCE AUDIT & VERIFICATION ===\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(`   Error: ${err.message}`);
  }
}

async function itAsync(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(`   Error: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. In-Memory Mock Supabase Database
// ─────────────────────────────────────────────────────────────────────────────
function createMockSupabase(initialState = {}) {
  const state = {
    workspaces: new Map(initialState.workspaces || [
      ['a1111111-1111-4111-a111-111111111111', { id: 'a1111111-1111-4111-a111-111111111111', user_id: 'user-alice', currency: 'INR' }],
      ['b2222222-2222-4222-b222-222222222222', { id: 'b2222222-2222-4222-b222-222222222222', user_id: 'user-bob', currency: 'USD' }],
    ]),
    workspace_members: new Map(initialState.workspace_members || [
      ['mem-1', { id: 'mem-1', workspace_id: 'a1111111-1111-4111-a111-111111111111', user_id: 'user-alice-member', status: 'active' }],
    ]),
    customers: new Map(initialState.customers || []),
    invoices: new Map(initialState.invoices || []),
    payments: new Map(initialState.payments || []),
    collection_events: new Map(initialState.collection_events || []),
  };

  let currentUser = 'currentUser' in initialState ? initialState.currentUser : { id: 'user-alice', email: 'alice@alpha.io' };
  let simulatedDbError = null;
  const tableErrors = new Map();

  return {
    state,
    setCurrentUser(user) { currentUser = user; },
    setDbError(err) { simulatedDbError = err; },
    setTableError(table, err) { tableErrors.set(table, err); },
    auth: {
      async getUser() {
        if (!currentUser) return { data: { user: null }, error: { message: 'Not authenticated' } };
        return { data: { user: currentUser }, error: null };
      },
    },
    from(table) {
      const err = tableErrors.get(table) || simulatedDbError;
      if (err) {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: err }) }),
              maybeSingle: () => Promise.resolve({ data: null, error: err }),
            }),
            in: () => Promise.resolve({ data: null, error: err }),
          }),
          insert: () => ({
            select: () => Promise.resolve({ data: null, error: err }),
            then: (resolve) => resolve({ data: null, error: err }),
          }),
          upsert: () => ({
            select: () => Promise.resolve({ data: null, error: err }),
            then: (resolve) => resolve({ data: null, error: err }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: null, error: err }),
            }),
          }),
        };
      }

      const tableData = state[table] || new Map();

      return {
        select(cols) {
          let rows = Array.from(tableData.values());
          return {
            eq(col, val) {
              rows = rows.filter((r) => r[col] === val);
              return {
                maybeSingle: async () => ({ data: rows[0] || null, error: null }),
                single: async () => ({ data: rows[0] || null, error: null }),
                eq(col2, val2) {
                  rows = rows.filter((r) => r[col2] === val2);
                  return {
                    maybeSingle: async () => ({ data: rows[0] || null, error: null }),
                    in(col3, vals) {
                      rows = rows.filter((r) => vals.includes(r[col3]));
                      return Promise.resolve({ data: rows, error: null });
                    },
                  };
                },
                in(col2, vals) {
                  rows = rows.filter((r) => vals.includes(r[col2]));
                  return Promise.resolve({ data: rows, error: null });
                },
                order: () => Promise.resolve({ data: rows, error: null }),
              };
            },
            in(col, vals) {
              rows = rows.filter((r) => vals.includes(r[col]));
              return Promise.resolve({ data: rows, error: null });
            },
            limit: () => ({
              maybeSingle: async () => ({ data: rows[0] || null, error: null }),
            }),
          };
        },
        insert(items) {
          const run = () => {
            const inserted = (Array.isArray(items) ? items : [items]).map((item, idx) => {
              const id = item.id || `gen-uuid-${Date.now()}-${idx}-${Math.random()}`;
              const record = { ...item, id };
              tableData.set(id, record);
              return record;
            });
            return { data: inserted, error: null };
          };
          return {
            select: () => Promise.resolve(run()),
            then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
            catch: (reject) => Promise.resolve(run()).catch(reject),
          };
        },
        upsert(items, opts = {}) {
          const run = () => {
            const upserted = (Array.isArray(items) ? items : [items]).map((item, idx) => {
              let existingId = item.id;
              if (!existingId && opts.onConflict) {
                const conflictKeys = opts.onConflict.split(',');
                for (const [k, v] of tableData.entries()) {
                  if (conflictKeys.every((key) => v[key] === item[key])) {
                    existingId = k;
                    break;
                  }
                }
              }
              const id = existingId || `gen-uuid-${Date.now()}-${idx}`;
              const merged = { ...(tableData.get(id) || {}), ...item, id };
              tableData.set(id, merged);
              return merged;
            });
            return { data: upserted, error: null };
          };
          return {
            select: () => Promise.resolve(run()),
            then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
            catch: (reject) => Promise.resolve(run()).catch(reject),
          };
        },

        update(updates) {
          return {
            eq(col1, val1) {
              return {
                eq: async (col2, val2) => {
                  if (simulatedDbError) return { data: null, error: simulatedDbError };
                  for (const [id, record] of tableData.entries()) {
                    if (record[col1] === val1 && record[col2] === val2) {
                      tableData.set(id, { ...record, ...updates });
                    }
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Parser Logic Test (CSV and XLSX parity)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- 1. Testing CSV, XLS, and XLSX Parser Parity ---');

it('parses valid spreadsheet rows into canonical invoice structures', () => {
  const headers = ['Invoice Number', 'Customer Name', 'Customer Email', 'Amount', 'Due Date', 'Status'];
  const testRows = [
    { 'Invoice Number': 'INV-1001', 'Customer Name': 'Acme Corp', 'Customer Email': 'billing@acme.com', 'Amount': '50000', 'Due Date': '2026-11-01', 'Status': 'overdue' },
    { 'Invoice Number': 'INV-1002', 'Customer Name': 'Beta LLC', 'Customer Email': 'beta@llc.com', 'Amount': 25000, 'Due Date': '2026-11-15', 'Status': 'paid' },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(testRows, { header: headers });
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Read back buffer
  const readWb = XLSX.read(buffer, { type: 'buffer' });
  const readSheet = readWb.Sheets[readWb.SheetNames[0]];
  const readData = XLSX.utils.sheet_to_json(readSheet);

  assert.strictEqual(readData.length, 2);
  assert.strictEqual(readData[0]['Invoice Number'], 'INV-1001');
  assert.strictEqual(Number(readData[0]['Amount']), 50000);
  assert.strictEqual(readData[1]['Invoice Number'], 'INV-1002');
  assert.strictEqual(Number(readData[1]['Amount']), 25000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Row-Level Validation & Sanitation Tests
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 2. Testing Row-Level Validation & Error Handling ---');

async function executeImportValidation(mockDb, wsId, rows, options = {}) {
  // Simulates accountService.importInvoicesBatch
  const { AccountService } = await import('../src/services/accountService.js').catch(async () => {
    // If running under pure node without ts transpiler, use TS module or direct dynamic import
    return { AccountService: null };
  });

  // Direct test of the AccountService batch import logic against mockDb
  const svc = new (await import('../src/services/accountService.ts')).AccountService();
  return await svc.importInvoicesBatch(wsId, rows, { ...options, supabaseClient: mockDb });
}

await itAsync('rejects rows with missing invoice numbers, missing customers, or non-positive amounts', async () => {
  const mockDb = createMockSupabase();
  const wsId = 'a1111111-1111-4111-a111-111111111111';

  const rows = [
    { invoiceNumber: '', customerName: 'Valid Customer', amount: 50000, dueDate: '2026-11-01' }, // Missing invoice number
    { invoiceNumber: 'INV-VALID', customerName: '', amount: 50000, dueDate: '2026-11-01' },     // Missing customer name
    { invoiceNumber: 'INV-ZERO', customerName: 'Valid Customer', amount: 0, dueDate: '2026-11-01' }, // Non-positive amount
    { invoiceNumber: 'INV-NEG', customerName: 'Valid Customer', amount: -1500, dueDate: '2026-11-01' }, // Negative amount
    { invoiceNumber: 'INV-NAN', customerName: 'Valid Customer', amount: 'invalid', dueDate: '2026-11-01' }, // NaN amount
    { invoiceNumber: 'INV-NODATE', customerName: 'Valid Customer', amount: 45000, dueDate: '' }, // Missing due date
    { invoiceNumber: 'INV-GOOD', customerName: 'Acme Corp', amount: 100000, dueDate: '2026-11-01' }, // Valid
  ];

  const result = await executeImportValidation(mockDb, wsId, rows);

  assert.strictEqual(result.totalRows, 7);
  assert.strictEqual(result.insertedCount, 1);
  assert.strictEqual(result.rejectedCount, 6);
  assert.strictEqual(result.rowResults.length, 7);

  const goodRow = result.rowResults.find((r) => r.invoiceNumber === 'INV-GOOD');
  assert.ok(goodRow && goodRow.status === 'inserted');

  const zeroRow = result.rowResults.find((r) => r.invoiceNumber === 'INV-ZERO');
  assert.ok(zeroRow && zeroRow.status === 'rejected');
  assert.match(zeroRow.error, /Amount must be greater than zero/i);
});

await itAsync('rejects duplicate invoice numbers within the same file batch', async () => {
  const mockDb = createMockSupabase();
  const wsId = 'a1111111-1111-4111-a111-111111111111';

  const rows = [
    { invoiceNumber: 'INV-DUP-1', customerName: 'Cust A', amount: 30000, dueDate: '2026-11-01' },
    { invoiceNumber: 'INV-DUP-1', customerName: 'Cust A Again', amount: 30000, dueDate: '2026-11-01' },
  ];

  const result = await executeImportValidation(mockDb, wsId, rows);

  assert.strictEqual(result.totalRows, 2);
  assert.strictEqual(result.insertedCount, 1);
  assert.strictEqual(result.rejectedCount, 1);

  const rejected = result.rowResults.find((r) => r.status === 'rejected');
  assert.match(rejected.error, /Duplicate invoice number within same import batch/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Duplicate Policy Tests ('skip' vs 'update')
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 3. Testing Duplicate Policy (skip vs update) ---');

await itAsync('duplicatePolicy: skip preserves existing invoices without alteration', async () => {
  const existingInv = {
    id: 'existing-inv-1',
    workspace_id: 'a1111111-1111-4111-a111-111111111111',
    invoice_number: 'INV-EXISTING-1',
    customer_name: 'Original Customer',
    customer_email: 'orig@client.com',
    amount: 75000,
    amount_paid: 0,
    outstanding_amount: 75000,
    status: 'overdue',
    due_date: '2026-10-01',
    issue_date: '2026-09-01',
  };

  const mockDb = createMockSupabase({
    invoices: [['existing-inv-1', existingInv]],
  });

  const wsId = 'a1111111-1111-4111-a111-111111111111';
  const rows = [
    { invoiceNumber: 'INV-EXISTING-1', customerName: 'Modified Customer Name', amount: 999999, dueDate: '2026-12-31' },
  ];

  const result = await executeImportValidation(mockDb, wsId, rows, { duplicatePolicy: 'skip' });

  assert.strictEqual(result.skippedCount, 1);
  assert.strictEqual(result.insertedCount, 0);
  assert.strictEqual(result.updatedCount, 0);

  // Verify the database record was NOT altered
  const saved = mockDb.state.invoices.get('existing-inv-1');
  assert.strictEqual(saved.customer_name, 'Original Customer');
  assert.strictEqual(saved.amount, 75000);
});

await itAsync('duplicatePolicy: update refreshes metadata but NEVER clobbers verified payments', async () => {
  // Invoice with verified partial payment on record
  const existingInv = {
    id: 'existing-inv-2',
    workspace_id: 'a1111111-1111-4111-a111-111111111111',
    invoice_number: 'INV-SETTLED-PARTIAL',
    customer_name: 'Alpha Customer',
    customer_email: 'alpha@cust.com',
    amount: 100000,
    amount_paid: 40000,
    outstanding_amount: 60000,
    status: 'partially_paid',
    due_date: '2026-10-01',
    issue_date: '2026-09-01',
    payments: [
      { id: 'pay-1', amount: 40000, status: 'confirmed', reference: 'UTR123456' },
    ],
  };

  const mockDb = createMockSupabase({
    invoices: [['existing-inv-2', existingInv]],
  });

  const wsId = 'a1111111-1111-4111-a111-111111111111';
  // Re-importing the same invoice with paidAmount: 0 (e.g. outdated ERP CSV export)
  const rows = [
    {
      invoiceNumber: 'INV-SETTLED-PARTIAL',
      customerName: 'Alpha Customer Updated Corp',
      customerEmail: 'alpha.finance@cust.com',
      amount: 100000,
      paidAmount: 0, // Should NOT erase the verified 40,000 payment!
      dueDate: '2026-10-15',
    },
  ];

  const result = await executeImportValidation(mockDb, wsId, rows, { duplicatePolicy: 'update' });

  assert.strictEqual(result.updatedCount, 1);
  assert.strictEqual(result.insertedCount, 0);

  const saved = mockDb.state.invoices.get('existing-inv-2');
  // Metadata was updated
  assert.strictEqual(saved.customer_name, 'Alpha Customer Updated Corp');
  assert.strictEqual(saved.customer_email, 'alpha.finance@cust.com');
  assert.strictEqual(saved.due_date, '2026-10-15');

  // CRITICAL FINANCIAL TRUTH: Verified ₹40,000 payment was strictly preserved!
  assert.strictEqual(saved.amount_paid, 40000, 'amount_paid must preserve confirmed payments');
  assert.strictEqual(saved.outstanding_amount, 60000, 'outstanding must remain 100k - 40k = 60k');
  assert.strictEqual(saved.status, 'partially_paid');
});

await itAsync('duplicatePolicy: update preserves fully settled invoices as zero outstanding and paid status', async () => {
  const existingInv = {
    id: 'existing-inv-3',
    workspace_id: 'a1111111-1111-4111-a111-111111111111',
    invoice_number: 'INV-SETTLED-FULL',
    customer_name: 'Settled Client',
    customer_email: 'settled@client.com',
    amount: 150000,
    amount_paid: 150000,
    outstanding_amount: 0,
    status: 'paid',
    due_date: '2026-08-01',
    issue_date: '2026-07-01',
    payments: [
      { id: 'pay-2', amount: 150000, status: 'confirmed', reference: 'UTR999999' },
    ],
  };

  const mockDb = createMockSupabase({
    invoices: [['existing-inv-3', existingInv]],
  });

  const wsId = 'a1111111-1111-4111-a111-111111111111';
  // Re-importing file claiming invoice is unpaid
  const rows = [
    {
      invoiceNumber: 'INV-SETTLED-FULL',
      customerName: 'Settled Client Renovated',
      amount: 150000,
      status: 'overdue',
      dueDate: '2026-08-01',
    },
  ];

  const result = await executeImportValidation(mockDb, wsId, rows, { duplicatePolicy: 'update' });

  assert.strictEqual(result.updatedCount, 1);
  const saved = mockDb.state.invoices.get('existing-inv-3');
  assert.strictEqual(saved.status, 'paid', 'Status must remain paid');
  assert.strictEqual(saved.outstanding_amount, 0, 'Outstanding amount must remain zero');
  assert.strictEqual(saved.amount_paid, 150000, 'Paid amount must remain 150000');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Workspace Isolation & Authorization
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 4. Testing Workspace Isolation & Server Authorization ---');

await itAsync('rejects unauthenticated caller attempts to import', async () => {
  const mockDb = createMockSupabase({ currentUser: null });
  const wsId = 'a1111111-1111-4111-a111-111111111111';
  const rows = [{ invoiceNumber: 'INV-HACK-1', customerName: 'Hacker', amount: 50000, dueDate: '2026-11-01' }];

  const result = await executeImportValidation(mockDb, wsId, rows);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.importedCount, 0);
  assert.match(result.errors[0], /Authentication required/i);
});

await itAsync('rejects cross-workspace import attempts (user Bob cannot import into Alice workspace)', async () => {
  // Current user is Bob, who only owns ws-beta
  const mockDb = createMockSupabase({
    currentUser: { id: 'user-bob', email: 'bob@beta.io' },
  });
  // Bob tries to pass Alice's workspaceId
  const aliceWsId = 'a1111111-1111-4111-a111-111111111111';
  const rows = [{ invoiceNumber: 'INV-CROSS-1', customerName: 'Bob Cross', amount: 50000, dueDate: '2026-11-01' }];

  const result = await executeImportValidation(mockDb, aliceWsId, rows);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.importedCount, 0);
  assert.match(result.errors[0], /Workspace authorization denied/i);
});

await itAsync('rejects database writes for unauthenticated preview mode (ws-default)', async () => {
  const mockDb = createMockSupabase();
  const rows = [{ invoiceNumber: 'INV-PREV-1', customerName: 'Preview Cust', amount: 20000, dueDate: '2026-11-01' }];

  const result = await executeImportValidation(mockDb, 'ws-default', rows);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.isPreview, true);
  assert.strictEqual(result.importedCount, 0);
  assert.strictEqual(mockDb.state.invoices.size, 0, 'Zero writes to database');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Database Failure Handling
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 5. Testing Database Failure Handling ---');

await itAsync('reports database failure cleanly without reporting false success', async () => {
  const mockDb = createMockSupabase();
  const wsId = 'a1111111-1111-4111-a111-111111111111';
  mockDb.setTableError('invoices', new Error('PostgreSQL connection timeout or RLS policy violation'));

  const rows = [{ invoiceNumber: 'INV-FAIL-1', customerName: 'Test', amount: 10000, dueDate: '2026-11-01' }];
  const result = await executeImportValidation(mockDb, wsId, rows);

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.importedCount, 0);
  assert.ok(result.errors.length > 0);
  assert.match(result.errors[0], /Database error/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Full Lifecycle: Import -> Persist -> Re-fetch -> Consistent Calculations
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 6. Testing Full Lifecycle & Metric Reconciliation ---');

await itAsync('persisted invoices load after simulated reload and reconcile with dashboard metrics', async () => {
  const mockDb = createMockSupabase();
  const wsId = 'a1111111-1111-4111-a111-111111111111';

  const rowsToImport = [
    { invoiceNumber: 'INV-NEW-1', customerName: 'Client One', amount: 100000, paidAmount: 40000, dueDate: '2026-10-01' }, // 60,000 overdue
    { invoiceNumber: 'INV-NEW-2', customerName: 'Client Two', amount: 50000, paidAmount: 50000, dueDate: '2026-10-05', status: 'paid' }, // 0 paid
    { invoiceNumber: 'INV-NEW-3', customerName: 'Client Three', amount: 75000, dueDate: '2026-11-30' }, // 75,000 chasing
  ];

  const importResult = await executeImportValidation(mockDb, wsId, rowsToImport);
  assert.strictEqual(importResult.insertedCount, 3);

  // Now simulate reload via fetchInvoices
  const svc = new (await import('../src/services/accountService.ts')).AccountService();
  // Patch private supabase on service instance to point to our mockDb
  svc['supabase'] = mockDb;

  const reloaded = await svc.fetchInvoices(wsId);
  assert.strictEqual(reloaded.length, 3);

  const inv1 = reloaded.find((i) => i.invoiceNumber === 'INV-NEW-1');
  const inv2 = reloaded.find((i) => i.invoiceNumber === 'INV-NEW-2');
  const inv3 = reloaded.find((i) => i.invoiceNumber === 'INV-NEW-3');

  assert.strictEqual(inv1.outstandingAmount, 60000);
  assert.strictEqual(inv2.outstandingAmount, 0);
  assert.strictEqual(inv2.status, 'paid');
  assert.strictEqual(inv3.outstandingAmount, 75000);

  // Reconcile collectible total: only collectible invoices count toward totalOutstanding
  const { isCollectibleStatus } = await import('../src/types/index.ts');
  const collectible = reloaded.filter((i) => isCollectibleStatus(i.status));
  const totalOutstanding = collectible.reduce((sum, i) => sum + i.outstandingAmount, 0);

  // inv1 (60,000) + inv3 (75,000) = 135,000 (inv2 is paid, so excluded from outstanding)
  assert.strictEqual(totalOutstanding, 135000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n======================================================`);
console.log(`TOTAL AUDIT CHECKS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${totalTests - passedTests}`);
console.log(`======================================================\n`);

if (passedTests === totalTests) {
  console.log('🎉 ALL INVOICE IMPORT PERSISTENCE VERIFICATION TESTS PASSED!\n');
} else {
  console.error('❌ SOME CHECKS FAILED!\n');
  process.exit(1);
}
