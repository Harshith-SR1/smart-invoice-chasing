/**
 * Distributed Workspace Email Dispatch Rate Limiter
 *
 * Enforces server-side rate limits per workspace across multiple Vercel
 * serverless instances.
 *
 * Policy:
 *   - Maximum 10 outbound dispatch attempts per minute per workspace.
 *   - Sliding-window algorithm backed by Supabase PostgreSQL.
 *   - Returns HTTP 429 with Retry-After and X-RateLimit-* headers when exceeded.
 *   - Defense-in-depth: Includes an atomic in-memory L1 cache to handle rapid concurrent bursts
 *     and provide fallback protection if database latency spikes.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from './supabase/service';

export const DISPATCH_RATE_LIMIT = 10;
export const DISPATCH_WINDOW_MS = 60 * 1000; // 60 seconds

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSeconds: number;
  totalAttemptsInWindow: number;
}

// In-memory L1 cache for process-level burst protection and fallback
const memoryAttempts = new Map<string, number[]>();

function cleanMemoryAttempts(workspaceId: string, now: number): number[] {
  const windowStart = now - DISPATCH_WINDOW_MS;
  const existing = memoryAttempts.get(workspaceId) || [];
  const valid = existing.filter((ts) => ts > windowStart);
  if (valid.length > 0) {
    memoryAttempts.set(workspaceId, valid);
  } else {
    memoryAttempts.delete(workspaceId);
  }
  return valid;
}

/**
 * Checks and atomically reserves a dispatch slot for a workspace.
 *
 * 1. Claims a slot in the local L1 memory cache atomically to prevent event-loop race conditions.
 * 2. Queries Supabase PostgreSQL to verify multi-instance distributed quota across all Vercel instances.
 * 3. Persists the attempt to public.audit_logs so concurrent serverless instances immediately see it.
 */
export async function checkAndReserveDispatchRateLimit(
  workspaceId: string,
  messageId: string,
  userId: string,
  client?: SupabaseClient
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStartIso = new Date(now - DISPATCH_WINDOW_MS).toISOString();

  // 1. Fast atomic L1 memory check & reservation
  const memTimestamps = cleanMemoryAttempts(workspaceId, now);
  if (memTimestamps.length >= DISPATCH_RATE_LIMIT) {
    return evaluateTimestamps(memTimestamps, now);
  }

  // Atomically claim in L1 memory
  memTimestamps.push(now);
  memoryAttempts.set(workspaceId, memTimestamps);

  // 2. Distributed check across all instances via Supabase
  try {
    const svc = client || createServiceRoleClient();

    const { data: auditAttempts, error: auditErr } = await svc
      .from('audit_logs')
      .select('created_at')
      .eq('workspace_id', workspaceId)
      .eq('action', 'email_dispatch_attempt')
      .gte('created_at', windowStartIso)
      .order('created_at', { ascending: true });

    const { data: msgAttempts, error: msgErr } = await svc
      .from('messages')
      .select('queued_at')
      .eq('workspace_id', workspaceId)
      .gte('queued_at', windowStartIso)
      .in('delivery_status', ['sending', 'sent', 'delivered', 'failed'])
      .order('queued_at', { ascending: true });

    // Combine distinct timestamps from audit_logs and messages
    const timestamps: number[] = [];
    if (auditAttempts) {
      for (const row of auditAttempts) {
        if (row.created_at) timestamps.push(new Date(row.created_at).getTime());
      }
    }
    if (msgAttempts) {
      for (const row of msgAttempts) {
        if (row.queued_at) {
          const t = new Date(row.queued_at).getTime();
          if (!timestamps.some((existing) => Math.abs(existing - t) < 1000)) {
            timestamps.push(t);
          }
        }
      }
    }

    // Check if distributed DB count is already at or above limit
    const validDb = timestamps.filter((t) => t > now - DISPATCH_WINDOW_MS);
    if (validDb.length >= DISPATCH_RATE_LIMIT) {
      // Revert memory reservation since distributed limit was exceeded
      const currentMem = memoryAttempts.get(workspaceId) || [];
      const idx = currentMem.lastIndexOf(now);
      if (idx !== -1) currentMem.splice(idx, 1);
      return evaluateTimestamps(validDb, now);
    }

    // Persist to audit_logs for other instances
    await svc.from('audit_logs').insert({
      workspace_id: workspaceId,
      actor_id: userId,
      actor_name: 'operator',
      action: 'email_dispatch_attempt',
      entity_type: 'message',
      entity_id: messageId,
      details: {
        timestamp: new Date(now).toISOString(),
        limit: DISPATCH_RATE_LIMIT,
        windowMs: DISPATCH_WINDOW_MS,
      },
    });

    const totalInWindow = Math.max(validDb.length + 1, memTimestamps.length);
    const remaining = Math.max(0, DISPATCH_RATE_LIMIT - totalInWindow);

    return {
      allowed: true,
      limit: DISPATCH_RATE_LIMIT,
      remaining,
      resetMs: validDb.length > 0 ? validDb[0] + DISPATCH_WINDOW_MS : now + DISPATCH_WINDOW_MS,
      retryAfterSeconds: 0,
      totalAttemptsInWindow: totalInWindow,
    };
  } catch (err) {
    console.error('[rateLimiter] Error during distributed rate limit check:', err);
    // If DB fails, fall back to L1 memory which already has this attempt reserved
    return evaluateTimestamps(memTimestamps, now);
  }
}

