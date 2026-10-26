# SMART INVOICE CHASING — AUDIT DISCREPANCIES & UNRESOLVED QUESTIONS
**Document Version:** 1.0.0
**Generated Date:** October 18, 2026
**Repository:** `D:\solidfut\Project code files\saas`
**Purpose:** Record of Contradictions, Unverified Claims, Missing Documents, and User Decisions

---

## 1. Contradictory Reports & State Discrepancies

### 1.1 Git Commit & Working Tree Discrepancy
- **Prior Report Statement:** `COMPLETE_PROJECT_AUDIT.md` (line 7) recorded HEAD commit as `4c4e0de3b49704e6c92fa397f3750059b0ae8080`.
- **Actual Repository State:**
  - Actual HEAD commit is `cb7e43a2cca3aae0476676d2a04b36cb824c8213` (*"feat(auth): harden full-name, phone E.164, email validation, and OTP verification flow"*).
  - The working tree currently contains 9 modified files (`route.ts`, `profile/page.tsx`, `workspace/page.tsx`, `InvoiceDetailModal.tsx`, `SettingsView.tsx`, `AppContext.tsx`, `decisionEngine.ts`, `accountService.ts`, `types/index.ts`) and 2 untracked files (`MASTER_CHECKLIST.md`, `scripts/verify_phase_1.mjs`).
- **Explanation:** Commit `cb7e43a` was committed and pushed during the `AUTH-VALIDATION-001` session. The Phase 1 remediations were subsequently implemented in the working tree, but per strict change control, they have intentionally **not** been staged, committed, pushed, or deployed.

### 1.2 "Production Deployment Verified" vs. Current Working Tree
- **Prior Report Statement:** Reports `DEPLOY-003_REPORT.md` and `TRACKING-001_REPORT.md` mark production deployment as "PASS — PRODUCTION DEPLOYMENT & LIVE WEBHOOK AUTHENTICATED".
- **Actual Reality:** Vercel auto-deployed from GitHub commit `cb7e43a`. The production deployment running at `https://smart-invoice-chasing.vercel.app` is healthy, but it **does not contain the Phase 1 remediations** (which exist only in the local unstaged working tree). Claiming that Phase 1 fixes are "live in production" is factually incorrect until they are committed and pushed.

---

## 2. Claims That Cannot Be Verified / Simulated UI Features

The following features are presented in the user interface but are actually simulated:

### 2.1 PDF Report Export (`/recovery-reports`)
- **UI Claim:** "Download PDF Report" button in `RecoveryReportsView.tsx`.
- **Actual Code:**
  ```typescript
  const handleExportPDF = () => {
    showToast('Exporting Recovery Audit Report as PDF...', 'info');
    setTimeout(() => {
      showToast(`Downloaded ${reportSummary.month}_Recovery_Report.pdf!`, 'success');
    }, 1000);
  };
  ```
- **Finding:** No PDF generation engine (e.g. `jspdf`, `pdfmake`, or serverless Puppeteer) is installed or wired. Clicking the button shows a toast notification without generating or downloading any file. (CSV export, by contrast, is fully operational and downloads real data).

### 2.2 Subscription Management & Billing Receipts (`/billing`)
- **UI Claim:** "Manage Subscription" button and "Download Receipt" buttons in `BillingPage.tsx`.
- **Actual Code:**
  ```typescript
  showToast('Subscription billing gateway portal ready for connection.', 'info');
  showToast(`PDF invoice generator backend ready. Downloaded receipt ${invNumber}.pdf!`, 'success');
  ```
- **Finding:** No payment gateway (Razorpay or Stripe) customer portal is integrated. Billing history displays hardcoded mock invoices (`INV-2026-003`, `INV-2026-002`, `INV-2026-001`).

### 2.3 Hard Plan Limit Enforcement
- **UI Claim:** Usage meters display `Active Invoices: X / 100` on the Early Access tier.
- **Actual Code:** `accountService.ts` (`importInvoices` and manual invoice insertion) contains no threshold validation checking active invoice count against plan limits.
- **Finding:** A user on the Free or Early Access tier can import 5,000 invoices without being blocked by the application.

