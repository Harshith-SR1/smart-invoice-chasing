/**
 * AUTHORITATIVE PLAN DEFINITIONS & LIMITS
 * TASK: PLAN-LIMITS-001
 *
 * Source of truth:
 * - supabase/migrations/000_initial_schema.sql (CHECK constraint on plan_id)
 * - src/app/billing/page.tsx (Plan limits: Free = 10, Early Access = 100, Growth = 500)
 * - src/lib/workspaceProvisioning.ts (Default FREE subscription)
 */

export type PlanId = 'FREE' | 'EARLY_ACCESS' | 'GROWTH';

export interface PlanConfig {
  id: PlanId;
  name: string;
  maxActiveInvoices: number;
  priceMonthlyINR: number;
  description: string;
}

export const AUTHORITATIVE_PLANS: Record<PlanId, PlanConfig> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    maxActiveInvoices: 10,
    priceMonthlyINR: 0,
    description: 'Up to 10 active invoices',
  },
  EARLY_ACCESS: {
    id: 'EARLY_ACCESS',
    name: 'Early Access',
    maxActiveInvoices: 100,
    priceMonthlyINR: 999,
    description: 'Up to 100 active invoices',
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Growth',
    maxActiveInvoices: 500,
    priceMonthlyINR: 2499,
    description: 'Up to 500 active invoices',
  },
};

/**
 * Normalizes user- or database-supplied plan ID strings.
 * Returns null if unrecognized.
 */
export function normalizePlanId(rawPlanId?: string | null): PlanId | null {
  if (!rawPlanId || typeof rawPlanId !== 'string') return null;
  const upper = rawPlanId.trim().toUpperCase().replace(/-/g, '_').replace(/\s+/g, '_');
  if (upper === 'FREE') return 'FREE';
  if (upper === 'EARLY_ACCESS' || upper === 'EARLYACCESS') return 'EARLY_ACCESS';
  if (upper === 'GROWTH') return 'GROWTH';
  return null;
}

/**
 * Retrieves the canonical configuration for a given plan ID.
 * Returns null if the plan ID is unrecognized or invalid.
 */
export function getPlanConfig(rawPlanId?: string | null): PlanConfig | null {
  const normalized = normalizePlanId(rawPlanId);
  if (!normalized) return null;
  return AUTHORITATIVE_PLANS[normalized] || null;
}