/**
 * Checks whether a workspace is permitted to dispatch without claiming a slot.
 */
export async function checkWorkspaceDispatchRateLimit(
  workspaceId: string,
  client?: SupabaseClient
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStartIso = new Date(now - DISPATCH_WINDOW_MS).toISOString();

  const memTimestamps = cleanMemoryAttempts(workspaceId, now);
  if (memTimestamps.length >= DISPATCH_RATE_LIMIT) {
    return evaluateTimestamps(memTimestamps, now);
  }

  try {
    const svc = client || createServiceRoleClient();

    const { data: auditAttempts, error: auditErr } = await svc
      .from('audit_logs')
      .select('created_at')
      .eq('workspace_id', workspaceId)
      .eq('action', 'email_dispatch_attempt')
      .gte('created_at', windowStartIso)
      .order('created_at', { ascending: true });

    const { data: msgAttempts, error: msgErr } = await svc
      .from('messages')
      .select('queued_at')
      .eq('workspace_id', workspaceId)
      .gte('queued_at', windowStartIso)
      .in('delivery_status', ['sending', 'sent', 'delivered', 'failed'])
      .order('queued_at', { ascending: true });

    if (auditErr && msgErr) {
      return evaluateTimestamps(memTimestamps, now);
    }

    const timestamps: number[] = [];
    if (auditAttempts) {
      for (const row of auditAttempts) {
        if (row.created_at) timestamps.push(new Date(row.created_at).getTime());
      }
    }
    if (msgAttempts) {
      for (const row of msgAttempts) {
        if (row.queued_at) {
          const t = new Date(row.queued_at).getTime();
          if (!timestamps.some((existing) => Math.abs(existing - t) < 1000)) {
            timestamps.push(t);
          }
        }
      }
    }

    for (const memTs of memTimestamps) {
      if (!timestamps.some((existing) => Math.abs(existing - memTs) < 1000)) {
        timestamps.push(memTs);
      }
    }

    return evaluateTimestamps(timestamps, now);
  } catch (err) {
    console.error('[rateLimiter] Distributed check exception:', err);
    return evaluateTimestamps(memTimestamps, now);
  }
}

function evaluateTimestamps(timestamps: number[], now: number): RateLimitResult {
  const windowStart = now - DISPATCH_WINDOW_MS;
  const valid = timestamps.filter((t) => t > windowStart).sort((a, b) => a - b);

  if (valid.length >= DISPATCH_RATE_LIMIT) {
    const earliest = valid[0];
    const resetMs = earliest + DISPATCH_WINDOW_MS;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetMs - now) / 1000));
    return {
      allowed: false,
      limit: DISPATCH_RATE_LIMIT,
      remaining: 0,
      resetMs,
      retryAfterSeconds,
      totalAttemptsInWindow: valid.length,
    };
  }

  const remaining = Math.max(0, DISPATCH_RATE_LIMIT - valid.length - 1);
  const resetMs = valid.length > 0 ? valid[0] + DISPATCH_WINDOW_MS : now + DISPATCH_WINDOW_MS;

  return {
    allowed: true,
    limit: DISPATCH_RATE_LIMIT,
    remaining,
    resetMs,
    retryAfterSeconds: 0,
    totalAttemptsInWindow: valid.length,
  };
}

/**
 * Records an outbound dispatch attempt in Supabase and the L1 process memory.
 */
export async function recordWorkspaceDispatchAttempt(
  workspaceId: string,
  messageId: string,
  userId: string,
  client?: SupabaseClient
): Promise<void> {
  const now = Date.now();

  const existing = memoryAttempts.get(workspaceId) || [];
  existing.push(now);
  memoryAttempts.set(workspaceId, existing);

  try {
    const svc = client || createServiceRoleClient();
    await svc.from('audit_logs').insert({
      workspace_id: workspaceId,
      actor_id: userId,
      actor_name: 'operator',
      action: 'email_dispatch_attempt',
      entity_type: 'message',
      entity_id: messageId,
      details: {
        timestamp: new Date(now).toISOString(),
        limit: DISPATCH_RATE_LIMIT,
        windowMs: DISPATCH_WINDOW_MS,
      },
    });
  } catch (err) {
    console.error('[rateLimiter] Failed to persist dispatch attempt to audit_logs:', err);
  }
}

/**
 * Releases a reserved slot if message lock fails (e.g. 23505 duplicate or validation error).
 */
export function releaseRateLimitReservation(workspaceId: string): void {
  const current = memoryAttempts.get(workspaceId);
  if (current && current.length > 0) {
    current.pop();
    if (current.length === 0) {
      memoryAttempts.delete(workspaceId);
    }
  }
}

/**
 * Reset memory state (utility for automated testing).
 */
export function resetMemoryRateLimiter(): void {
  memoryAttempts.clear();
}
