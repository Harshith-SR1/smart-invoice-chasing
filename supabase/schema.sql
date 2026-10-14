-- ===================================================
-- SMART INVOICE CHASING - COMPLETE PRODUCTION BACKEND SCHEMA
-- Execute this SQL script in your Supabase SQL Editor
-- ===================================================

-- Enable pgcrypto extension for UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 2. Create Workspaces Table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_type TEXT DEFAULT 'Agency',
  country TEXT DEFAULT 'India',
  currency TEXT DEFAULT 'INR (₹)',
  business_email TEXT NOT NULL,
  business_phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  workspace_id_short TEXT DEFAULT 'ws-101',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace Member verification helper function
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID, u_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = ws_id AND user_id = u_id
    UNION
    SELECT 1 FROM public.workspace_members WHERE workspace_id = ws_id AND user_id = u_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can view workspaces they belong to"
  ON public.workspaces FOR SELECT
  USING (auth.uid() = user_id OR public.is_workspace_member(id, auth.uid()));

CREATE POLICY "Users can create their own workspace"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workspace"
  ON public.workspaces FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Create Workspace Members Table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, email)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view co-members"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace owners/admins can insert members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace owners/admins can update members"
  ON public.workspace_members FOR UPDATE
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 4. Create Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  total_invoiced NUMERIC(12, 2) DEFAULT 0.00,
  total_paid NUMERIC(12, 2) DEFAULT 0.00,
  outstanding NUMERIC(12, 2) DEFAULT 0.00,
  avg_payment_delay_days INT DEFAULT 0,
  overdue_invoices_count INT DEFAULT 0,
  reminders_sent_count INT DEFAULT 0,
  payment_promises_count INT DEFAULT 0,
  missed_promises_count INT DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'high_risk', 'good_standing')),
  first_invoiced_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, email)
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage customers in their workspace"
  ON public.customers FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 5. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  amount_paid NUMERIC(12, 2) DEFAULT 0.00,
  outstanding_amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'overdue' CHECK (status IN ('draft', 'due', 'overdue', 'chasing', 'promised', 'disputed', 'escalated', 'partially_paid', 'paid', 'cancelled')),
  days_overdue INT DEFAULT 0,
  collection_health INT DEFAULT 50 CHECK (collection_health BETWEEN 0 AND 100),
  health_category TEXT DEFAULT 'medium_risk' CHECK (health_category IN ('high_risk', 'medium_risk', 'low_risk')),
  health_reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
  reminders_sent INT DEFAULT 0,
  customer_replies_count INT DEFAULT 0,
  payment_promises_count INT DEFAULT 0,
  missed_promises_count INT DEFAULT 0,
  last_contact_date DATE,
  last_customer_reply TEXT,
  promised_payment_date DATE,
  next_action TEXT DEFAULT 'Initiate AI follow-up',
  ai_recommendation JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, invoice_number)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage invoices in their workspace"
  ON public.invoices FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 6. Create Collections State Machine Table
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'MONITORING' CHECK (state IN ('MONITORING', 'ACTIVE_CHASING', 'PROMISED', 'NEEDS_ATTENTION', 'ESCALATED', 'RECOVERED', 'PAUSED', 'CLOSED')),
  stage_details TEXT,
  last_evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage collections in their workspace"
  ON public.collections FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 7. Create Collection Events / Timeline Table
CREATE TABLE IF NOT EXISTS public.collection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  badge TEXT,
  actor TEXT DEFAULT 'system' CHECK (actor IN ('system', 'ai', 'customer', 'user')),
  metadata JSONB DEFAULT '{}'::JSONB
);

ALTER TABLE public.collection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view collection events in their workspace"
  ON public.collection_events FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 8. Create Messages & Threads Table
CREATE TABLE IF NOT EXISTS public.message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage message threads in their workspace"
  ON public.message_threads FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES public.message_threads(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('ai', 'user', 'customer')),
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('draft', 'queued', 'sent', 'delivered', 'failed'))
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage messages in their workspace"
  ON public.messages FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 9. Create AI Decisions Table
CREATE TABLE IF NOT EXISTS public.ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  intent TEXT NOT NULL CHECK (intent IN ('PROMISE_TO_PAY', 'PAYMENT_ISSUE', 'INVOICE_REQUEST', 'INTERNAL_APPROVAL', 'EXTENSION_REQUEST', 'PAYMENT_CLAIMED', 'QUESTION', 'DISPUTE', 'NO_RESPONSE', 'OTHER')),
  confidence NUMERIC(3,2) DEFAULT 0.95,
  summary TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  promised_date DATE,
  requires_human_review BOOLEAN DEFAULT FALSE,
  suggested_subject TEXT,
  suggested_body TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage AI decisions in their workspace"
  ON public.ai_decisions FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 10. Create Payment Promises Table
