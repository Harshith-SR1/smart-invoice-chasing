'use client';

import React, { useState, useMemo } from 'react';
import { Eye, X, Brain } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../layout/PageHeader';
import { Customer } from '../../types';

export const CustomerDirectoryView: React.FC = () => {
  const { customers, selectedCustomer, setSelectedCustomer, searchQuery } = useApp();
  const [behaviorFilter, setBehaviorFilter] = useState<'all' | 'prompt' | 'late' | 'promise_keeper' | 'risk'>('all');

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

      if (behaviorFilter === 'prompt') return c.avgPaymentDelayDays <= 7 && c.missedPromisesCount === 0;
      if (behaviorFilter === 'late') return c.avgPaymentDelayDays > 25;
      if (behaviorFilter === 'promise_keeper') return c.paymentPromisesCount > 0 && c.missedPromisesCount === 0;
      if (behaviorFilter === 'risk') return c.status === 'high_risk' || c.missedPromisesCount > 0;

      return true;
    });
  }, [customers, searchQuery, behaviorFilter]);

  const promptCount = useMemo(() => customers.filter((c) => c.avgPaymentDelayDays <= 7 && c.missedPromisesCount === 0).length, [customers]);
  const lateCount = useMemo(() => customers.filter((c) => c.avgPaymentDelayDays > 25).length, [customers]);
  const promiseKeeperCount = useMemo(() => customers.filter((c) => c.paymentPromisesCount > 0 && c.missedPromisesCount === 0).length, [customers]);

  const formatLakhs = (amt: number) => {
    if (amt >= 100000) {
      return `₹${(amt / 100000).toFixed(2)}L`;
    }
    if (amt >= 1000) {
      return `₹${(amt / 1000).toFixed(1)}K`;
    }
    return `₹${Math.round(amt)}`;
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto font-sans text-slate-100">
      {/* Shared Page Context Header */}
      <PageHeader
        title="Customer Payment Intelligence"
        subtitle="Customer payment memory, average turnaround delay, promise reliability, and typical payment blockers."
        badge="Customer Memory"
        badgeColor="emerald"
      />

      {/* Customer Intelligence KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">Total Customer Accounts</span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white font-mono">{customers.length}</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold">Tracked in payment memory</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold tracking-wider">Prompt Payers</span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-emerald-400 font-mono">{promptCount}</span>
          </div>
          <span className="text-[10px] text-slate-400">Average delay ≤ 7 days</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-[#8B7CFF] uppercase font-mono font-bold tracking-wider">Promise Keepers</span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-[#8B7CFF] font-mono">{promiseKeeperCount}</span>
          </div>
          <span className="text-[10px] text-slate-400">High promise reliability</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-[#FFB84D] uppercase font-mono font-bold tracking-wider">Chronic Delay Accounts</span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-[#FFB84D] font-mono">{lateCount}</span>
          </div>
          <span className="text-[10px] text-slate-400">Average delay &gt; 25 days</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'prompt', 'promise_keeper', 'late', 'risk'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setBehaviorFilter(tabKey)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap cursor-pointer ${
                behaviorFilter === tabKey
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tabKey === 'all'
                ? 'All Customers'
                : tabKey === 'prompt'
                ? 'Prompt Payers'
                : tabKey === 'promise_keeper'
                ? 'Promise Keepers'
                : tabKey === 'late'
                ? 'Chronic Late Payers'
                : 'High Risk'}
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
                <th className="py-4 px-6">Customer & Company</th>
                <th className="py-4 px-4">Payment Behavior Archetype</th>
                <th className="py-4 px-4">Typical Blocker</th>
                <th className="py-4 px-4">Total Paid</th>
                <th className="py-4 px-4">Outstanding</th>
                <th className="py-4 px-4">Avg Delay</th>
                <th className="py-4 px-4">Promise Reliability</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredCustomers.map((c) => {
                const archetype = getCustomerArchetype(c);
                return (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-4 px-6">
                      <div className="font-bold text-white font-sans text-sm">{c.company}</div>
                      <div className="text-[11px] text-slate-400">{c.name} &bull; {c.email}</div>
                    </td>

                    <td className="py-4 px-4 font-sans">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${archetype.badgeColor}`}>
                        {archetype.label}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-sans text-slate-300 text-[11px] max-w-xs truncate">
                      {c.typicalBlocker || 'Standard invoice approval'}
                    </td>

                    <td className="py-4 px-4 font-bold text-emerald-400">
                      {formatLakhs(c.totalPaid)}
                    </td>

                    <td className="py-4 px-4 font-bold text-rose-400">
                      {formatLakhs(c.outstanding)}
                    </td>

                    <td className="py-4 px-4 text-slate-300">
                      {c.avgPaymentDelayDays} days
                    </td>

                    <td className="py-4 px-4">
                      <span className="text-violet-300 font-bold">
                        {c.promiseReliability !== undefined ? `${c.promiseReliability}%` : '75%'}
                      </span>
                      {c.missedPromisesCount > 0 && (
                        <span className="text-rose-400 font-normal ml-1">({c.missedPromisesCount} broken)</span>
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
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Memory Profile Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#091024] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg font-mono">
                {selectedCustomer.company.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{selectedCustomer.company}</h2>
                <p className="text-xs text-slate-400">
                  Primary Contact: {selectedCustomer.name} &bull; Email: {selectedCustomer.email} &bull; Phone: {selectedCustomer.phone || 'N/A'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-mono">Total Invoiced</p>
                <p className="text-sm font-bold text-white font-mono mt-0.5">{formatLakhs(selectedCustomer.totalInvoiced)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <p className="text-[10px] text-emerald-400 uppercase font-mono font-semibold">Total Paid</p>
                <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">{formatLakhs(selectedCustomer.totalPaid)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <p className="text-[10px] text-rose-400 uppercase font-mono font-semibold">Outstanding</p>
                <p className="text-sm font-bold text-rose-400 font-mono mt-0.5">{formatLakhs(selectedCustomer.outstanding)}</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs space-y-3 mb-6 font-sans">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-4 h-4 text-violet-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Payment Memory Diagnosis</h4>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase">Payment Behavior</span>
                  <span className="font-semibold text-emerald-400 text-xs mt-0.5 block">{getCustomerArchetype(selectedCustomer).label}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase">Average Delay</span>
                  <span className="font-mono font-bold text-amber-400 text-xs mt-0.5 block">{selectedCustomer.avgPaymentDelayDays} days past due</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase">Preferred Channel</span>
                  <span className="font-semibold text-white text-xs mt-0.5 block">{selectedCustomer.preferredChannel || 'Email'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase">Promise Reliability</span>
                  <span className="font-mono font-bold text-violet-300 text-xs mt-0.5 block">
                    {selectedCustomer.promiseReliability !== undefined ? `${selectedCustomer.promiseReliability}%` : '75%'} ({selectedCustomer.paymentPromisesCount} promises)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-bold block text-[11px] mb-0.5">Typical Blocker / Lag Reason:</span>
                <p className="text-slate-300 leading-relaxed">{selectedCustomer.typicalBlocker || 'Internal finance approval cycle'}</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                <span className="text-emerald-400 font-bold block text-[11px] mb-0.5">AI Recommendation for Operator:</span>
                <p className="leading-relaxed">
                  {selectedCustomer.typicalBlocker
                    ? `Request a committed payment date rather than generic reminder; account for ${selectedCustomer.avgPaymentDelayDays} days approval lag.`
                    : 'Maintain regular structured cadence over ' + (selectedCustomer.preferredChannel || 'Email') + '.'}
                </p>
              </div>
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
