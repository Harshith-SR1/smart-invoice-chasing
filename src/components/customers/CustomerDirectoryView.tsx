'use client';

import React, { useState, useMemo } from 'react';
import {
  Eye,
  X,
  Brain,
  Check,
  Clock,
  AlertTriangle,
  HelpCircle,
  Users,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../layout/PageHeader';
import { Customer, CustomerReliabilityAssessment } from '../../types';
import {
  computeCustomerPaymentReliability,
  computePortfolioCustomerReliability,
} from '../../lib/decisionEngine';

export const CustomerDirectoryView: React.FC = () => {
  const { customers, invoices, promises, selectedCustomer, setSelectedCustomer, searchQuery } =
    useApp();

  const [behaviorFilter, setBehaviorFilter] = useState<
    'all' | 'reliable' | 'moderate' | 'elevated' | 'insufficient' | 'prompt' | 'late' | 'risk'
  >('all');

  // Compute portfolio-wide customer reliability assessments from authoritative records
  const customerAssessments = useMemo(() => {
    return computePortfolioCustomerReliability(customers, invoices, promises);
  }, [customers, invoices, promises]);

  // Customer Behavior Archetype Classifier
  const getCustomerArchetype = (c: Customer) => {
    if (c.totalInvoiced === 0) {
      return {
        label: 'New Customer',
        badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
        description: 'New customer — insufficient payment history yet.',
      };
    }
    if (c.avgPaymentDelayDays <= 7 && c.missedPromisesCount === 0) {
      return {
        label: 'Prompt Payer',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        description: 'Settles invoices promptly within 7 days of due date.',
      };
    }
    if (c.paymentPromisesCount > 0 && c.missedPromisesCount === 0) {
      return {
        label: 'Promise Keeper',
        badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
        description: 'Consistently honors detected payment commitments.',
      };
    }
    if (c.missedPromisesCount > 0 || c.status === 'high_risk') {
      return {
        label: 'Frequent Promise Breaker',
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        description: 'Repeatedly misses promised payment dates.',
      };
    }
    if (c.avgPaymentDelayDays > 25) {
      return {
        label: 'Consistent Late Payer',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        description: 'Predictably pays 25+ days past due date.',
      };
    }
    return {
      label: 'Standard Account',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      description: 'Standard collection responsiveness.',
    };
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.company.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const assessment = customerAssessments.get(c.id);

      if (behaviorFilter === 'reliable') return assessment?.tier === 'RELIABLE';
      if (behaviorFilter === 'moderate') return assessment?.tier === 'MODERATE';
      if (behaviorFilter === 'elevated') return assessment?.tier === 'ELEVATED';
      if (behaviorFilter === 'insufficient') return assessment?.tier === 'INSUFFICIENT_HISTORY';

      if (behaviorFilter === 'prompt')
        return c.avgPaymentDelayDays <= 7 && c.missedPromisesCount === 0;
      if (behaviorFilter === 'late') return c.avgPaymentDelayDays > 25;
      if (behaviorFilter === 'risk')
        return c.status === 'high_risk' || c.missedPromisesCount > 0 || assessment?.tier === 'ELEVATED';

      return true;
    });
  }, [customers, searchQuery, behaviorFilter, customerAssessments]);

  // Aggregate statistics for overview bar
  const reliableCount = useMemo(
    () => Array.from(customerAssessments.values()).filter((a) => a.tier === 'RELIABLE').length,
    [customerAssessments]
  );
  const elevatedCount = useMemo(
    () => Array.from(customerAssessments.values()).filter((a) => a.tier === 'ELEVATED').length,
    [customerAssessments]
  );
  const insufficientCount = useMemo(
    () => Array.from(customerAssessments.values()).filter((a) => a.tier === 'INSUFFICIENT_HISTORY').length,
    [customerAssessments]
  );

  const formatLakhs = (amt: number) => {
    if (amt >= 100000) {
      return `₹${(amt / 100000).toFixed(2)}L`;
    }
    if (amt >= 1000) {
      return `₹${(amt / 1000).toFixed(1)}K`;
    }
    return `₹${Math.round(amt)}`;
  };

  // Assessment for modal
  const selectedAssessment: CustomerReliabilityAssessment | null = useMemo(() => {
    if (!selectedCustomer) return null;
    return computeCustomerPaymentReliability(selectedCustomer, invoices, promises);
  }, [selectedCustomer, invoices, promises]);

  const getReliabilityBadge = (assessment?: CustomerReliabilityAssessment) => {
    if (!assessment || assessment.tier === 'INSUFFICIENT_HISTORY') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700"
          title="Fewer than 2 verified payment or commitment events on record"
        >
          <HelpCircle className="w-3 h-3 text-slate-500" />
          INSUFFICIENT HISTORY
        </span>
      );
    }
    if (assessment.tier === 'RELIABLE') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
          title={`Score: ${assessment.score}/100. Based on ${assessment.totalObservations} verified events.`}
        >
          <Check className="w-3 h-3 text-emerald-400" />
          RELIABLE ({assessment.score}/100)
        </span>
      );
    }
    if (assessment.tier === 'MODERATE') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30"
          title={`Score: ${assessment.score}/100. Based on ${assessment.totalObservations} verified events.`}
        >
          <Clock className="w-3 h-3 text-amber-400" />
          MODERATE ({assessment.score}/100)
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30"
        title={`Score: ${assessment.score}/100. Based on ${assessment.totalObservations} verified events.`}
      >
        <AlertTriangle className="w-3 h-3 text-rose-400" />
        ELEVATED RISK ({assessment.score}/100)
      </span>
    );
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto font-sans text-slate-100">
      {/* Shared Page Context Header */}
      <PageHeader
        title="Customer Payment Intelligence"
        subtitle="Customer payment memory, explainable reliability assessments, settlement delay history, and typical payment blockers."
        badge="Customer Memory"
        badgeColor="emerald"
      />

      {/* Customer Intelligence KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">
            Total Customer Accounts
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white font-mono">{customers.length}</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold">Tracked in payment memory</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-emerald-500/30 flex flex-col justify-between">
          <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold tracking-wider">
            High Reliability (80–100)
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-emerald-400 font-mono">{reliableCount}</span>
          </div>
          <span className="text-[10px] text-slate-400">Verified punctual settlement</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-rose-500/30 flex flex-col justify-between">
          <span className="text-[10px] text-rose-400 uppercase font-mono font-bold tracking-wider">
            Elevated Risk (&lt;50)
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-rose-400 font-mono">{elevatedCount}</span>
          </div>
          <span className="text-[10px] text-slate-400">Chronic delay or broken promises</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">
            Insufficient History
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white font-mono">{insufficientCount}</span>
          </div>
          <span className="text-[10px] text-slate-400">&lt; 2 completed observations</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Customers' },
            { id: 'reliable', label: 'High Reliability (80–100)' },
            { id: 'moderate', label: 'Moderate (50–79)' },
            { id: 'elevated', label: 'Elevated Risk (<50)' },
            { id: 'insufficient', label: 'Insufficient History' },
            { id: 'late', label: 'Chronic Late' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setBehaviorFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap cursor-pointer ${
                behaviorFilter === tab.id
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 font-mono">
          Showing {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'}
        </span>
      </div>

      {/* Customer Intelligence Directory Table */}
      <div className="rounded-3xl bg-[#111936]/90 border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 font-semibold border-b border-white/10 uppercase tracking-wider text-[10px] font-mono">
                <th className="py-4 px-6">Customer &amp; Company</th>
                <th className="py-4 px-4">Payment Reliability</th>
                <th className="py-4 px-4">Behavior Archetype</th>
                <th className="py-4 px-4">Total Paid</th>
                <th className="py-4 px-4">Outstanding</th>
                <th className="py-4 px-4">Avg Delay</th>
                <th className="py-4 px-4">Promise History</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => {
                  const archetype = getCustomerArchetype(c);
                  const assessment = customerAssessments.get(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-4 px-6">
                        <div className="font-bold text-white font-sans text-sm">{c.company}</div>
                        <div className="text-[11px] text-slate-400">
                          {c.name} &bull; {c.email}
                        </div>
                      </td>

                      <td className="py-4 px-4 font-sans">
                        <div className="flex flex-col gap-0.5">
                          {getReliabilityBadge(assessment)}
                          <span className="text-[10px] text-slate-500 font-mono">
                            {assessment?.totalObservations || 0} observation
                            {assessment?.totalObservations === 1 ? '' : 's'}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 font-sans">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${archetype.badgeColor}`}
                        >
                          {archetype.label}
                        </span>
                      </td>

                      <td className="py-4 px-4 font-bold text-emerald-400">
                        {formatLakhs(c.totalPaid)}
                      </td>

                      <td className="py-4 px-4 font-bold text-rose-400">
                        {formatLakhs(c.outstanding)}
                      </td>

                      <td className="py-4 px-4 text-slate-300">
                        {c.avgPaymentDelayDays !== undefined ? `${c.avgPaymentDelayDays} days` : 'Unavailable'}
                      </td>

                      <td className="py-4 px-4">
                        {assessment && assessment.fulfilledPromisesCount + assessment.missedPromisesCount > 0 ? (
                          <div className="flex flex-col">
                            <span className="text-violet-300 font-bold">
                              {assessment.fulfilledPromisesCount} fulfilled
                            </span>
                            {assessment.missedPromisesCount > 0 && (
                              <span className="text-rose-400 text-[10px]">
                                {assessment.missedPromisesCount} missed
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No promise history</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right font-sans">
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          className="bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Memory Profile
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono text-xs">
                    No customer accounts found matching &quot;{behaviorFilter}&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Memory Profile Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#091024] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg font-mono">
                {selectedCustomer.company ? selectedCustomer.company.charAt(0) : 'C'}
              </div>
              <div className="min-w-0 flex-1 pr-8">
                <h2 className="text-xl font-bold text-white truncate">{selectedCustomer.company}</h2>
                <p className="text-xs text-slate-400 truncate">
                  Contact: {selectedCustomer.name} &bull; Email: {selectedCustomer.email} &bull; Phone:{' '}
                  {selectedCustomer.phone || 'Unavailable'}
                </p>
              </div>
            </div>

            {/* Financial Totals */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-mono">Total Invoiced</p>
                <p className="text-sm font-bold text-white font-mono mt-0.5">
                  {formatLakhs(selectedCustomer.totalInvoiced || 0)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <p className="text-[10px] text-emerald-400 uppercase font-mono font-semibold">Total Paid</p>
                <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                  {formatLakhs(selectedCustomer.totalPaid || 0)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <p className="text-[10px] text-rose-400 uppercase font-mono font-semibold">Outstanding</p>
                <p className="text-sm font-bold text-rose-400 font-mono mt-0.5">
                  {formatLakhs(selectedCustomer.outstanding || 0)}
                </p>
              </div>
            </div>

            {/* DEDICATED PAYMENT RELIABILITY & EVIDENCE SECTION */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 text-xs space-y-4 mb-6 font-sans">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Payment Reliability Assessment
                  </h4>
                </div>
                {getReliabilityBadge(selectedAssessment || undefined)}
              </div>

              {/* Underlying Observations Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">
                    Total Events
                  </span>
                  <span className="font-bold text-white text-xs mt-0.5 block">
                    {selectedAssessment?.totalObservations ?? 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">
                    Punctual Settlements
                  </span>
                  <span className="font-bold text-emerald-400 text-xs mt-0.5 block">
                    {selectedAssessment?.onTimePaymentsCount ?? 0} of{' '}
                    {selectedAssessment?.settledInvoicesCount ?? 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">
                    Avg Settlement Delay
                  </span>
                  <span className="font-bold text-amber-400 text-xs mt-0.5 block">
                    {selectedAssessment?.avgPaymentDelayDays
                      ? `${selectedAssessment.avgPaymentDelayDays} days`
                      : '0 days'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">
                    Promises Honored
                  </span>
                  <span className="font-bold text-violet-300 text-xs mt-0.5 block">
                    {selectedAssessment?.fulfilledPromisesCount ?? 0} of{' '}
                    {(selectedAssessment?.fulfilledPromisesCount ?? 0) +
                      (selectedAssessment?.missedPromisesCount ?? 0)}
                  </span>
                </div>
              </div>

              {/* Primary Supporting Factors */}
              {selectedAssessment && selectedAssessment.primaryFactors.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-bold block text-[11px] mb-1.5 uppercase tracking-wider">
                    Grounded Behavioral Evidence:
                  </span>
                  <ul className="space-y-1 list-disc list-inside text-[11px] text-slate-300 leading-relaxed">
                    {selectedAssessment.primaryFactors.map((factor: string, idx: number) => (
                      <li key={idx}>{factor}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Grounded Recommendation */}
              {selectedAssessment && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                  <span className="text-emerald-400 font-bold block text-[11px] mb-0.5">
                    Recommended Credit &amp; Collection Strategy:
                  </span>
                  <p className="leading-relaxed text-[11px]">{selectedAssessment.recommendedAction}</p>
                </div>
              )}

              {/* Open Dispute Context Callout */}
              {selectedAssessment && selectedAssessment.disputedInvoicesCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                  <span className="font-bold flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Active Billing Dispute Notice ({selectedAssessment.disputedInvoicesCount} invoice)
                  </span>
                  <p className="text-amber-200/90 leading-relaxed">
                    Customer has active billing dispute mediation underway. In accordance with financial
                    policy, open billing disputes do not independently reduce customer reliability
                    scores.
                  </p>
                </div>
              )}

              {/* Ledger Policy Notice */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-500 leading-relaxed flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Ledger Truth Policy: Reliability scoring strictly relies on confirmed payments and
                  verified promise outcomes. Unverified claims pending operator review do not count as
                  settlements.
                </span>
              </div>
            </div>

            {/* General Payment Memory Profile */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 text-xs space-y-3 mb-6 font-sans">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-4 h-4 text-violet-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Payment Memory Archetype &amp; Cadence
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase">Payment Archetype</span>
                  <span className="font-semibold text-emerald-400 text-xs mt-0.5 block">
                    {getCustomerArchetype(selectedCustomer).label}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase">Preferred Channel</span>
                  <span className="font-semibold text-white text-xs mt-0.5 block">
                    {selectedCustomer.preferredChannel || 'Email'}
                  </span>
                </div>
              </div>

              {selectedCustomer.typicalBlocker && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-bold block text-[11px] mb-0.5">
                    Typical Blocker / Lag Reason:
                  </span>
                  <p className="text-slate-300 leading-relaxed">{selectedCustomer.typicalBlocker}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close Memory Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
