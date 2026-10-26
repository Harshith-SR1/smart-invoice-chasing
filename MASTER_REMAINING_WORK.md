# SMART INVOICE CHASING — MASTER REMAINING WORK
**Document Version:** 1.0.0
**Generated Date:** October 18, 2026
**Repository:** `D:\solidfut\Project code files\saas`
**Scope:** Deduplicated, Dependency-Ordered Action Backlog for Pilot & Public Launch

---

## 1. Prioritization Framework & Execution Rules

Remaining work is ranked by functional dependency order, not arbitrary section numbering:
- **P0 (Critical / Pilot Blocker):** Must be completed before deploying code or accepting real customer receivables.
- **P1 (High / Autonomous Core):** Required for autonomous operation without manual operator intervention.
- **P2 (Medium / Commercial Polish):** Required for monetization, compliance, and multi-tenant self-service.
- **P3 (Low / Enterprise Scale):** Advanced integrations, third-party ERPs, and multi-channel expansion.

---

## 2. Master Remaining Work Inventory

| ID | Priority | Task Title | Dependencies | External Cost / Provider | Can be done at ₹0? | Recommended Sequence |
| :---: | :---: | :--- | :--- | :--- | :---: | :---: |
| **REM-01** | **P0** | **Stage, Commit & Deploy Phase 1 Remediations** | None (Phase 1 verified locally) | GitHub, Vercel | **Yes (₹0)** | **1** |
| **REM-02** | **P0** | **Standalone Legal Routes & Custom 404** | Next.js App Router | None | **Yes (₹0)** | **2** |
| **REM-03** | **P0** | **Resend Custom Sending Domain Verification** | Domain DNS access | Domain Name ($10/yr if new; ₹0 if owned) | **Depends on domain** | **3** |
| **REM-04** | **P1** | **Autonomous Chasing Cadence Cron** | REM-01, Vercel Cron | Vercel Free Tier (1 cron/day) | **Yes (₹0)** | **4** |
| **REM-05** | **P1** | **Real Recovery Report PDF Generation** | Client DOM / `jspdf` | None | **Yes (₹0)** | **5** |
| **REM-06** | **P1** | **Hard Plan Limit Enforcement** | `accountService.ts`, UI | None | **Yes (₹0)** | **6** |
| **REM-07** | **P1** | **Inbound Customer Reply Webhook** | REM-03 (Custom Domain) | Resend Inbound Webhook | **Yes (₹0)** | **7** |
| **REM-08** | **P2** | **Indian TDS Deduction & Tracking Field** | Database Schema, UI | None | **Yes (₹0)** | **8** |
| **REM-09** | **P2** | **Workspace Soft-Delete & Data Privacy Cascade** | Migration 005 | None | **Yes (₹0)** | **9** |
| **REM-10** | **P2** | **Razorpay Payment Gateway Checkout Links** | Razorpay Merchant Account | Razorpay 2% transaction fee | **Yes (test mode ₹0)** | **10** |
| **REM-11** | **P2** | **Team Member Invitation Workflow** | Resend email dispatch | None | **Yes (₹0)** | **11** |
| **REM-12** | **P3** | **QuickBooks / Xero Accounting OAuth Sync** | Intuit / Xero Dev Portals | Accounting Developer Accounts | **Yes (sandbox ₹0)** | **12** |
| **REM-13** | **P3** | **WhatsApp Business Multi-Channel Dispatch** | Meta Cloud API | Meta Business Account | **Paid per conversation** | **13** |
| **REM-14** | **P3** | **Application Error Observability (Sentry)** | Sentry SDK | Sentry Free Tier | **Yes (₹0)** | **14** |

---

## 3. Detailed Task Specifications & Acceptance Criteria

### REM-01: Stage, Commit & Deploy Phase 1 Remediations
- **Priority:** P0 (Pilot Blocker)
- **Zero-Cost:** Yes (₹0)
- **Acceptance Criteria:**
  1. Working tree modifications in `route.ts`, `decisionEngine.ts`, `accountService.ts`, `AppContext.tsx`, `SettingsView.tsx`, `profile/page.tsx`, `workspace/page.tsx`, and `InvoiceDetailModal.tsx` staged and committed cleanly.
  2. Commit pushed to `origin/main` on GitHub (`Harshith-SR1/smart-invoice-chasing`).
  3. Vercel production deployment succeeds and compiles all 28 routes without errors.
  4. Verified via HTTPS GET against `https://smart-invoice-chasing.vercel.app`.

### REM-02: Standalone Legal Routes & Custom 404
- **Priority:** P0 (Pilot / Legal Blocker)
- **Zero-Cost:** Yes (₹0)
- **Acceptance Criteria:**
  1. Create `src/app/privacy/page.tsx` rendering persistent Privacy Policy compliant with Indian IT Act 2000 and DPDP Act 2023.
  2. Create `src/app/terms/page.tsx` rendering Terms of Service with limitation of liability.
  3. Create `src/app/dpa/page.tsx` rendering Data Processing Agreement.
  4. Create `src/app/not-found.tsx` rendering a branded 404 error page with navigation back to `/dashboard` or `/login`.
  5. Navigating to `/privacy`, `/terms`, or any invalid route produces clean HTTP 200/404 responses.

