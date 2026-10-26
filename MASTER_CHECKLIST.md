# SMART INVOICE CHASING — MASTER CHECKLIST & CONTROL REGISTER
**Document Version:** 1.0.0
**Repository:** `D:\solidfut\Project code files\saas`
**Base Commit:** `cb7e43a`
**Target Architecture:** Next.js 16 (App Router) + React 19 + Supabase PostgreSQL (19 Tables + RLS) + Resend Email

---

## 1. Authentication & Workspace Lifecycle

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 1.1 | Email & password signup with Supabase Auth | **Verified Complete** | Live Supabase Auth + `verify_auth_flow.mjs` (68/68 pass) | None | Complete |
| 1.2 | Real 6-digit numeric OTP email verification screen | **Verified Complete** | Unit & DOM verification (`verify_auth_validation.mjs` 91/91 pass) | **External Blocker: Resend Sandbox domain (`resend.dev`) only delivers to owner (`hh5959287@gmail.com`).** | Verify custom DNS domain in Resend for arbitrary recipient delivery. |
| 1.3 | 60-second cooldown timer & resend rate-limiting | **Verified Complete** | Unit & Flow (`verify_auth_flow.mjs`) | None | Complete |
| 1.4 | Unconfirmed user recovery & invalid OTP error alerts | **Verified Complete** | Live Supabase rejection + Unit (`verify_auth_validation.mjs`) | None | Complete |
| 1.5 | Prototype login bypass elimination (fail-closed auth) | **Verified Complete** | Live Supabase session test (`verify_auth_flow.mjs`) | None | Complete |
| 1.6 | Google OAuth sign-in & canonical production callback | **Verified Complete** | `verify_auth_redirect.mjs` (20/20 pass) canonical URL enforcement | Requires Google Cloud OAuth consent verification for public accounts | Add legal `/terms` and `/privacy` standalone URLs. |
| 1.7 | Idempotent default workspace & profile provisioning | **Verified Complete** | DB Integration (`workspaceProvisioning.ts` + `verify_auth_flow.mjs`) | None | Complete |
| 1.8 | Full-name validation (Unicode \p{L}\p{M}, length 2–70, reject numbers/symbols) | **Verified Complete** | Client & Server (`verify_auth_validation.mjs` 91/91 pass) | None | Complete |
| 1.9 | Phone number validation (libphonenumber-js, E.164 normalization, India & Intl) | **Verified Complete** | Client & Server (`verify_auth_validation.mjs` 91/91 pass) | None | Complete |
| 1.10| RFC 5322 Email syntax validation on client & server | **Verified Complete** | Client & Server (`verify_auth_validation.mjs` 91/91 pass) | None | Complete |

---

## 2. Dashboard

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 2.1 | Total outstanding, total recovered, and overdue balance metrics | **Verified Complete** | Derived from active invoices (`verify_audit_002.mjs` 28/28 pass) | None | Complete |
| 2.2 | "What Should I Chase Today?" priority ranking | **Verified Complete** | Evaluated deterministically from overdue days & broken promises | None | Complete |
| 2.3 | Cash flow forecasting based on payment promises | **Verified Complete** | `PaymentPromise` aggregation across active commitments | None | Complete |
| 2.4 | Collection pipeline summary cards (Promisers, Disputers, Ghosters) | **Verified Complete** | Dynamic filtering by collection categories | None | Complete |
| 2.5 | 6-bucket aging breakdown on dashboard | **Verified Complete** | Dynamic reconciliation to total outstanding balance | None | Complete |
| 2.6 | Prevention of initial mock-data flash during rehydration | **Phase 1 Remediation** | Fixed in Phase 1 (`AppContext.tsx` `isLoading` flag) | Dependent on Phase 1 update | Verify with `verify_phase_1.mjs`. |
| 2.7 | Empty-workspace state handling on dashboard | **Phase 1 Remediation** | Fixed in Phase 1 (displays 0s without flashing seed accounts) | None | Verify with `verify_phase_1.mjs`. |

---

