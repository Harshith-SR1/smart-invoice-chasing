# FLOW-005 — Authenticated End-to-End Workflow Verification Report

**Project**: Smart Invoice Chasing  
**Repository**: `D:\solidfut\Project code files\saas`  
**Target Environment**: Live Supabase PostgreSQL (`ieejwtinqrlevgovgdmr.supabase.co`)  
**Date of Audit**: October 14, 2026  
**Status**: COMPLETE (All workflows verified; live email dispatch blocked by safety protocol)

---

## 1. Workflow Verification Matrix

| # | Workflow Step | Method | Status | Verified Invariants / Evidence |
| :---: | :--- | :---: | :---: | :--- |
| **1** | User Authentication & Workspace Creation | Live Authenticated | **PASS** | Created test accounts User A and User B via Supabase Auth Admin; authenticated via `signInWithPassword` (valid JWTs); created isolated workspaces Alpha and Beta. |
| **2** | CSV/Invoice & Customer Persistence | Live Authenticated | **PASS** | Inserted invoice `TEST-FLOW005-INV-*` (₹1,50,000) and linked customer into `public.invoices` and `public.customers`. |
| **3** | Reload & Persistence Verification | Live Authenticated | **PASS** | Authenticated query after simulated browser refresh rehydrates invoice, balance, and customer data cleanly without data loss. |
| **4** | Payment Promise Creation | Live Authenticated | **PASS** | Created promise for ₹80,000 committed on `2026-10-25`. Record saved in `public.payment_promises`, invoice status transitioned to `promised`. |
| **5** | Promise Reload & Status Rehydration | Live Authenticated | **PASS** | Persisted promise reloads with status `pending`, amount ₹80,000, and canonical quote text intact. |
| **6** | AI Decision Approval & Reload | Live Authenticated | **PASS** | Operator approved decision. Status updated to `approved` in `public.ai_decisions`; reloaded query preserves `approved` state. |
| **7** | AI Decision Dismissal & Reload | Live Authenticated | **PASS** | Operator dismissed decision. Status updated to `rejected` in `public.ai_decisions`; reloaded query preserves `rejected` state. |
| **8** | Verified Partial Payment | Live Authenticated | **PASS** | Recorded partial payment of ₹30,000. Outstanding balance decreased by exactly ₹30,000 (from ₹1,50,000 to ₹1,20,000). Payment recorded in `public.payments`. |
| **9** | Promise Non-Fulfillment on Partial Payment | Live Authenticated | **PASS** | Promise of ₹80,000 remained `pending` and was NOT prematurely fulfilled by ₹30,000 partial payment. |
| **10** | Full Settlement & Promise Fulfillment | Live Authenticated | **PASS** | Recorded final payment of ₹1,20,000. Outstanding balance became exactly ₹0, status updated to `paid`, and promise updated to `fulfilled` with `fulfilled_at`. |
| **11** | Activity Timeline Verification | Live Authenticated | **PASS** | Query on `public.collection_events` confirmed chronological timeline of `promise_detected`, `partial_payment_received`, and `payment_received`. |
| **12** | Cross-Workspace Read Isolation | Live Authenticated | **PASS** | User B querying User A's invoices, promises, decisions, payments, and events returned 0 rows (PostgreSQL RLS enforcement). |
| **13** | Cross-Workspace Write Isolation | Live Authenticated | **PASS** | User B attempting INSERT into Workspace A was rejected with PostgreSQL error `42501` (RLS violation). UPDATE and DELETE affected 0 rows. |
| **14** | Email Dispatch Sender Inspection | Configuration Audit | **PASS** | `RESEND_FROM_EMAIL` inspected. Unverified placeholder domain detected; safety gate engaged. |
| **15** | Live Email Transmission | Safety Gate | **BLOCKED** | Live email transmission was blocked per safety protocol because sender domain is an unverified placeholder (`yourdomain.com`). No unauthorized emails were sent. |
| **16** | Preview Mode (ws-default) Isolation | Automated Test | **PASS** | `ws-default` and non-UUID workspaces execute zero database writes; local state preserved with explicit demo warning notices. |

---

## 2. Evidence for Reload Persistence & Real Authorization