### REM-03: Resend Custom Sending Domain Verification
- **Priority:** P0 (Public Pilot Blocker)
- **External Dependency:** Domain Registrar DNS access (Cloudflare, Namecheap, GoDaddy, or AWS Route53).
- **Zero-Cost:** ₹0 if user already owns a domain; ~$10 if registering a new domain (e.g. `chasing.yourdomain.com`).
- **Acceptance Criteria:**
  1. Add domain to Resend dashboard.
  2. Configure DNS records: 2x TXT (DKIM), 1x MX (inbound/feedback), 1x CNAME.
  3. Resend status transitions from `Pending` to `Verified`.
  4. Update `RESEND_FROM_EMAIL` in Vercel environment variables to `Smart Invoice Chasing <chase@yourdomain.com>`.
  5. Emails successfully deliver to non-operator mailboxes (e.g. Outlook, Gmail, corporate domains).

### REM-04: Autonomous Chasing Cadence Cron
- **Priority:** P1 (Autonomy Core)
- **Zero-Cost:** Yes (₹0 on Vercel free tier)
- **Acceptance Criteria:**
  1. Create `src/app/api/cron/chase-cadence/route.ts` with `Authorization: Bearer ${CRON_SECRET}` verification.
  2. Configure cron trigger in `vercel.json`:
     ```json
     "crons": [{
       "path": "/api/cron/chase-cadence",
       "schedule": "0 9 * * 1-5"
     }]
     ```
  3. Daily 9:00 AM job scans active workspaces, checks automation settings, evaluates eligible overdue invoices, and queues approved reminder dispatches.
  4. Prevents duplicate sends on the same day for the same invoice.

### REM-05: Real Recovery Report PDF Generation
- **Priority:** P1 (Product Trust)
- **Zero-Cost:** Yes (₹0)
- **Acceptance Criteria:**
  1. Replace simulated toast in `src/components/reports/RecoveryReportsView.tsx` with client-side PDF export (using lightweight library like `jspdf` or HTML canvas print).
  2. Export includes monthly recovered total, outstanding balance, unrecovered accounts table, and AI executive summary.
  3. File downloads as `Smart_Invoice_Recovery_Report_[Month]_[Year].pdf`.

### REM-06: Hard Plan Limit Enforcement
- **Priority:** P1 (Monetization & Invariant Protection)
- **Zero-Cost:** Yes (₹0)
- **Acceptance Criteria:**
  1. In `accountService.ts` (`importInvoices` and manual invoice creation), query active non-paid invoice count for the workspace.
  2. If count + new invoices > plan limit (e.g. 10 on Free, 100 on Early Access), reject with `errorCode: 'plan_limit_exceeded'`.
  3. Show upgrade modal in UI directing user to `/billing`.

### REM-07: Inbound Customer Reply Ingestion Webhook
- **Priority:** P1 (AI Intelligence)
- **Zero-Cost:** Yes (₹0)
- **Acceptance Criteria:**
  1. Configure Resend inbound email routing to `POST /api/webhooks/resend-inbound`.
  2. Extract sender email, subject, text body, and match against `public.invoices` via recipient or invoice number in subject/body.
  3. Store reply in `public.collection_events` (`action: 'customer_reply'`).
  4. Classify intent (e.g. Promise, Dispute, Query, Paid Claim) and update invoice `last_reply_intent`.

### REM-08: Indian TDS Deduction & Tracking Field
- **Priority:** P2 (Indian Commercial Realities)
- **Zero-Cost:** Yes (₹0)
- **Acceptance Criteria:**
  1. Add `tds_deducted_amount` (NUMERIC) and `tds_rate` (NUMERIC) fields to `invoices` table.
  2. In `MarkAsPaidModal.tsx`, provide checkbox: *"Customer deducted TDS (e.g. 1% / 2% / 10%)"*.
  3. If selected, ledger balance settles without treating the TDS deduction as a delinquent shortfall.
  4. Flag pending TDS certificate request in customer communication.

### REM-09: Workspace Soft-Delete & Data Privacy Cascade
- **Priority:** P2 (Compliance & Self-Service)
- **Zero-Cost:** Yes (₹0)
- **Acceptance Criteria:**
  1. Apply Migration 005 adding `deleted_at` timestamp to `workspaces`, `invoices`, `customers`.
  2. Create atomic RPC `soft_delete_workspace(p_workspace_id UUID)`.
  3. Wire "Delete Account" button in `src/app/profile/page.tsx` to call the RPC and sign out.

---

## 4. Recommended Next Action

The single best next action is **REM-01: Stage, Commit & Push Phase 1 Remediations**, followed immediately by **REM-02: Standalone Legal Routes & Custom 404**. This locks in the verified core fixes, publishes them to production Vercel, and resolves the missing route defects at ₹0 cost.