## 3. Invoices and Import

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 3.1 | Multi-format CSV / XLSX / XLS import parser | **Verified Complete** | `invoiceParser.ts` (`verify_audit.mjs` 22/22 pass) | None | Complete |
| 3.2 | Header alias normalization (`inv_no`, `amount`, `due date`, etc.) | **Verified Complete** | `invoiceParser.ts` unit tests | None | Complete |
| 3.3 | Duplicate policy handling (`skip` vs `update`) | **Verified Complete** | `handleImportData` policy enforcement | None | Complete |
| 3.4 | Import plan limits enforcement (Free 10, Early Access 100) | **Incomplete** | Plan limits not checked during CSV parse | Dependent on Section 9 | Wire plan checks in `ImportModal.tsx`. |
| 3.5 | Manual direct payment recording & DB persistence | **Phase 1 Remediation** | Fixed in Phase 1 (`accountService.recordDirectPayment`) | None | Verify with `verify_phase_1.mjs`. |
| 3.6 | Exact currency precision validation & overpayment rejection | **Verified Complete** | Live Supabase RPC + unit (`verify_production_gate.mjs`) | Migration 004 active in DB | Complete |
| 3.7 | Imported invoice AI decision synchronization to DB | **Phase 1 Remediation** | Fixed in Phase 1 (`syncDecisions` in `handleImportData`) | None | Verify with `verify_phase_1.mjs`. |
| 3.8 | Invoices table search, pagination, and multi-filter | **Verified Complete** | Manual UI verification in `InvoicesLedgerView.tsx` | None | Complete |

---

## 4. Collections & Messaging

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 4.1 | Exception-based collections pipeline (Promisers, Disputers, Ghosters) | **Verified Complete** | `CollectionsHub.tsx` exception routing | None | Complete |
| 4.2 | Atomic server-side email dispatch (`POST /api/messages/send`) | **Verified Complete** | `verify_email_dispatch.mjs` (23/23 pass) | None | Complete |
| 4.3 | Outbound dispatch guards (paid, disputed, cancelled, void, held, claims) | **Phase 1 Remediation** | Fixed in Phase 1 (`/api/messages/send/route.ts`) | None | Verify with `verify_phase_1.mjs`. |
| 4.4 | Rate limiting on dispatch (10 dispatches/min per workspace) | **Verified Complete** | `verify_rate_limiter.mjs` (25/25 pass) | None | Complete |
| 4.5 | Svix webhook verification & replay attack prevention | **Verified Complete** | `verify_email_dispatch.mjs` + `verify_staging_readiness.mjs` | None | Complete |
| 4.6 | Individual and bulk resume-collection DB persistence | **Phase 1 Remediation** | Fixed in Phase 1 (`accountService.resumeInvoiceCollection`) | None | Verify with `verify_phase_1.mjs`. |
| 4.7 | Scheduled reminder cadence automation (Cron) | **Incomplete / Planned** | No cron endpoint configured in `vercel.json` | Requires Next.js cron route `/api/cron/evaluate-cadence` | Phase 2 implementation. |
| 4.8 | Inbound customer reply ingestion & intent parsing | **Incomplete / Planned** | Resend delivery-only webhooks configured; no inbound MX parser | Requires Resend Inbound webhook | Phase 2 implementation. |

---

## 5. Customers & Behavioral Memory

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 5.1 | Customer directory with turnaround delay metrics | **Verified Complete** | `CustomerDirectoryView.tsx` | None | Complete |
| 5.2 | Behavioral archetypes (Prompt Payer, Chronic Late Payer, etc.) | **Verified Complete** | `customerMemory.ts` evaluation rules | None | Complete |
| 5.3 | Typical payment blocker tracking (Signoff, PO matching) | **Verified Complete** | Persisted in customer entity metadata | None | Complete |
| 5.4 | Preferred communication channel routing | **Verified Complete** | `customer.preferredChannel` integration | None | Complete |
| 5.5 | Promise reliability calculation (% fulfilled vs detected) | **Verified Complete** | Derived from `PaymentPromise` history | None | Complete |