### 2.1 Reload Persistence Evidence
- **Invoice & Customer**:
  - Inserted invoice: `TEST-FLOW005-INV-7wfb40` (₹1,50,000) for customer `billing-7wfb40@acmetest.in`.
  - Re-queried via User A JWT: Returned exactly 1 invoice, matching UUID, status `overdue`, outstanding `150000`, customer joined properly.
- **Payment Promise**:
  - Inserted promise: `d546bcad-b61a-4aa4-b568-0726e42b5e54` for ₹80,000.
  - Re-queried via User A JWT: Returned `status: pending`, amount `80000`, quote text preserved.
- **AI Decision Overrides**:
  - Inserted decision: `6fb00721-59b6-401a-a867-426f1482deb6`.
  - Approved update $\rightarrow$ re-queried via User A JWT returned `status: approved`.
  - Dismissed update $\rightarrow$ re-queried via User A JWT returned `status: rejected`.

### 2.2 Real Cross-Workspace Authorization Evidence
Using two separate authenticated accounts:
- **User A**: `test-flow005-a-7wfb40@smartchasing.test` in Workspace Alpha (`4e52e57a-e759-48dd-a941-a70b6b501149`)
- **User B**: `test-flow005-b-7wfb40@smartchasing.test` in Workspace Beta (`8e1d3a45-074e-4cd7-a952-a3ced739cf59`)

| Target Operation by User B | Target Resource | Actual Result | Enforcement Layer |
| :--- | :--- | :--- | :--- |
| `SELECT * FROM invoices WHERE id = invoiceAId` | Alpha Invoice | **0 rows returned** | PostgreSQL RLS (`is_workspace_member`) |
| `SELECT * FROM payment_promises WHERE id = promiseAId` | Alpha Promise | **0 rows returned** | PostgreSQL RLS (`is_workspace_member`) |
| `SELECT * FROM ai_decisions WHERE id = decisionAId` | Alpha Decision | **0 rows returned** | PostgreSQL RLS (`is_workspace_member`) |
| `SELECT * FROM payments WHERE invoice_id = invoiceAId` | Alpha Payment | **0 rows returned** | PostgreSQL RLS (`is_workspace_member`) |
| `SELECT * FROM collection_events WHERE invoice_id = invoiceAId` | Alpha Timeline | **0 rows returned** | PostgreSQL RLS (`is_workspace_member`) |
| `INSERT INTO invoices (workspace_id = Alpha)` | Alpha Workspace | **Error: 42501 (Access Denied)** | PostgreSQL RLS `WITH CHECK` |
| `UPDATE invoices SET amount = 1 WHERE id = invoiceAId` | Alpha Invoice | **0 rows modified** | PostgreSQL RLS `USING` |
| `DELETE FROM invoices WHERE id = invoiceAId` | Alpha Invoice | **0 rows deleted** | PostgreSQL RLS `USING` |

---

## 3. Email Delivery Safety Status

- **Configured Sender**: `Smart Invoice Chasing <verified-sender@yourdomain.com>`
- **Domain Verification Status**: Unverified / Placeholder domain (`yourdomain.com`).
- **Resend Safety Gate**: **ENGAGED**.
- **Action Taken**: Live email transmission was **BLOCKED** and marked **NOT TESTED** in compliance with Safety Protocol 3:
  > *"Inspect the configured sender and confirm the sender domain is verified with Resend before attempting delivery... If sender verification or approval is missing, mark live delivery BLOCKED/NOT TESTED; do not bypass the gate."*
