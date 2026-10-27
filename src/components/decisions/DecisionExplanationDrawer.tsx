'use client';

import React, { useEffect } from 'react';
import {
  X,
  Brain,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  DollarSign,
  FileText,
  User,
  Info,
  Building,
  Mail,
  HelpCircle,
  PauseCircle,
  PlayCircle,
  Ban,
  PhoneCall,
  Flame,
  AlertCircle,
} from 'lucide-react';
import {
  Invoice,
  Customer,
  PaymentPromise,
  AiDecision,
  DecisionAction,
  PaymentClaimStatus,
} from '../../types';
import {
  evaluateInvoiceDecision,
  computeCustomerPaymentReliability,
} from '../../lib/decisionEngine';

export interface AgingBucketInfo {
  tierId: 'current' | 'days1_7' | 'days8_30' | 'days31_60' | 'days61_90' | 'days90Plus';
  label: string;
  range: string;
  badgeColor: string;
}

export interface DecisionExplanationData {
  invoice: Invoice;
  decision: AiDecision;
  action: DecisionAction;
  aging: {
    daysOverdue: number;
    bucket: AgingBucketInfo;
    dueDate: string;
    issueDate: string;
  };
  financial: {
    totalInvoiced: number;
    confirmedPaid: number;
    verifiedOutstanding: number;
    currencySymbol: string;
    currencyCode: string;
  };
  plainLanguageExplanation: string;
  claimAudit: {
    status: PaymentClaimStatus;
    isUnverifiedClaim: boolean;
    isVerifiedPayment: boolean;
    isRejectedClaim: boolean;
    claimedAt: string | null;
    claimNote: string | null;
    safetyNotice: string;
  };
  promiseAudit: {
    hasPromise: boolean;
    status: 'ACTIVE' | 'FULFILLED' | 'BROKEN' | 'NONE';
    promisedDate: string | null;
    amount: number | null;
    quoteText: string | null;
    summary: string;
  };
  disputeHoldAudit: {
    isPaused: boolean;
    isDisputed: boolean;
    isOnHold: boolean;
    pauseReason: string | null;
    summary: string;
  };
  reliabilityAudit: {
    hasProfile: boolean;
    score: number | null;
    tierLabel: string;
    tierColor: 'emerald' | 'amber' | 'rose' | 'slate';
    primaryFactors: string[];
    summary: string;
  };
  missingFields: string[];
}

/**
 * Categorizes days overdue into one of the 6 canonical aging tiers.
 */
export function getCanonicalAgingBucket(daysOverdue: number): AgingBucketInfo {
  if (daysOverdue <= 0) {
    return {
      tierId: 'current',
      label: 'Current (Not Due)',
      range: '<= 0 days',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    };
  }
  if (daysOverdue <= 7) {
    return {
      tierId: 'days1_7',
      label: '1–7 Days Overdue',
      range: '1–7 days',
      badgeColor: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    };
  }
  if (daysOverdue <= 30) {
    return {
      tierId: 'days8_30',
      label: '8–30 Days Overdue',
      range: '8–30 days',
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    };
  }
  if (daysOverdue <= 60) {
    return {
      tierId: 'days31_60',
      label: '31–60 Days Overdue',
      range: '31–60 days',
      badgeColor: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    };
  }
  if (daysOverdue <= 90) {
    return {
      tierId: 'days61_90',
      label: '61–90 Days Overdue',
      range: '61–90 days',
      badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    };
  }
  return {
    tierId: 'days90Plus',
    label: '90+ Days Overdue (Urgent)',
    range: '> 90 days',
    badgeColor: 'bg-rose-500/25 text-rose-200 border-rose-500/50',
  };
}

/**
 * Builds deterministic explainability data from canonical models without mutating state.
 */
