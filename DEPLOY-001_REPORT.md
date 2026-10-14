# DEPLOY-001 — Secure Staging Deployment Preparation Report

**Project:** Smart Invoice Chasing  
**Repository:** `D:\solidfut\Project code files\saas`  
**Execution Timestamp:** 2026-10-14T10:00:00Z (UTC) / 2026-10-14T15:30:00+05:30 (IST)  
**Status:** **READY FOR OPERATOR DEPLOYMENT**  

---

## 1. Executive Summary

Smart Invoice Chasing has been inspected, hardened, and verified for staging deployment.
- **Production Build:** Next.js 16.3.4 (Turbopack) production build passed cleanly (`28/28` routes generated).
- **Security Boundaries:** Zero server credentials (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`) are imported by client components or exposed via `NEXT_PUBLIC_` prefixes.
- **Local Secret Isolation:** `.env.local` is protected by `.gitignore` and has never been committed.
- **Database & RLS:** All 19 required tables, email tracking columns, and workspace-isolation RLS policies are verified on the live Supabase project (`ieejwtinqrlevgovgdmr.supabase.co`).
- **Email Pipeline:** Server-side dispatch via Resend is verified with a live provider test (`01a139c6-5a2f-7d3c-a0ab-5cfb98d97b92`); placeholder domains are strictly rejected.
- **Webhook Invariants:** Svix HMAC-SHA256 signature verification, replay defenses (>5 min), idempotency (PostgreSQL `23505`), and invoice balance immutability are verified by automated test suites.
- **Automated Verification:** 110 regression assertions and 11 staging readiness assertions passed with 0 failures; TypeScript compilation passed with 0 errors.

---

## 2. Recommended Deployment Platform & Cost Analysis

### Recommended Platform: **Vercel**

For a Next.js 16 App Router application utilizing React 19, server route handlers (`/api/messages/send`, `/api/webhooks/resend`), and auth middleware, **Vercel** is the simplest and most native deployment platform.

#### Why Vercel?
1. **Zero Configuration for Next.js 16:** Native Turbopack compilation and edge routing without custom Dockerfiles or reverse proxy configuration.
2. **Instant HTTPS:** Automatic SSL certificates on `*.vercel.app` staging subdomains and custom domains, satisfying Resend’s strict requirement for public HTTPS webhook URLs.
3. **Branch Previews & Staging:** Automatically provisions isolated preview URLs for pull requests, enabling safe staging verification before merging to production.
4. **Environment Isolation:** Cleanly partitions Environment Variables between `Development`, `Preview` (Staging), and `Production`.

#### Cost & Free-Tier Limits Matrix

| Service | Tier | Monthly Cost | Included Free Quotas | Potential Limit / Overage Risks |
| :--- | :--- | :---: | :--- | :--- |
| **Vercel** | Hobby (Free) | **$0** | • 100 GB Bandwidth / mo<br>• 100 GB-Hrs Serverless Execution<br>• Edge Middleware execution included<br>• Automated HTTPS & custom domains | • Commercial usage policy (Pro is $20/user/mo if used by a registered commercial business)<br>• Max serverless execution timeout: 15s (Hobby) / 60s (Pro). Resend API and Supabase queries execute in <1s. |
| **Supabase** | Free Tier (Active Project) | **$0** | • 500 MB Database Storage<br>• 50,000 Monthly Active Users<br>• Unlimited PostgREST API requests<br>• Built-in Auth & RLS engine | • **Project Inactivity Pausing:** Free tier projects pause if inactive for 7 consecutive days. (Supabase Pro is $25/mo for 0 pausing and 8 GB storage). |
| **Resend** | Free Tier | **$0** | • 3,000 emails / month<br>• 100 emails / day<br>• 1 custom sending domain<br>• Svix webhook delivery included | • Daily sending cap of 100 emails on free tier. (Pro plan is $20/mo for 50,000 emails/month). |

**Total Estimated Staging Cost:** **$0.00 / month** using free-tier quotas.

---

## 3. Environment Variable Specification

To prevent credential leaks, environment variables are partitioned into two strict scopes:

### A. Public / Browser Variables (Safe for client bundles)
*These variables are prefixed with `NEXT_PUBLIC_` and will be exposed in browser JavaScript bundles.*

| Variable Name | Required | Description | Sample / Format |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project endpoint. | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | PostgREST public client key. Governed by PostgreSQL RLS. | Standard JWT format (`eyJ...`) |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | Canonical URL for auth redirects and email callbacks. | `https://your-staging.vercel.app` |

### B. Private Server-Only Secrets (NEVER exposed to the browser)
*CRITICAL: Do NOT prefix these variables with `NEXT_PUBLIC_`. In Vercel, assign them to Serverless Functions only.*

| Variable Name | Required | Description | Purpose & Security Controls |
| :--- | :---: | :--- | :--- |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Elevated database service key. | Used exclusively in `/api/messages/send` and `/api/webhooks/resend`. Bypasses RLS to insert webhook logs and update message delivery status. |
| `RESEND_API_KEY` | **Yes** | Outbound email API key. | Used exclusively in server-side dispatch. Least-privilege key (`restricted_api_key`) restricted to sending only. |
| `RESEND_FROM_EMAIL` | **Yes** | RFC 5322 From header identity. | Must match a verified domain or Resend sandbox (`Smart Invoice Chasing <onboarding@resend.dev>`). |
| `RESEND_WEBHOOK_SECRET` | **Yes (Post-deploy)** | Svix signing secret (`whsec_...`). | Provided by Resend dashboard after registering the live staging webhook URL. Endpoint safely returns HTTP 503 if omitted. |

---

## 4. Security Verification & Architecture Controls

### 1. Browser Exposure Protection
- Checked the full `src/` codebase: Zero Client Components (`'use client'`) import `src/lib/supabase/service.ts` or reference `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, or `RESEND_WEBHOOK_SECRET`.
- Validated `src/lib/envValidator.ts`: Detects and flags any attempt to prefix private keys with `NEXT_PUBLIC_` as a critical build failure.
- Checked `.gitignore`: Explicitly ignores `.env*` and `.env.local` to prevent git tracking.

### 2. Authentication & Redirects
- **Middleware Guard (`src/middleware.ts`):** 
  - Validates user session cookies on all routes.
  - Returns `401 Unauthorized` for unauthenticated `/api/*` calls.
  - Redirects unauthenticated page requests to `/login?next=<path>`.
  - Redirects authenticated users from `/login` or `/signup` to `/dashboard`.
  - **Explicit Exemption:** Public route whitelist allows `/api/webhooks/*` so Resend/Svix can deliver webhooks without a session cookie.
- **Auth Callback Handler (`src/app/auth/callback/route.ts`):**
  - Securely exchanges OAuth/magic-link authorization codes for sessions.
  - Idempotently creates user profiles, default workspaces, and free tier subscriptions.
  - Sanitizes destination redirects to prevent open-redirect vulnerabilities.

### 3. Server-Side Email Dispatch (`src/app/api/messages/send/route.ts`)
- Client requests provide only `message_row_id`. Recipients, subject, and content are reloaded server-side from canonical database records.
- Cross-workspace validation enforces that the authenticated user belongs to the invoice's workspace.
- Collection state guards reject dispatch if the invoice is already settled (`status === 'paid'`) or disputed.
- Atomic state transition (`queued → sending`) prevents double-send race conditions.

---

## 5. Prerender Fix Applied During Staging Preparation

During production compilation (`npm run build`), Next.js 16 flagged a CSR bailout requirement:
```
⨯ useSearchParams() should be wrapped in a suspense boundary at page "/settings".
```
**Fix Implemented:**
- In [src/components/settings/SettingsView.tsx](file:///D:/solidfut/Project%20code%20files/saas/src/components/settings/SettingsView.tsx), wrapped the inner component in a `<Suspense fallback={<div className="p-8 text-slate-400">Loading settings...</div>}>` boundary.
- In [src/app/settings/page.tsx](file:///D:/solidfut/Project%20code%20files/saas/src/app/settings/page.tsx), added `<Suspense>` wrapper around `<SettingsView />`.
- Verified subsequent build: `npm run build` compiled all 28 static and dynamic routes cleanly with exit code 0.

---

## 6. Public HTTPS Webhook Configuration (Post-Deployment Setup)

Once the application is deployed to staging, configure the Resend webhook:

### Step 1: Identify Public Webhook Endpoint
- **Staging URL:** `https://<your-project-name>.vercel.app`
- **Webhook Endpoint:** `https://<your-project-name>.vercel.app/api/webhooks/resend`

### Step 2: Resend Dashboard Configuration
1. Log in to [resend.com/webhooks](https://resend.com/webhooks).
2. Click **Add Webhook**.
3. Set **Endpoint URL** to: `https://<your-project-name>.vercel.app/api/webhooks/resend`
4. Select the required event subscriptions:
   - `email.sent`
   - `email.delivered`
   - `email.bounced`
   - `email.complained`
   - `email.delivery_delayed`
5. Click **Create Webhook**.
6. Copy the generated **Signing Secret** (begins with `whsec_`).

### Step 3: Staging Environment Variable Update
1. In the Vercel Dashboard, go to **Project Settings > Environment Variables**.
2. Add `RESEND_WEBHOOK_SECRET` with the copied `whsec_...` value for the **Preview** and **Production** environments.
3. Redeploy or promote the build.

---

## 7. Webhook Verification Test Suite (Post-Deployment Testing)

We have authored and passed [scripts/verify_staging_readiness.mjs](file:///D:/solidfut/Project%20code%20files/saas/scripts/verify_staging_readiness.mjs) which tests the four critical webhook invariants:

1. **Real Signed Webhook Test:**
   - Computes an authentic Svix signature using HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${body}`.
   - Confirms that authentic payloads are validated (`HTTP 200`).
   - Confirms that tampered payloads, altered event types, or expired timestamps (>5 min) are rejected (`HTTP 401`).

2. **Message Status Advancement Test:**
   - Confirms monotonic state progression: `queued` → `sending` → `sent` → `delivered`.
   - Confirms that state downgrades (e.g. an out-of-order `sent` webhook arriving after `delivered`) are ignored without errors.

3. **Duplicate Event Handling (Idempotency):**
   - Ingests duplicate `provider_message_id` + `event_type` events.
   - Confirms that PostgreSQL unique constraint violation (`23505` on `message_webhook_events`) returns `HTTP 200 { ok: true, duplicate: true }` without crashing or corrupting data.

4. **Invoice Balance Invariant Test:**
   - Confirms that inbound delivery webhooks update `messages` and `message_webhook_events` only.
   - Under no circumstances does a webhook mutate `invoices.outstanding_amount` or `invoices.amount_paid`.

---

## 8. Verification & Regression Test Results

| Test Suite | File / Command | Checks / Assertions | Result |
| :--- | :--- | :---: | :---: |
| **Next.js Production Build** | `npm run build` | 28 routes compiled | **PASS (Exit 0)** |
| **TypeScript Compilation** | `npx tsc --noEmit` | Clean build | **PASS (0 errors)** |
| **Staging Readiness Suite** | `node scripts/verify_staging_readiness.mjs` | 11 / 11 passed | **PASS** |
| **Resend & Webhook Suite** | `node scripts/verify_email_002.mjs` | 8 / 8 passed | **PASS** |
| **Email Dispatch Suite** | `node scripts/verify_email_dispatch.mjs` | 23 / 23 passed | **PASS** |
| **Dashboard Trust Suite** | `node scripts/verify_audit_002.mjs` | 28 / 28 passed | **PASS** |
| **Financial Audit Suite** | `node scripts/verify_audit.mjs` | 22 / 22 passed | **PASS** |
| **Persistence Parity Suite** | `node scripts/verify_data_004.mjs` | 23 / 23 passed | **PASS** |
| **Live Supabase Schema** | `node scripts/verify_live_schema.mjs` | 6 / 6 passed | **PASS** |
| **Environment Check** | `node scripts/validate_env.mjs` | Zero client leaks | **PASS** |

**Total Regression Assertions:** 121 passed, 0 failed.

---

## 9. Staging Deployment Checklist & Manual Actions Required

### Pre-Deployment (Operator Action)
- [x] Next.js 16 production build verified locally.
- [x] TypeScript compilation verified with 0 errors.
- [x] Client/server environment boundaries verified.
- [x] `.env.local` confirmed untracked in Git.
- [x] Security headers configuration added to [vercel.json](file:///D:/solidfut/Project%20code%20files/saas/vercel.json).
- [ ] Initialize Git repository if not already initialized (`git init`, `git add .`, `git commit -m "feat: prepare staging deployment"`).
- [ ] Push to GitHub / GitLab / Bitbucket repository.

### Deployment Step (Operator Action)
- [ ] Import repository into Vercel.
- [ ] Set Framework Preset to **Next.js**.
- [ ] Configure Environment Variables in Vercel Project Settings:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SITE_URL` (set to `https://<your-project>.vercel.app`)
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL` (e.g. `Smart Invoice Chasing <onboarding@resend.dev>`)
- [ ] Deploy the project.

### Post-Deployment Verification (Operator Action)
- [ ] Access `https://<your-project>.vercel.app` and test user login.
- [ ] Confirm Supabase OAuth / Auth redirect callback (`https://<your-project>.vercel.app/auth/callback`) is added to Supabase Dashboard > Authentication > URL Configuration > Redirect URLs.
- [ ] Register `https://<your-project>.vercel.app/api/webhooks/resend` in Resend Dashboard and copy signing secret to `RESEND_WEBHOOK_SECRET`.
- [ ] Trigger a test webhook via Resend dashboard ("Test Webhook") and verify `HTTP 200` response.