- **Delivery State Machine & Pre-conditions**: Fully validated by automated suite [scripts/verify_email_dispatch.mjs](file:///D:/solidfut/Project%20code%20files/saas/scripts/verify_email_dispatch.mjs) (23/23 passing), confirming:
  - Header injection prevention (newlines/CR stripped).
  - HTML escaping against XSS.
  - State machine progression: `draft` $\rightarrow$ `queued` $\rightarrow$ `sending` $\rightarrow$ `sent` $\rightarrow$ `delivered`.
  - Blocking dispatch for settled (`status: paid`) or zero-balance invoices.
  - Svix HMAC-SHA256 signature verification.

---

## 4. Financial Invariants Verification

| Invariant | Verified Behavior | Evidence |
| :--- | :--- | :--- |
| **Verified Reduction** | Only confirmed payments reduce balances | Verified ₹30,000 partial payment reduced balance from ₹1,50,000 to ₹1,20,000; customer payment claims do not mutate balances before verification. |
| **Non-Negative Balance** | Outstanding balance cannot become negative | `Math.max(0, amount - paid)` enforced in `markInvoicePaid` and tested with simulated overpayment. |
| **Promise Threshold** | Small partial payment does not fulfill promise | Payment of ₹30,000 against ₹80,000 promise left promise status as `pending`. |
| **Settlement Parity** | Full settlement fulfills all active promises | Final payment of ₹1,20,000 brought outstanding to ₹0 and transitioned promise to `fulfilled` with `fulfilled_at`. |
| **Empty Workspace Safety**| No fake or hardcoded metrics shown | Empty workspace queries return empty collections without fabricating revenue or mock invoices. |

---

## 5. Test Hygiene & Cleanup

All test records created during this live verification were tagged with unique identifier `7wfb40` and were completely purged upon test completion:
- Test workspaces `Alpha` and `Beta` deleted via cascading foreign keys (removing invoices, customers, promises, decisions, payments, and collection events).
- Test users `test-flow005-a-7wfb40@smartchasing.test` and `test-flow005-b-7wfb40@smartchasing.test` deleted from Supabase Auth.
- **Production Data Impact**: Zero production records were created, mutated, or deleted.

---

## 6. Complete Test Execution & Output Log

```bash
npx tsc --noEmit; node scripts/verify_audit_002.mjs; node scripts/verify_audit.mjs; node scripts/verify_email_dispatch.mjs; node scripts/verify_live_schema.mjs; node scripts/verify_workspace_isolation.mjs; node scripts/verify_data_004.mjs; node scripts/verify_live_workflow.mjs
```

### Results Summary
- `npx tsc --noEmit`: **0 errors**
- `verify_audit_002.mjs`: **28 / 28 pass**
- `verify_audit.mjs`: **22 / 22 pass**
- `verify_email_dispatch.mjs`: **23 / 23 pass**
- `verify_live_schema.mjs`: **6 / 6 pass**
- `verify_workspace_isolation.mjs`: **14 / 14 pass**
- `verify_data_004.mjs`: **23 / 23 pass**
- `verify_live_workflow.mjs`: **24 / 24 pass**

**Total Test Assertions Passed**: **140 / 140 passed cleanly**.

---

## 7. Categorized Test Separation

```
├── Automated Unit & Logic Tests (100% Pass)
│   ├── Financial metrics & aging bucket boundaries (verify_audit_002.mjs)
│   ├── CSV parsing & financial calculations (verify_audit.mjs)
│   ├── Svix HMAC verification & email sanitization (verify_email_dispatch.mjs)
│   └── Persistence parity & rollback simulation (verify_data_004.mjs)
│
├── Live Authenticated Backend Tests (100% Pass)
│   ├── Live PostgREST schema cache & tracking columns (verify_live_schema.mjs)
│   ├── Multi-role RLS isolation & membership checks (verify_workspace_isolation.mjs)
│   └── Live Supabase Auth, CRUD, reload rehydration, & RLS denial (verify_live_workflow.mjs)
│
└── Safety-Gated / Manual Checks
    └── Live Resend Email Transmission: BLOCKED (Sender domain unverified in Resend)
```

---

## 8. Bugs Found & Recommended Next Ticket

### Bugs Found & Resolved During Audit
1. **UUID Hex Validation**: Updated `UUID_REGEX` in `src/services/accountService.ts` to support all valid 32-character 8-4-4-4-12 hex UUID formats recognized by PostgreSQL.
2. **Deterministic Decision IDs**: Eliminated random `Date.now()` timestamps in `src/lib/decisionEngine.ts` to ensure stable references across re-renders and page reloads.

### Recommended Next Ticket: `EMAIL-002 — Resend Domain Verification & Live Delivery Authorization`
- **Scope**:
  1. Replace placeholder sender `verified-sender@yourdomain.com` in `.env.local` with an active, verified sender identity from the user's Resend dashboard.
  2. Configure inbound webhook URL for Resend delivery feedback (`/api/webhooks/resend`).
  3. Perform a single, operator-authorized test email transmission to a user-controlled test address.
