'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  UserX,
  Users,
  HelpCircle,
  TrendingDown,
  Sparkles,
  Info,
  Check,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../layout/PageHeader';
import { Invoice, Customer, isCollectibleStatus, CustomerReliabilityAssessment } from '../../types';
import {
  computeCustomerPaymentReliability,
} from '../../lib/decisionEngine';

export const PaymentRiskView: React.FC = () => {
  const router = useRouter();
  const {
    invoices,
    customers,
    promises,
    setSelectedInvoice,
    setSelectedCustomer,
    showToast,
    searchQuery,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'customers' | 'invoices'>('customers');
  const [customerFilter, setCustomerFilter] = useState<
    'all' | 'reliable' | 'moderate' | 'elevated' | 'insufficient'
  >('all');
  const [riskFilter, setRiskFilter] = useState<
    'all' | 'critical' | 'high' | 'watch' | 'broken_promise'
  >('all');

  // Synthesize complete customer portfolio across customer records and invoice metadata
  const allWorkspaceCustomers = useMemo(() => {
    const custMap = new Map<string, Customer>();
    (customers || []).forEach((c) => {
      custMap.set(c.id, c);
    });
    (invoices || []).forEach((inv) => {
      const cId = inv.customerId || inv.customerName;
      if (cId && !custMap.has(cId)) {
        custMap.set(cId, {
          id: cId,
          name: inv.customerName || 'Customer',
          company: inv.customerName || 'Company',
          email: inv.customerEmail || '',
          totalInvoiced: inv.amount,
          totalPaid: inv.paidAmount || 0,
          outstanding: inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount,
          avgPaymentDelayDays: inv.daysOverdue || 0,
          overdueInvoicesCount: inv.daysOverdue > 0 ? 1 : 0,
          remindersSentCount: inv.remindersSent || 0,
          paymentPromisesCount: inv.paymentPromisesCount || 0,
          missedPromisesCount: inv.missedPromisesCount || 0,
          status: 'active',
          firstInvoicedDate: inv.issueDate || '2026-01-01',
        });
      }
    });
    return Array.from(custMap.values());
  }, [customers, invoices]);

  // Compute Grounded, Deterministic Customer Reliability Assessments
  const customerAssessments: CustomerReliabilityAssessment[] = useMemo(() => {
    return allWorkspaceCustomers.map((c) => {
      return computeCustomerPaymentReliability(c, invoices, promises);
    });
  }, [allWorkspaceCustomers, invoices, promises]);

  // Filtered Customer Assessments
  const filteredCustomerAssessments = useMemo(() => {
    return customerAssessments.filter((a) => {
      const q = searchQuery.toLowerCase();
      if (
        q &&
        !a.customerName.toLowerCase().includes(q) &&
        !(a.company || '').toLowerCase().includes(q)
      ) {
        return false;
      }

      if (customerFilter === 'reliable') return a.tier === 'RELIABLE';
      if (customerFilter === 'moderate') return a.tier === 'MODERATE';
      if (customerFilter === 'elevated') return a.tier === 'ELEVATED';
      if (customerFilter === 'insufficient') return a.tier === 'INSUFFICIENT_HISTORY';
      return true;
    }).sort((a, b) => {
      // Sort: Elevated risk first, then lowest score, then insufficient history
      if (a.tier === 'ELEVATED' && b.tier !== 'ELEVATED') return -1;
      if (b.tier === 'ELEVATED' && a.tier !== 'ELEVATED') return 1;
      if (a.score !== null && b.score !== null) return a.score - b.score;
      if (a.score === null && b.score !== null) return 1;
      if (b.score === null && a.score !== null) return -1;
      return b.totalOutstanding - a.totalOutstanding;
    });
  }, [customerAssessments, customerFilter, searchQuery]);

  // Filter uncollected invoices with tactical risk weighting
  const riskInvoices = useMemo(() => {
    return invoices
      .filter((i) => {
        if (i.status === 'paid') return false;
        const q = searchQuery.toLowerCase();
        if (
          q &&
          !i.customerName.toLowerCase().includes(q) &&
          !i.invoiceNumber.toLowerCase().includes(q)
        ) {
          return false;
        }

        if (riskFilter === 'critical') return i.status === 'escalated' || i.daysOverdue > 80;
        if (riskFilter === 'high')
          return (
            (i.daysOverdue > 60 || i.healthCategory === 'high_risk') && i.status !== 'escalated'
          );
        if (riskFilter === 'watch')
          return i.daysOverdue > 15 && i.daysOverdue <= 60 && i.healthCategory !== 'high_risk';
        if (riskFilter === 'broken_promise') return i.missedPromisesCount > 0;
        return true;
      })
      .sort((a, b) => {
        if (a.status === 'escalated' && b.status !== 'escalated') return -1;
        if (b.status === 'escalated' && a.status !== 'escalated') return 1;
        if (a.missedPromisesCount > 0 && b.missedPromisesCount === 0) return -1;
        if (b.missedPromisesCount > 0 && a.missedPromisesCount === 0) return 1;
        return b.daysOverdue - a.daysOverdue;
      });
  }, [invoices, riskFilter, searchQuery]);

  // Financial aggregates for risk overview
  const totalCapitalAtRisk = useMemo(() => {
    return invoices.filter((i) => isCollectibleStatus(i.status) && (i.daysOverdue > 30 || i.status === 'escalated' || i.healthCategory === 'high_risk'))
      .reduce(
        (sum, i) =>
          sum +
          (i.outstandingAmount !== undefined
            ? i.outstandingAmount
            : Math.max(0, i.amount - (i.paidAmount || 0))),
        0
      );
  }, [invoices]);

  const reliableCount = useMemo(() => {
    return customerAssessments.filter((c) => c.tier === 'RELIABLE').length;
  }, [customerAssessments]);

  const elevatedCount = useMemo(() => {
    return customerAssessments.filter((c) => c.tier === 'ELEVATED').length;
  }, [customerAssessments]);

  const insufficientCount = useMemo(() => {
    return customerAssessments.filter((c) => c.tier === 'INSUFFICIENT_HISTORY').length;
  }, [customerAssessments]);

  const formatLakhs = (amt: number) => {
    if (amt >= 100000) {
      return `₹${(amt / 100000).toFixed(2)}L`;
    }
    if (amt >= 1000) {
      return `₹${(amt / 1000).toFixed(1)}K`;
    }
    return `₹${Math.round(amt)}`;
  };

  const getTierBadge = (assessment: CustomerReliabilityAssessment) => {
    if (assessment.tier === 'RELIABLE') {
      return (
        <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 w-fit">
          <Check className="w-3 h-3 text-emerald-400" />
          HIGH RELIABILITY ({assessment.score}/100)
        </span>
      );
    }
    if (assessment.tier === 'MODERATE') {
      return (
        <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 w-fit">
          <Clock className="w-3 h-3 text-amber-400" />
          MODERATE ({assessment.score}/100)
        </span>
      );
    }
    if (assessment.tier === 'ELEVATED') {
      return (
        <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 w-fit">
          <AlertTriangle className="w-3 h-3 text-rose-400" />
          ELEVATED RISK ({assessment.score}/100)
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5 w-fit">
        <HelpCircle className="w-3 h-3 text-slate-500" />
        INSUFFICIENT HISTORY
      </span>
    );
  };

  const getRiskBadge = (inv: Invoice) => {
    if (inv.status === 'escalated' || inv.daysOverdue > 80) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
          CRITICAL RISK
        </span>
      );
    }
    if (inv.daysOverdue > 60 || inv.healthCategory === 'high_risk' || inv.missedPromisesCount > 0) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
          HIGH RISK
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-yellow-500/10 text-yellow-300 border border-yellow-500/30 uppercase">
        WATCH LIST
      </span>
    );
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto font-sans text-slate-100">
      {/* Shared Page Context Header */}
      <PageHeader
        title="Customer Payment Reliability & Risk Intelligence"
        subtitle="Explainable, grounded behavioral scoring derived from verified settlement punctuality, promise fulfillment history, and exposure."
        badge="Reliability Model"
        badgeColor="rose"
      />

      {/* Risk Metrics Overview Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-rose-500/30 flex flex-col justify-between">
          <span className="text-[10px] text-rose-400 uppercase font-mono font-bold tracking-wider">
            Capital at Elevated Risk
          </span>
          <div className="my-2">
            <span className="text-2xl font-black text-rose-400 font-mono">
              {formatLakhs(totalCapitalAtRisk)}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Accounts past 30+ days overdue</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-emerald-500/30 flex flex-col justify-between">
          <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold tracking-wider">
            High Reliability Accounts
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white font-mono">{reliableCount}</span>
          </div>
          <span className="text-[10px] text-emerald-400/80">Score ≥ 80; verified on-time track record</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-rose-500/30 flex flex-col justify-between">
          <span className="text-[10px] text-rose-400 uppercase font-mono font-bold tracking-wider">
            Elevated Risk Accounts
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-rose-400 font-mono">{elevatedCount}</span>
          </div>
          <span className="text-[10px] text-rose-300/80">Score &lt; 50 or repeated missed promises</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">
            Insufficient History
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white font-mono">{insufficientCount}</span>
          </div>
          <span className="text-[10px] text-slate-400">&lt; 2 completed transaction observations</span>
        </div>
      </div>

      {/* Main View Switcher Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'customers'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Customer Reliability Scoring ({customerAssessments.length})
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'invoices'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Invoice Exposure &amp; Bottlenecks ({riskInvoices.length})
        </button>
      </div>

      {activeTab === 'customers' ? (
        /* CUSTOMER RELIABILITY TAB */
        <div className="space-y-4">
          {/* Customer Filter Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 text-xs font-mono font-bold">
              {[
                { id: 'all', label: 'All Accounts' },
                { id: 'reliable', label: 'High Reliability (80–100)' },
                { id: 'moderate', label: 'Moderate (50–79)' },
                { id: 'elevated', label: 'Elevated Risk (<50)' },
                { id: 'insufficient', label: 'Insufficient History' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCustomerFilter(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl transition whitespace-nowrap cursor-pointer ${
                    customerFilter === tab.id
                      ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-400 font-mono">
              Showing {filteredCustomerAssessments.length} of {customerAssessments.length} accounts
            </span>
          </div>

          {/* Customer Reliability Table */}
          <div className="rounded-3xl bg-[#111936]/90 border border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 font-semibold border-b border-white/10 uppercase tracking-wider text-[10px] font-mono">
                    <th className="py-4 px-6">Customer &amp; Company</th>
                    <th className="py-4 px-4">Reliability Tier &amp; Score</th>
                    <th className="py-4 px-4">Verified Evidence</th>
                    <th className="py-4 px-4">Primary Supporting Factors</th>
                    <th className="py-4 px-4">Outstanding Exposure</th>
                    <th className="py-4 px-4">Recommended Strategy</th>
                    <th className="py-4 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {filteredCustomerAssessments.length > 0 ? (
                    filteredCustomerAssessments.map((assessment) => (
                      <tr key={assessment.customerId} className="hover:bg-white/[0.02] transition">
                        <td className="py-4 px-6">
                          <div className="font-bold text-white font-sans text-sm">
                            {assessment.customerName}
                          </div>
                          {assessment.company && (
                            <div className="text-[11px] text-slate-400">{assessment.company}</div>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          {getTierBadge(assessment)}
                        </td>

                        <td className="py-4 px-4 font-sans text-xs text-slate-300">
                          <div className="space-y-0.5">
                            <span className="block font-medium">
                              {assessment.settledInvoicesCount > 0
                                ? `${assessment.onTimePaymentsCount}/${assessment.settledInvoicesCount} on-time payments`
                                : '0 settled invoices'}
                            </span>
                            <span className="block text-[11px] text-slate-400 font-mono">
                              {assessment.fulfilledPromisesCount + assessment.missedPromisesCount > 0
                                ? `${assessment.fulfilledPromisesCount} fulfilled / ${assessment.missedPromisesCount} missed promises`
                                : 'No promise history'}
                            </span>
                            <span className="block text-[10px] text-slate-500 font-mono">
                              {assessment.totalObservations} completed observations
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 font-sans text-xs text-slate-300 max-w-xs">
                          <ul className="space-y-1 list-disc list-inside text-[11px] text-slate-400 leading-relaxed">
                            {assessment.primaryFactors.slice(0, 2).map((factor: string, idx: number) => (
                              <li key={idx} className="truncate" title={factor}>
                                {factor}
                              </li>
                            ))}
                          </ul>
                        </td>

                        <td className="py-4 px-4 font-bold text-white font-mono text-sm">
                          {formatLakhs(assessment.totalOutstanding)}
                        </td>

                        <td className="py-4 px-4 font-sans text-xs text-slate-300 max-w-xs">
                          <span className="text-[11px] leading-relaxed text-slate-400 block">
                            {assessment.recommendedAction}
                          </span>
                        </td>

                        <td className="py-4 px-6 text-right font-sans">
                          <button
                            onClick={() => {
                              showToast(`Loaded reliability profile for ${assessment.customerName}`, 'info');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                          >
                            Inspect Profile
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                        No customer accounts found matching &quot;{customerFilter}&quot;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* INVOICE EXPOSURE TAB */
        <div className="space-y-4">
          {/* Invoice Filter Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'critical', 'high', 'watch', 'broken_promise'] as const).map((tabKey) => (
                <button
                  key={tabKey}
                  onClick={() => setRiskFilter(tabKey)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap cursor-pointer ${
                    riskFilter === tabKey
                      ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tabKey === 'all'
                    ? 'All Risk Accounts'
                    : tabKey === 'critical'
                    ? 'Critical Escalated'
                    : tabKey === 'high'
                    ? 'High Risk'
                    : tabKey === 'watch'
                    ? 'Watch List'
                    : 'Broken Promises'}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-400 font-mono">
              Showing {riskInvoices.length} {riskInvoices.length === 1 ? 'account' : 'accounts'}
            </span>
          </div>

          {/* Invoice Risk Table */}
          <div className="rounded-3xl bg-[#111936]/90 border border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 font-semibold border-b border-white/10 uppercase tracking-wider text-[10px] font-mono">
                    <th className="py-4 px-6">Customer &amp; Invoice</th>
                    <th className="py-4 px-4">Outstanding</th>
                    <th className="py-4 px-4">Overdue</th>
                    <th className="py-4 px-4">Risk Level</th>
                    <th className="py-4 px-4">Risk Factors &amp; Grounded Evidence</th>
                    <th className="py-4 px-4">Recommended Mitigation</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {riskInvoices.map((inv) => {
                    const outstanding =
                      inv.outstandingAmount !== undefined
                        ? inv.outstandingAmount
                        : Math.max(0, inv.amount - (inv.paidAmount || 0));
                    return (
                      <tr key={inv.id} className="hover:bg-white/[0.02] transition">
                        <td className="py-4 px-6">
                          <div className="font-bold text-white font-sans text-sm">
                            {inv.customerName}
                          </div>
                          <div className="text-[11px] text-slate-400">{inv.invoiceNumber}</div>
                        </td>

                        <td className="py-4 px-4 font-bold text-white font-mono text-sm">
                          {formatLakhs(outstanding)}
                        </td>

                        <td className="py-4 px-4 text-rose-400 font-bold">
                          {inv.daysOverdue > 0 ? `${inv.daysOverdue} days` : 'Due soon'}
                        </td>

                        <td className="py-4 px-4">{getRiskBadge(inv)}</td>

                        <td className="py-4 px-4 font-sans text-xs text-[#9AA5C2] max-w-xs">
                          <div className="space-y-0.5">
                            <span className="text-slate-300 block font-medium">
                              {inv.healthReasons?.[0] ||
                                (inv.daysOverdue > 60
                                  ? 'Extended overdue duration'
                                  : 'Approaching aging threshold')}
                            </span>
                            {inv.missedPromisesCount > 0 && (
                              <span className="text-rose-400 text-[10px] block font-mono">
                                ⚠ Missed {inv.missedPromisesCount} promised payment deadline
                              </span>
                            )}
                            {inv.lastCustomerReply && (
                              <span className="text-slate-400 text-[11px] italic block truncate">
                                &quot;{inv.lastCustomerReply}&quot;
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-4 font-sans text-xs text-amber-300 max-w-xs">
                          {inv.status === 'escalated'
                            ? 'Direct phone call to founder / finance contact'
                            : inv.missedPromisesCount > 0
                            ? 'Demand revised payment date with firm deadline'
                            : inv.aiRecommendation?.description ||
                              'Send firm payment-date request'}
                        </td>

                        <td className="py-4 px-6 text-right font-sans">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                            >
                              Review Case
                            </button>
                            <button
                              onClick={() => {
                                if (inv.status === 'escalated') {
                                  showToast(
                                    `Escalation call logged for ${inv.customerName}`,
                                    'info'
                                  );
                                } else {
                                  showToast(
                                    `Risk follow-up triggered for ${inv.customerName}`,
                                    'success'
                                  );
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer text-slate-950 ${
                                inv.status === 'escalated'
                                  ? 'bg-rose-500 hover:bg-rose-400'
                                  : 'bg-amber-400 hover:bg-amber-300'
                              }`}
                            >
                              {inv.status === 'escalated' ? 'Log Call' : 'Demand Date'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
