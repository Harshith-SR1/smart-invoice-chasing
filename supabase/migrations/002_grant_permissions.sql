-- ============================================================
-- Migration 002: Least-Privilege Supabase Role Permissions (DB-001C)
--
-- Security Architecture & Threat Model:
-- 1. Schema Access:
--    - USAGE on schema public granted to anon, authenticated, and service_role.
--
-- 2. Anonymous Role (anon):
--    - ZERO table privileges on business/financial data.
--    - Unauthenticated callers cannot query, insert, or modify any business tables.
--    - Defense-in-depth: Even if RLS policies were misconfigured, Postgres table
--      privileges deny access at Layer 1.
--
-- 3. Authenticated Role (authenticated):
--    - Granted explicit CRUD privileges on business tables required for workspace operations.
--    - Read-only (SELECT) on sensitive audit/subscription/risk tables.
--    - ZERO access on message_webhook_events (internal webhook ingestion only).
--    - Row-level access is STRICTLY filtered by RLS policies:
--      (auth.uid() = user_id OR public.is_workspace_member(workspace_id, auth.uid())).
--
-- 4. Service Role (service_role):
--    - Full administrative privileges (ALL) for backend APIs and webhook handlers
--      (/api/messages/send, /api/webhooks/resend).
--    - Bypasses RLS by design for server-to-server operations.
--
-- 5. Helper Functions:
--    - is_workspace_member granted to authenticated and service_role; revoked from anon.
--    - handle_new_user granted to service_role; revoked from anon and public.
-- ============================================================

-- Step 1: Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Step 2: Revoke any preexisting public/anon blanket permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, public;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, public;

-- Step 3: Authenticated Role Permissions (Scoped by RLS)
-- 3a. User Profile & Account Data
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workspace_members TO authenticated;

-- 3b. Operational Receivables & Chasing Data
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_decisions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_promises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;

-- 3c. Settings & Preferences
GRANT SELECT, INSERT, UPDATE ON public.ai_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;

-- 3d. Read-Only Entities (Computed Scores, Audit Logs & Billing History)
GRANT SELECT ON public.risk_scores TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.billing_invoices TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

-- Note: public.message_webhook_events is deliberately NOT granted to authenticated.

-- Step 4: Service Role Permissions (Server-Side Dispatch & Webhooks)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Step 5: Routine / Helper Function Execution Privileges
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;

-- Step 6: Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Step 7: Scoped Default Privileges for Future Migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON ROUTINES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