export function buildDecisionExplanation(
  invoice: Invoice,
  existingDecision?: AiDecision | null,
  customer?: Customer | null,
  promises: PaymentPromise[] = []
): DecisionExplanationData {
  // Use existing decision or evaluate canonically
  const decision = existingDecision || evaluateInvoiceDecision(invoice, customer || undefined, promises);
  const action = decision.action;

  const currencySymbol = invoice.currency?.includes('INR') || invoice.currency === 'INR' ? '₹' : '$';
  const currencyCode = invoice.currency?.includes('INR') || invoice.currency === 'INR' ? 'INR' : 'USD';

  const totalInvoiced = Number(invoice.amount) || 0;
  const confirmedPaid = Number(invoice.paidAmount) || 0;
  const verifiedOutstanding =
    invoice.status === 'paid'
      ? 0
      : invoice.outstandingAmount !== undefined
      ? Number(invoice.outstandingAmount)
      : Math.max(0, totalInvoiced - confirmedPaid);

  const missingFields: string[] = [];
  if (!customer) missingFields.push('Customer Profile Record');
  if (!invoice.customerEmail) missingFields.push('Customer Email');
  if (!invoice.lastCustomerReply) missingFields.push('Customer Reply History');
  if (!invoice.paymentClaimNote && invoice.paymentClaimStatus === 'CLAIMED') {
    missingFields.push('Payment Claim Notes / Reference');
  }

  // Related promises
  const relatedPromises = promises.filter((p) => p.invoiceId === invoice.id);
  const activePromise = relatedPromises.find(
    (p) => p.status === 'ACTIVE' || p.status === 'pending'
  );
  const brokenPromise = relatedPromises.find(
    (p) => p.status === 'BROKEN' || p.status === 'missed'
  );
  const fulfilledPromise = relatedPromises.find(
    (p) => p.status === 'FULFILLED' || p.status === 'fulfilled'
  );

  let promiseStatus: 'ACTIVE' | 'FULFILLED' | 'BROKEN' | 'NONE' = 'NONE';
  let targetPromise: PaymentPromise | undefined;
  if (activePromise) {
    promiseStatus = 'ACTIVE';
    targetPromise = activePromise;
  } else if (brokenPromise) {
    promiseStatus = 'BROKEN';
    targetPromise = brokenPromise;
  } else if (fulfilledPromise) {
    promiseStatus = 'FULFILLED';
    targetPromise = fulfilledPromise;
  }

  let promiseSummary = 'No payment promises or commitments recorded.';
  if (promiseStatus === 'ACTIVE' && targetPromise) {
    promiseSummary = `Active commitment: Promised ${currencySymbol}${Number(targetPromise.amount).toLocaleString()} on ${targetPromise.promisedDate}. Grace period active.`;
  } else if (promiseStatus === 'BROKEN' && targetPromise) {
    promiseSummary = `Broken commitment: Promised ${currencySymbol}${Number(targetPromise.amount).toLocaleString()} on ${targetPromise.promisedDate}, but funds were not confirmed.`;
  } else if (promiseStatus === 'FULFILLED' && targetPromise) {
    promiseSummary = `Fulfilled commitment: Payment of ${currencySymbol}${Number(targetPromise.amount).toLocaleString()} was received and verified on ledger.`;
  }

  // Payment Claim
  const claimStatus: PaymentClaimStatus = invoice.paymentClaimStatus || 'UNCLAIMED';
  const isUnverifiedClaim = claimStatus === 'CLAIMED';
  const isVerifiedPayment = claimStatus === 'VERIFIED';
  const isRejectedClaim = claimStatus === 'REJECTED';

  let safetyNotice = 'Standard ledger reconciliation policy applies.';
  if (isUnverifiedClaim) {
    safetyNotice =
      'FINANCIAL SAFETY RULE: A customer payment claim is NOT verified cash. Automated reminders are paused for human review, but outstanding balance remains on accounts until confirmed by bank ledger.';
  } else if (isVerifiedPayment) {
    safetyNotice = 'Payment confirmed and reconciled against bank records.';
  } else if (isRejectedClaim) {
    safetyNotice = 'Customer payment claim was reviewed and rejected. Chasing pipeline is active.';
  }

  // Dispute & Hold
  const isDisputed =
    invoice.status === 'disputed' ||
    invoice.collectionCategory === 'DISPUTERS' ||
    invoice.lastReplyIntent === 'DISPUTE';
  const isOnHold = invoice.status === 'held' || invoice.status === 'on_hold';
  const isPaused = isDisputed || isOnHold;

  let pauseReason: string | null = null;
  if (isDisputed) pauseReason = 'Active customer dispute / invoice deliverable query under review';
  else if (isOnHold) pauseReason = 'Administrative hold placed on account';

  let disputeHoldSummary = 'Collections pipeline active. No dispute or administrative hold.';
  if (isDisputed) {
    disputeHoldSummary =
      'COLLECTIONS PAUSED: An active billing or deliverable dispute is recorded. The engine strictly suppresses automated chasers to prevent customer friction.';
  } else if (isOnHold) {
    disputeHoldSummary =
      'COLLECTIONS PAUSED: Invoice is placed on administrative hold. Automated communications are halted until released.';
  }

  // Customer Reliability
  let reliabilityAudit: DecisionExplanationData['reliabilityAudit'];
  if (customer) {
    const assessment = computeCustomerPaymentReliability(customer, [invoice], promises);
    reliabilityAudit = {
      hasProfile: true,
      score: assessment.score,
      tierLabel: assessment.tierLabel,
      tierColor: assessment.tierColor,
      primaryFactors: assessment.primaryFactors,
      summary:
        assessment.score !== null
          ? `Reliability score: ${assessment.score}/100 (${assessment.tierLabel}). ${assessment.primaryFactors[0] || ''}`
          : 'Insufficient payment history (< 2 completed events). Neutral assessment applied.',
    };
  } else {
    reliabilityAudit = {
      hasProfile: false,
      score: null,
      tierLabel: 'Unavailable',
      tierColor: 'slate',
      primaryFactors: ['Customer profile record is not present in workspace database.'],
      summary: 'Customer profile unavailable. Historical reliability score cannot be calculated.',
    };
  }

  // Plain language explanation
  let plainLanguageExplanation = '';
  switch (action) {
    case 'STOP':
      if (invoice.status === 'paid' || verifiedOutstanding <= 0) {
        plainLanguageExplanation =
          'Payment has been confirmed and verified on the ledger. Under canonical financial safety rules, all collection activity ceases immediately to prevent improper dunning.';
      } else if (invoice.status === 'cancelled' || invoice.status === 'void') {
        plainLanguageExplanation = `Invoice status is officially marked as ${invoice.status.toUpperCase()}. No active financial receivable exists, so all chasing is permanently halted.`;
      } else if (invoice.status === 'draft') {
        plainLanguageExplanation =
          'Invoice is currently in draft status and has not been issued to the client. Automated outreach is disabled.';
      } else {
        plainLanguageExplanation =
          'Collections are halted under the canonical decision engine policy.';
      }
      break;

    case 'HUMAN':
      if (isUnverifiedClaim) {
        plainLanguageExplanation =
          'The customer has reported that payment was already released. While automated chasers are suspended to avoid dunning a customer who claims to have paid, this claim is NOT verified cash. An operator must verify bank records before updating account balances.';
      } else if (isDisputed) {
        plainLanguageExplanation =
          'The customer logged a billing dispute or questioned invoice deliverables. Automated collections are paused and flagged for human mediation to resolve the root query.';
      } else {
        plainLanguageExplanation =
          'This invoice requires manual human intervention due to non-standard account conditions.';
      }
      break;

    case 'WAIT':
      if (isOnHold) {
        plainLanguageExplanation =
          'Invoice is under administrative review. The engine waits until operational hold flags are cleared.';
      } else if (promiseStatus === 'ACTIVE' && targetPromise) {
        plainLanguageExplanation = `The customer committed to pay ${currencySymbol}${Number(targetPromise.amount).toLocaleString()} on ${targetPromise.promisedDate}. The engine is honoring the active grace period without sending premature chasers.`;
      } else if (invoice.daysOverdue <= 0) {
        plainLanguageExplanation = `Invoice is not overdue (due on ${invoice.dueDate}). The customer maintains a reliable history, so no early chasing is warranted.`;
      } else {
        plainLanguageExplanation =
          'The engine determined that no collection outreach should occur today based on schedule and grace rules.';
      }
      break;

    case 'FOLLOW_UP':
      if (promiseStatus === 'BROKEN' && targetPromise) {
        plainLanguageExplanation = `The customer committed to pay by ${targetPromise.promisedDate}, but payment was not received or verified. A direct follow-up specifically referencing the broken commitment is recommended.`;
      } else {
        plainLanguageExplanation = `Invoice is ${invoice.daysOverdue} days overdue with ${currencySymbol}${verifiedOutstanding.toLocaleString()} outstanding. A structured follow-up reminder is recommended.`;
      }
      break;

    case 'ESCALATE':
      if (promiseStatus === 'BROKEN' && (customer?.missedPromisesCount || 0) >= 2) {
        plainLanguageExplanation = `Customer has broken ${customer?.missedPromisesCount || 2} payment commitments. High risk of continued default requires formal escalation.`;
      } else if (invoice.remindersSent >= 4 && invoice.customerRepliesCount === 0) {
        plainLanguageExplanation = `Customer has not responded after ${invoice.remindersSent} outreach attempts over ${invoice.daysOverdue} days. Digital ghosting requires direct multi-channel escalation.`;
      } else if (verifiedOutstanding >= 100000 && invoice.daysOverdue >= 14) {
        plainLanguageExplanation = `Invoice is a high-value receivable (${currencySymbol}${verifiedOutstanding.toLocaleString()}) and significantly overdue (${invoice.daysOverdue} days). Elevated recovery risk warrants escalation.`;
      } else {
        plainLanguageExplanation =
          'Elevated delinquency factors require escalation beyond standard reminder templates.';
      }
      break;

    case 'NUDGE':
      if (invoice.daysOverdue <= 0) {
        plainLanguageExplanation = `Invoice is due in ${Math.abs(invoice.daysOverdue)} days. Customer historically experiences approval lead time (${customer?.avgPaymentDelayDays || 'known'} days delay), so a gentle pre-due reminder ensures timely processing.`;
      } else {
        plainLanguageExplanation = `Invoice is recently overdue by ${invoice.daysOverdue} days. A polite, low-pressure reminder is recommended.`;
      }
      break;
  }

  return {
    invoice,
    decision,
    action,
    aging: {
      daysOverdue: invoice.daysOverdue,
      bucket: getCanonicalAgingBucket(invoice.daysOverdue),
      dueDate: invoice.dueDate,
      issueDate: invoice.issueDate,
    },
    financial: {
      totalInvoiced,
      confirmedPaid,
      verifiedOutstanding,
      currencySymbol,
      currencyCode,
    },
    plainLanguageExplanation,
    claimAudit: {
      status: claimStatus,
      isUnverifiedClaim,
      isVerifiedPayment,
      isRejectedClaim,
      claimedAt: invoice.paymentClaimedAt || null,
      claimNote: invoice.paymentClaimNote || null,
      safetyNotice,
    },
    promiseAudit: {
      hasPromise: promiseStatus !== 'NONE',
      status: promiseStatus,
      promisedDate: targetPromise?.promisedDate || null,
      amount: targetPromise ? Number(targetPromise.amount) : null,
      quoteText: targetPromise?.quoteText || null,
      summary: promiseSummary,
    },
    disputeHoldAudit: {
      isPaused,
      isDisputed,
      isOnHold,
      pauseReason,
      summary: disputeHoldSummary,
    },
    reliabilityAudit,
    missingFields,
  };
}

