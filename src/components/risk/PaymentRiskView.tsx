'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  PhoneCall,
  Send,
  Eye,
  CheckCircle2,
  Filter,
  ArrowRight,
  TrendingDown,
  ChevronRight,
  UserX,
  FileWarning,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../layout/PageHeader';
import { Invoice } from '../../types';

export const PaymentRiskView: React.FC = () => {
  const router = useRouter();
  const { invoices, customers, setSelectedInvoice, setSelectedCustomer, showToast, searchQuery } = useApp();
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high' | 'watch' | 'broken_promise'>('all');

  // Filter uncollected invoices with risk weighting
  const riskInvoices = useMemo(() => {
    return invoices.filter((i) => {
      if (i.status === 'paid') return false;
      const q = searchQuery.toLowerCase();
      if (q && !i.customerName.toLowerCase().includes(q) && !i.invoiceNumber.toLowerCase().includes(q)) {
        return false;
      }

      if (riskFilter === 'critical') return i.status === 'escalated' || i.daysOverdue > 80;
      if (riskFilter === 'high') return (i.daysOverdue > 60 || i.healthCategory === 'high_risk') && i.status !== 'escalated';
      if (riskFilter === 'watch') return i.daysOverdue > 15 && i.daysOverdue <= 60 && i.healthCategory !== 'high_risk';
      if (riskFilter === 'broken_promise') return i.missedPromisesCount > 0;
      return true;
    }).sort((a, b) => {
      // Prioritize escalated > long overdue > broken promise > high amount
      if (a.status === 'escalated' && b.status !== 'escalated') return -1;
      if (b.status === 'escalated' && a.status !== 'escalated') return 1;
      if (a.missedPromisesCount > 0 && b.missedPromisesCount === 0) return -1;
      if (b.missedPromisesCount > 0 && a.missedPromisesCount === 0) return 1;
      return b.daysOverdue - a.daysOverdue;
    });
  }, [invoices, riskFilter, searchQuery]);

  // Financial aggregates for risk overview
  const totalCapitalAtRisk = useMemo(() => {
    return invoices
      .filter((i) => i.status !== 'paid' && (i.daysOverdue > 30 || i.status === 'escalated' || i.healthCategory === 'high_risk'))
      .reduce((sum, i) => sum + (i.outstandingAmount !== undefined ? i.outstandingAmount : i.amount), 0);
  }, [invoices]);

  const criticalCasesCount = useMemo(() => {
    return invoices.filter((i) => i.status === 'escalated' || i.daysOverdue > 80).length;
  }, [invoices]);

  const brokenPromisesCount = useMemo(() => {
    return invoices.filter((i) => i.missedPromisesCount > 0).length;
  }, [invoices]);

  const watchCount = useMemo(() => {
    return invoices.filter((i) => i.status !== 'paid' && i.daysOverdue > 15 && i.daysOverdue <= 60).length;
  }, [invoices]);

  const formatLakhs = (amt: number) => {
    if (amt >= 100000) {
      return `₹${(amt / 100000).toFixed(2)}L`;
    }
    if (amt >= 1000) {
      return `₹${(amt / 1000).toFixed(1)}K`;
    }
    return `₹${Math.round(amt)}`;
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
        title="Payment Risk Assessment"
        subtitle="Which accounts need attention: elevated default risk, broken commitments, and severe collection bottlenecks."
        badge="Risk Intelligence"
        badgeColor="rose"
      />

      {/* Risk Metrics Overview Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-rose-500/30 flex flex-col justify-between">
          <span className="text-[10px] text-rose-400 uppercase font-mono font-bold tracking-wider">Capital at Elevated Risk</span>
          <div className="my-2">
            <span className="text-2xl font-black text-rose-400 font-mono">{formatLakhs(totalCapitalAtRisk)}</span>
          </div>
          <span className="text-[10px] text-slate-400">Accounts past 30+ days overdue</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-rose-300 uppercase font-mono font-bold tracking-wider">Critical Escalations</span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white font-mono">{criticalCasesCount}</span>
          </div>
          <span className="text-[10px] text-slate-400">Requires manual phone outreach</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-[#FFB84D] uppercase font-mono font-bold tracking-wider">Broken Promises</span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-[#FFB84D] font-mono">{brokenPromisesCount}</span>
          </div>
          <span className="text-[10px] text-slate-400">Target payment dates missed</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-yellow-400 uppercase font-mono font-bold tracking-wider">Accounts on Watch</span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white font-mono">{watchCount}</span>
          </div>
          <span className="text-[10px] text-slate-400">15–60 days overdue monitoring</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
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

      {/* Risk Table */}
      <div className="rounded-3xl bg-[#111936]/90 border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 font-semibold border-b border-white/10 uppercase tracking-wider text-[10px] font-mono">
                <th className="py-4 px-6">Customer & Invoice</th>
                <th className="py-4 px-4">Outstanding</th>
                <th className="py-4 px-4">Overdue</th>
                <th className="py-4 px-4">Risk Level</th>
                <th className="py-4 px-4">Risk Factors & Grounded Evidence</th>
                <th className="py-4 px-4">Recommended Mitigation</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {riskInvoices.map((inv) => {
                const outstanding = inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount;
                return (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-4 px-6">
                      <div className="font-bold text-white font-sans text-sm">{inv.customerName}</div>
                      <div className="text-[11px] text-slate-400">{inv.invoiceNumber}</div>
                    </td>

                    <td className="py-4 px-4 font-bold text-white font-mono text-sm">
                      {formatLakhs(outstanding)}
                    </td>

                    <td className="py-4 px-4 text-rose-400 font-bold">
                      {inv.daysOverdue > 0 ? `${inv.daysOverdue} days` : 'Due soon'}
                    </td>

                    <td className="py-4 px-4">
                      {getRiskBadge(inv)}
                    </td>

                    <td className="py-4 px-4 font-sans text-xs text-[#9AA5C2] max-w-xs">
                      <div className="space-y-0.5">
                        <span className="text-slate-300 block font-medium">
                          {inv.healthReasons?.[0] || (inv.daysOverdue > 60 ? 'Extended overdue duration' : 'Approaching aging threshold')}
                        </span>
                        {inv.missedPromisesCount > 0 && (
                          <span className="text-rose-400 text-[10px] block font-mono">
                            ⚠ Missed {inv.missedPromisesCount} promised payment deadline
                          </span>
                        )}
                        {inv.lastCustomerReply && (
                          <span className="text-slate-400 text-[11px] italic block truncate">
                            "{inv.lastCustomerReply}"
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 font-sans text-xs text-amber-300 max-w-xs">
                      {inv.status === 'escalated'
                        ? 'Direct phone call to founder / finance contact'
                        : inv.missedPromisesCount > 0
                        ? 'Demand revised payment date with firm deadline'
                        : inv.aiRecommendation?.description || 'Send firm payment-date request'}
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
                              showToast(`Escalation call logged for ${inv.customerName}`, 'info');
                            } else {
                              showToast(`Risk follow-up triggered for ${inv.customerName}`, 'success');
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer text-slate-950 ${
                            inv.status === 'escalated' ? 'bg-rose-500 hover:bg-rose-400' : 'bg-amber-400 hover:bg-amber-300'
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
  );
};