---

## 6. AI Decisions & AI Coach

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 6.1 | Deterministic rule evaluation (`STOP`, `HUMAN`, `WAIT`, `FOLLOW_UP`, `NUDGE`, `ESCALATE`) | **Verified Complete** | `verify_audit_002.mjs` (28/28 pass) | None | Complete |
| 6.2 | Safe handling of ineligible invoice states (cancelled, void, held) | **Phase 1 Remediation** | Fixed in Phase 1 (`decisionEngine.ts` branches) | None | Verify with `verify_phase_1.mjs`. |
| 6.3 | Evidence-grounded reasons (zero generative hallucination) | **Verified Complete** | Structured template variables (`customerName`, `amount`, `dueDate`) | None | Complete |
| 6.4 | Operator decision lifecycle (Pending, Approved, Executed, Dismissed) | **Verified Complete** | DB Integration (`verify_data_004.mjs` 23/23 pass) | None | Complete |
| 6.5 | Execution persistence to `ai_decisions`, `invoices`, and `collection_events` | **Verified Complete** | `accountService.executeDecision` compensating rollback | None | Complete |
| 6.6 | "Why Isn't This Invoice Paid?" diagnostic card | **Verified Complete** | `getWhyUnpaidDiagnosis` in `InvoiceDetailModal.tsx` | None | Complete |

---

## 7. Integrations

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 7.1 | CSV & Excel Spreadsheet Import | **Verified Complete** | Functional in UI & validated via `verify_audit.mjs` | None | Complete |
| 7.2 | Resend Email API & Webhook Tracking | **Implemented (Blocked for external emails)** | Functional for account owner (`hh5959287@gmail.com`) | **External Blocker: Resend domain verification** | Verify DNS records in Resend dashboard. |
| 7.3 | Accounting ERP (Tally, Zoho Books, QuickBooks) | **Planned (Catalog UI)** | Integration modal stub with connection status | Requires third-party OAuth apps | Phase 3 implementation. |
| 7.4 | Payment Gateways (Razorpay, Stripe) | **Planned (Catalog UI)** | Integration modal stub | Requires gateway API keys & webhooks | Phase 3 implementation. |
| 7.5 | WhatsApp Business Cloud API | **Planned (Catalog UI)** | Integration modal stub | Requires Meta Business verification | Phase 3 implementation. |
| 7.6 | Automated Bank Feed Verification | **Planned (Catalog UI)** | Integration modal stub | Requires Open Banking / Account Aggregator API | Phase 3 implementation. |

---

## 8. Settings & Business Profile

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 8.1 | AI automation rules & cadence persistence (`public.ai_settings`) | **Phase 1 Remediation** | Fixed in Phase 1 (`accountService.saveAutomationRules`) | None | Verify with `verify_phase_1.mjs`. |
| 8.2 | Workspace business identity persistence (`public.workspaces`) | **Phase 1 Remediation** | Fixed in Phase 1 (`accountService.updateWorkspace`) | None | Verify with `verify_phase_1.mjs`. |
| 8.3 | User personal profile persistence (`public.profiles`) | **Phase 1 Remediation** | Fixed in Phase 1 (`accountService.updateProfile`) | None | Verify with `verify_phase_1.mjs`. |
| 8.4 | Notification preference toggles | **Phase 1 Remediation** | Fixed in Phase 1 (`notification_preferences` DB sync) | None | Verify with `verify_phase_1.mjs`. |
| 8.5 | Currency & timezone configuration | **Phase 1 Remediation** | Fixed in Phase 1 (`workspaces` table update) | None | Verify with `verify_phase_1.mjs`. |

---