CREATE TABLE IF NOT EXISTS public.payment_promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  promised_amount NUMERIC(12, 2) NOT NULL,
  promised_date DATE NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  quote_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'missed')),
  fulfilled_at TIMESTAMPTZ
);

ALTER TABLE public.payment_promises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage payment promises in their workspace"
  ON public.payment_promises FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 11. Create Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  reference TEXT,
  source TEXT DEFAULT 'manual_entry' CHECK (source IN ('manual_entry', 'customer_claim', 'bank_sync')),
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending_verification')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage payments in their workspace"
  ON public.payments FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 12. Create Risk Scores Table
CREATE TABLE IF NOT EXISTS public.risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'WATCH', 'HIGH', 'CRITICAL')),
  score INT CHECK (score BETWEEN 0 AND 100),
  risk_factors TEXT[] DEFAULT ARRAY[]::TEXT[],
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk scores in their workspace"
  ON public.risk_scores FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 13. Create Subscriptions & Plans Tables
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'EARLY_ACCESS' CHECK (plan_id IN ('FREE', 'EARLY_ACCESS', 'GROWTH')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled')),
  billing_email TEXT NOT NULL,
  current_period_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view subscriptions in their workspace"
  ON public.subscriptions FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  billing_date DATE NOT NULL,
  period TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'unpaid')),
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view billing invoices in their workspace"
  ON public.billing_invoices FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 14. Create AI Settings & Collection Rules Tables
CREATE TABLE IF NOT EXISTS public.ai_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  is_paused BOOLEAN DEFAULT FALSE,
  tone TEXT DEFAULT 'firm' CHECK (tone IN ('friendly', 'professional', 'firm', 'assertive')),
  enable_auto_followup BOOLEAN DEFAULT TRUE,
  pre_due_days INT DEFAULT 3,
  post_due_schedule_days INT[] DEFAULT ARRAY[3, 7, 14],
  max_reminders INT DEFAULT 4,
  human_escalation_threshold_days INT DEFAULT 14,
  auto_stop_on_promise BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage AI settings in their workspace"
  ON public.ai_settings FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 15. Create Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  payment_received BOOLEAN DEFAULT TRUE,
  promise_detected BOOLEAN DEFAULT TRUE,
  promise_broken BOOLEAN DEFAULT TRUE,
  high_risk_flagged BOOLEAN DEFAULT TRUE,
  human_escalation BOOLEAN DEFAULT TRUE,
  ai_action_completed BOOLEAN DEFAULT TRUE,
  import_events BOOLEAN DEFAULT TRUE,
  email_channel BOOLEAN DEFAULT TRUE,
  in_app_channel BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage notification preferences in their workspace"
  ON public.notification_preferences FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- 16. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs in their workspace"
  ON public.audit_logs FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 17. Idempotent User Profile Trigger on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  -- 1. Insert Profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();

  -- 2. Create Default Workspace for New User if none exists
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE user_id = NEW.id) THEN
    INSERT INTO public.workspaces (user_id, business_name, business_type, country, currency, business_email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'company', 'Apex Creative Media & Tech Solutions'),
      'Agency',
      'India',
      'INR (₹)',
      NEW.email
    )
    RETURNING id INTO new_workspace_id;

    -- Insert Owner Member Record
    INSERT INTO public.workspace_members (workspace_id, user_id, name, email, role, status)
    VALUES (
      new_workspace_id,
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'OWNER',
      'active'
    );

    -- Insert Default Subscription
    INSERT INTO public.subscriptions (workspace_id, plan_id, billing_email)
    VALUES (new_workspace_id, 'EARLY_ACCESS', NEW.email);

    -- Insert Default AI Settings
    INSERT INTO public.ai_settings (workspace_id)
    VALUES (new_workspace_id);

    -- Insert Default Notification Preferences
    INSERT INTO public.notification_preferences (workspace_id)
    VALUES (new_workspace_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_workspace_id ON public.invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_customers_workspace_id ON public.customers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_collections_workspace_id ON public.collections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_collection_events_invoice_id ON public.collection_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_workspace_id ON public.ai_decisions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_payment_promises_workspace_id ON public.payment_promises(workspace_id);

-- 18. Least-Privilege API Role Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, public;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, public;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workspace_members TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_decisions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_promises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.ai_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;

GRANT SELECT ON public.risk_scores TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.billing_invoices TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON ROUTINES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
