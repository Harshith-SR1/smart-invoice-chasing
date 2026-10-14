-- ============================================================
-- DB-001B: Diagnostic SQL Inspection Script
-- Run this in Supabase SQL Editor to verify columns, constraints,
-- indexes, and role grants directly in PostgreSQL.
-- ============================================================

-- 1. Verify tracking columns on public.messages
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages'
  AND column_name IN (
    'sent_by', 
    'provider_message_id', 
    'failure_reason', 
    'queued_at', 
    'delivered_at', 
    'bounced_at',
    'delivery_status'
  )
ORDER BY column_name;

-- 2. Verify existence of message_webhook_events table and its columns
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'message_webhook_events'
ORDER BY ordinal_position;

-- 3. Verify partial unique index messages_inflight_unique
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'messages'
  AND indexname = 'messages_inflight_unique';

-- 4. Verify check constraint messages_delivery_status_check
SELECT 
  conname AS constraint_name, 
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' 
  AND conname = 'messages_delivery_status_check';

-- 5. Inspect role table grants on public.messages
SELECT 
  grantee, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'messages';