## 9. Plans, Pricing & Billing

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 9.1 | Consistent pricing tiers: Free (₹0), Early Access (₹999), Growth (₹2,499) | **Verified Complete** | `verify_audit_002.mjs` consistency check | None | Complete |
| 9.2 | Query active subscription from `public.subscriptions` | **Incomplete** | `BillingPage.tsx` uses hardcoded Early Access mock | Requires DB query in `loadData()` | Phase 3 implementation. |
| 9.3 | Query billing history from `public.billing_invoices` | **Incomplete** | `BillingPage.tsx` displays static mock invoice rows | Requires DB query in `loadData()` | Phase 3 implementation. |
| 9.4 | Enforce workspace plan limits on invoice import | **Incomplete** | `handleImportData` permits unlimited imports | Requires subscription tier check | Phase 3 implementation. |
| 9.5 | Payment gateway checkout for plan upgrades | **Planned** | UI buttons trigger simulated toasts | Requires Razorpay/Stripe checkout session | Phase 3 implementation. |

---

## 10. Reports, Aging & Risk

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 10.1| 6-Bucket aging matrix (Current, 1-15, 16-30, 31-60, 61-90, 90+) | **Verified Complete** | Reconciled exactly to outstanding receivables (`verify_audit_002.mjs`) | None | Complete |
| 10.2| Payment risk matrix & capital at risk scoring | **Verified Complete** | Dynamic aggregation across overdue intervals | None | Complete |
| 10.3| Dynamic Recovery Reports summary (eliminates August 2026 mock data) | **Verified Complete** | `buildRecoveryReportSummary` dynamic derivation | None | Complete |
| 10.4| Dynamic CSV report export | **Verified Complete** | Real browser Blob download with unrecovered accounts | None | Complete |
| 10.5| Client-side PDF report export | **Incomplete / Simulated** | "Download PDF Report" triggers timeout toast | Requires `jspdf` or HTML canvas rendering | Phase 3 implementation. |

---

## 11. Security, Legal & Reliability

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 11.1| PostgreSQL Row-Level Security (RLS) on all 19 tables | **Verified Complete** | Live Supabase cache verification (`verify_live_schema.mjs`) | None | Complete |
| 11.2| Anonymous access revoked from business tables | **Verified Complete** | Live PostgREST queries fail with 0 rows / 401 | None | Complete |
| 11.3| Zero secret leaks in client JavaScript bundles | **Verified Complete** | `validate_env.mjs` (7/7 checks pass) | None | Complete |
| 11.4| Distributed sliding-window rate limiting (10 dispatches/min) | **Verified Complete** | `verify_rate_limiter.mjs` (25/25 pass) | None | Complete |
| 11.5| Standalone legal routes (`/terms` & `/privacy`) | **Incomplete** | Currently modals with brackets; `/terms` returns 404 | Missing `src/app/terms/page.tsx` & `src/app/privacy/page.tsx` | Phase 2 implementation. |
| 11.6| Custom branded 404 page (`src/app/not-found.tsx`) | **Incomplete** | Missing `not-found.tsx` | Returns default Next.js error page | Phase 2 implementation. |
| 11.7| Real account deletion backend handler | **Incomplete** | Modal confirmation triggers local toast | Requires Supabase Auth Admin RPC | Phase 2 implementation. |
| 11.8| Point-in-time recovery & automated backups | **Implemented** | Supabase managed PostgreSQL daily backups | Cloud infrastructure managed | Complete |

---

## 12. Final Launch Validation

| # | Checklist Item | Status | Verification Type & Evidence | Dependencies & Blockers | Next Action Needed |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 12.1| Clean strict TypeScript compilation (`npx tsc --noEmit`) | **Verified Complete** | 0 errors | None | Maintain zero lints |
| 12.2| Production Next.js build compilation (`npm run build`) | **Verified Complete** | 28/28 routes compiled cleanly in 11.6s | None | Complete |
| 12.3| Production Vercel deployment health | **Verified Complete** | `https://smart-invoice-chasing.vercel.app` returns HTTP 200 | None | Complete |
| 12.4| External domain verification in Resend | **Blocked (External)** | Outbound sender is `onboarding@resend.dev` | **External Blocker: Customer domain DNS (DKIM/SPF)** | Add custom domain in Resend dashboard. |
| 12.5| Full mobile viewport responsiveness check | **Implemented** | Tailwind responsive grids & mobile drawer | Manual QA | Final QA sweep. |