export interface DecisionExplanationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  decision?: AiDecision | null;
  customer?: Customer | null;
  promises?: PaymentPromise[];
}

export const DecisionExplanationDrawer: React.FC<DecisionExplanationDrawerProps> = ({
  isOpen,
  onClose,
  invoice,
  decision,
  customer,
  promises = [],
}) => {
  // Support Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !invoice) return null;

  const data = buildDecisionExplanation(invoice, decision, customer, promises);

  const getActionTheme = (action: DecisionAction) => {
    switch (action) {
      case 'ESCALATE':
        return {
          badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
          border: 'border-rose-500/30',
          icon: <Flame className="w-4 h-4 text-rose-400" />,
        };
      case 'HUMAN':
        return {
          badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
          border: 'border-amber-500/30',
          icon: <User className="w-4 h-4 text-amber-400" />,
        };
      case 'FOLLOW_UP':
        return {
          badge: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
          border: 'border-sky-500/30',
          icon: <PlayCircle className="w-4 h-4 text-sky-400" />,
        };
      case 'NUDGE':
        return {
          badge: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
          border: 'border-violet-500/30',
          icon: <Clock className="w-4 h-4 text-violet-400" />,
        };
      case 'WAIT':
        return {
          badge: 'bg-teal-500/15 text-teal-300 border-teal-500/40',
          border: 'border-teal-500/30',
          icon: <PauseCircle className="w-4 h-4 text-teal-400" />,
        };
      case 'STOP':
        return {
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          border: 'border-slate-700',
          icon: <Ban className="w-4 h-4 text-slate-400" />,
        };
      default:
        return {
          badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
          border: 'border-emerald-500/30',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        };
    }
  };

  const actionTheme = getActionTheme(data.action);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-drawer-title"
      aria-describedby="decision-drawer-description"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden text-slate-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center text-[#8B7CFF]">
                <Brain className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#8B7CFF] font-bold">
                Decision Audit & Explainability
              </span>
            </div>
            <h2 id="decision-drawer-title" className="text-xl font-bold text-white tracking-tight">
              {invoice.customerName}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="text-slate-200 font-bold">{invoice.invoiceNumber}</span>
              <span>&bull;</span>
              <span>{invoice.customerEmail || 'No email recorded'}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close explanation drawer"
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition hover:border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B7CFF] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Section 1: Next-Best-Action Primary Card */}
          <div className={`p-4 sm:p-5 rounded-3xl bg-slate-900/80 border ${actionTheme.border} space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-mono font-extrabold border flex items-center gap-1.5 ${actionTheme.badge}`}
                >
                  {actionTheme.icon}
                  <span>ACTION: {data.action}</span>
                </span>
                <span className="px-2.5 py-1 rounded-xl text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400">
                  Confidence: <strong className="text-white">{data.decision.confidence}%</strong>
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Priority: <strong className="text-amber-400">{data.decision.priority}</strong>
              </span>
            </div>

            <div>
              <p className="text-xs uppercase font-mono text-slate-400 font-semibold mb-1">
                Deterministic Decision Reason:
              </p>
              <p className="text-sm font-semibold text-white leading-relaxed">
                {data.decision.reason}
              </p>
            </div>

            {/* Execution Parameters */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-500 block uppercase">Timing</span>
                <span className="text-slate-200 font-bold">{data.decision.recommendedTiming}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-500 block uppercase">Channel</span>
                <span className="text-emerald-400 font-bold">{data.decision.recommendedChannel}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-500 block uppercase">Tone</span>
                <span className="text-amber-400 font-bold">{data.decision.recommendedTone}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Plain Language Explanation */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-[#8B7CFF]">
              <Info className="w-4 h-4" />
              <span>Why Does This Decision Apply?</span>
            </div>
            <p id="decision-drawer-description" className="text-xs text-slate-200 leading-relaxed">
              {data.plainLanguageExplanation}
            </p>
            <div className="pt-2">
              <span className="text-[10px] font-mono text-slate-500 block uppercase font-semibold">
                Recorded Evidence:
              </span>
              <p className="text-xs text-slate-300 font-mono mt-0.5 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/60">
                {data.decision.evidence || 'No additional evidence logged.'}
              </p>
            </div>
          </div>

          {/* Section 3: Verified Financial Balances & Aging Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Financial Truth */}
            <div className="p-4 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Financial Truth
                </span>
                <span className="text-[10px] uppercase text-emerald-400">Reconciled</span>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400">Total Invoiced:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {data.financial.currencySymbol}{data.financial.totalInvoiced.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400">Confirmed Paid:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {data.financial.currencySymbol}{data.financial.confirmedPaid.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-xs pt-1 border-t border-slate-800">
                  <span className="text-slate-300 font-bold">Verified Outstanding:</span>
                  <span className="font-mono text-base font-extrabold text-white">
                    {data.financial.currencySymbol}{data.financial.verifiedOutstanding.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Canonical Aging Schedule */}
            <div className="p-4 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  Aging Schedule
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${data.aging.bucket.badgeColor}`}>
                  {data.aging.bucket.label}
                </span>
              </div>

              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400">Days Overdue:</span>
                  <span className="font-mono font-bold text-white">
                    {data.aging.daysOverdue <= 0 ? 'Not Overdue' : `${data.aging.daysOverdue} days`}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400">Due Date:</span>
                  <span className="font-mono text-slate-300">{data.aging.dueDate}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400">Issue Date:</span>
                  <span className="font-mono text-slate-300">{data.aging.issueDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Payment Claim Status (Strictly distinguishes unverified claim) */}
          <div
            className={`p-4 sm:p-5 rounded-3xl border space-y-2 ${
              data.claimAudit.isUnverifiedClaim
                ? 'bg-amber-500/10 border-amber-500/30'
                : data.claimAudit.isVerifiedPayment
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-slate-900/40 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`w-4 h-4 ${
                    data.claimAudit.isUnverifiedClaim ? 'text-amber-400' : 'text-slate-500'
                  }`}
                />
                <h4 className="text-xs font-bold font-mono uppercase text-slate-200">
                  Payment Claim Audit
                </h4>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  data.claimAudit.isUnverifiedClaim
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : data.claimAudit.isVerifiedPayment
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {data.claimAudit.status}
              </span>
            </div>

            <p className="text-xs text-slate-300">{data.claimAudit.safetyNotice}</p>

            {data.claimAudit.isUnverifiedClaim && (
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/20 text-xs space-y-1 font-mono">
                <div className="text-slate-400 text-[11px]">
                  Claimed At:{' '}
                  <span className="text-slate-200 font-bold">
                    {data.claimAudit.claimedAt || 'Unavailable'}
                  </span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Claim Note:{' '}
                  <span className="text-slate-200 font-bold">
                    {data.claimAudit.claimNote || 'No reference note provided'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Payment Promise Audit */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                <h4 className="text-xs font-bold font-mono uppercase text-slate-200">
                  Payment Promise Commitment
                </h4>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  data.promiseAudit.status === 'ACTIVE'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : data.promiseAudit.status === 'BROKEN'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : data.promiseAudit.status === 'FULFILLED'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {data.promiseAudit.status}
              </span>
            </div>

            <p className="text-xs text-slate-300">{data.promiseAudit.summary}</p>

            {data.promiseAudit.quoteText && (
              <p className="text-[11px] text-slate-400 italic bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/60 font-mono">
                &ldquo;{data.promiseAudit.quoteText}&rdquo;
              </p>
            )}
          </div>

          {/* Section 6: Dispute & Hold Status */}
          <div
            className={`p-4 sm:p-5 rounded-3xl border space-y-2 ${
              data.disputeHoldAudit.isPaused
                ? 'bg-purple-500/10 border-purple-500/30'
                : 'bg-slate-900/40 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`w-4 h-4 ${
                    data.disputeHoldAudit.isPaused ? 'text-purple-400' : 'text-slate-500'
                  }`}
                />
                <h4 className="text-xs font-bold font-mono uppercase text-slate-200">
                  Dispute & Hold Status
                </h4>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  data.disputeHoldAudit.isPaused
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {data.disputeHoldAudit.isPaused ? 'COLLECTIONS PAUSED' : 'ACTIVE PIPELINE'}
              </span>
            </div>

            <p className="text-xs text-slate-300">{data.disputeHoldAudit.summary}</p>
          </div>

          {/* Section 7: Customer Reliability Assessment */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold font-mono uppercase text-slate-200">
                  Customer Reliability Assessment
                </h4>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  data.reliabilityAudit.tierColor === 'emerald'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : data.reliabilityAudit.tierColor === 'amber'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : data.reliabilityAudit.tierColor === 'rose'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {data.reliabilityAudit.tierLabel}
              </span>
            </div>

            <p className="text-xs text-slate-300">{data.reliabilityAudit.summary}</p>

            {data.reliabilityAudit.primaryFactors.length > 0 && (
              <ul className="space-y-1 text-xs text-slate-400 list-disc list-inside">
                {data.reliabilityAudit.primaryFactors.map((factor, idx) => (
                  <li key={idx} className="font-mono text-[11px] text-slate-300">
                    {factor}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Section 8: Missing / Unavailable Information (Honest Labeling) */}
          <div className="p-4 rounded-3xl bg-slate-900/30 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-400">
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>DATA INTEGRITY AUDIT</span>
            </div>
            {data.missingFields.length > 0 ? (
              <div>
                <p className="text-xs text-slate-400 mb-1.5">
                  The following data points are unrecorded or unavailable in workspace state:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.missingFields.map((field, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400"
                    >
                      {field}: Unavailable
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-emerald-400/90 font-mono">
                ✓ All canonical data points are present and verified in workspace records.
              </p>
            )}
          </div>
        </div>

        {/* Drawer Footer (Strict Read-Only Guarantee) */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Read-Only Audit Mode &bull; Non-mutating</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