### 2.4 Standalone Legal URLs (`/privacy`, `/terms`)
- **UI Claim:** Landing page footer links to "Privacy Policy" and "Terms of Service".
- **Actual Code:** These trigger an in-page modal dialog (`PolicyModal.tsx`).
- **Finding:** If an external user, auditor, or payment gateway compliance officer navigates directly to `https://smart-invoice-chasing.vercel.app/privacy` or `/terms`, Next.js returns an unbranded HTTP 404 error page.

### 2.5 Integrations Catalog
- **UI Claim:** 8 integrations listed in `IntegrationsView.tsx` (CSV, Email, Accounting, Payment Gateway, WhatsApp, Verification, CRM, Developer API).
- **Actual Code:** Only CSV import and Email (Resend) are connected. The remaining 6 cards are marked "Planned" and trigger informational toast messages.

---

## 3. Missing Source Documents

Per audit requirements, the filesystem was searched for all named source documents. The following documents are **unavailable as standalone files** in the project repository:

| Document Name | File Status | Notes / Location of Partial Information |
| :--- | :---: | :--- |
| **Claude's competitive research and product review report** | **UNAVAILABLE** | Not present as a standalone file on disk. Context inferred from audit discussions. |
| **Product Requirements Document (PRD)** | **UNAVAILABLE** | Not present as a standalone file. Partial requirements captured in `COMPLETE_PROJECT_AUDIT.md`. |
| **Technical architecture document** | **UNAVAILABLE** | Architectural overview partially documented in `walkthrough.md` and `COMPLETE_PROJECT_AUDIT.md`. |
| **Security and access-control specification** | **UNAVAILABLE** | RLS policies documented in SQL migrations and `COMPLETE_PROJECT_AUDIT.md`. |
| **Frontend/UI specification** | **UNAVAILABLE** | Component designs exist in code; no standalone spec file. |
| **Feature ticket list** | **UNAVAILABLE** | Tickets like `EMAIL-001`, `CLM-002`, `AUTH-VALIDATION-001` referenced across reports; no master ticket document. |
| **Complete product strategy document** | **UNAVAILABLE** | Product strategy and Indian context referenced in audit reports; no standalone document. |
| **Zero-rupee build plan** | **UNAVAILABLE** | Architecture adheres to ₹0 principles; no standalone plan file on disk. |
| **Latest DATA & COLLECTIONS AUDIT REPORT** | **UNAVAILABLE** | Delivered in prompt context; partially captured in `COMPLETE_PROJECT_AUDIT.md`. |
| **AUTH-VALIDATION-001 report** | **UNAVAILABLE** | Delivered in prior conversation turn; verified in `scripts/verify_auth_validation.mjs`. |

---

## 4. Live Tests Still Required Before General Public Launch

1. **Live External Domain Email Delivery Test:**
   - Must verify that emails can deliver to non-registered external mailboxes (Gmail, Outlook, corporate domains) once a custom domain is verified in Resend.
2. **Inbound Reply Parsing Test:**
   - Live test verifying that when a customer hits "Reply" on a collection email, the response is parsed, stored in `collection_events`, and classified by intent.
3. **Mobile Viewport Cross-Browser Audit:**
   - Verify all modal dialogs (`InvoiceDetailModal`, `AiMessageReviewModal`, `ImportModal`) render cleanly on physical iOS Safari and Android Chrome screens (375px–420px width).
4. **Concurrent Multi-User Stress Test:**
   - Validate Supabase transaction limits and rate limiter concurrency under multiple simultaneous active workspace sessions.

---

## 5. Decisions Requiring User Clarification

1. **Custom Sending Domain for Resend:**
   - *Question:* Which custom domain or subdomain (e.g., `chasing.yourdomain.com` or `mail.yourdomain.com`) should be registered in Resend DNS to remove the sandbox restriction?
2. **Payment Gateway Selection:**
   - *Question:* For monetizing Smart Invoice Chasing, should the primary payment gateway integration be **Razorpay** (standard for Indian B2B SaaS with UPI/cards/netbanking support) or **Stripe**?
3. **Multi-Channel Priority (WhatsApp vs. Email):**
   - *Question:* For the Indian market, should WhatsApp Business API integration be prioritized in Phase 2, or should the pilot remain email-first with assisted phone calls?
4. **Database Migration 005 (Soft-Delete & GDPR):**
   - *Question:* Should migration 005 (soft delete and workspace cascade) be applied in the next batch to enable real account deletion?
