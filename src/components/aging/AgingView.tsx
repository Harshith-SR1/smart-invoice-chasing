'use client';

import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../layout/PageHeader';
import { isCollectibleStatus } from '../../types';

export const AgingView: React.FC = () => {
  const { invoices, setSelectedInvoice } = useApp();
  const [selectedBucket, setSelectedBucket] = useState<string>('all');

  const uncollectedInvoices = invoices.filter((i) => isCollectibleStatus(i.status));

  const buckets = [
    {
      id: 'current',
      label: 'Current (Not Due)',
      range: 'Not overdue (<= 0 days)',
      color: 'border-slate-700 text-slate-300',
      bgColor: 'bg-slate-900',
      items: uncollectedInvoices.filter((i) => i.daysOverdue <= 0),
    },
    {
      id: 'days1_7',
      label: '1–7 Days Overdue',
      range: '1–7 days',
      color: 'border-teal-500/40 text-teal-400',
      bgColor: 'bg-teal-950/20',
      items: uncollectedInvoices.filter((i) => i.daysOverdue >= 1 && i.daysOverdue <= 7),
    },
    {
      id: 'days8_30',
      label: '8–30 Days Overdue',
      range: '8–30 days',
      color: 'border-amber-500/40 text-amber-400',
      bgColor: 'bg-amber-950/20',
      items: uncollectedInvoices.filter((i) => i.daysOverdue >= 8 && i.daysOverdue <= 30),
    },
    {
      id: 'days31_60',
      label: '31–60 Days Overdue',
      range: '31–60 days',
      color: 'border-orange-500/40 text-orange-400',
      bgColor: 'bg-orange-950/20',
      items: uncollectedInvoices.filter((i) => i.daysOverdue > 30 && i.daysOverdue <= 60),
    },
    {
      id: 'days61_90',
      label: '61–90 Days Overdue',
      range: '61–90 days',
      color: 'border-rose-400/40 text-rose-300',
      bgColor: 'bg-rose-950/20',
      items: uncollectedInvoices.filter((i) => i.daysOverdue > 60 && i.daysOverdue <= 90),
    },
    {
      id: 'days90Plus',
      label: '90+ Days Overdue',
      range: '90+ days (Urgent)',
      color: 'border-rose-500 text-rose-400',
      bgColor: 'bg-rose-950/40',
      items: uncollectedInvoices.filter((i) => i.daysOverdue > 90),
    },
  ];

  const activeBucketObj = buckets.find((b) => b.id === selectedBucket);
  const displayedInvoices = selectedBucket === 'all' ? uncollectedInvoices : activeBucketObj?.items || [];

  const totalOutstanding = uncollectedInvoices.reduce((sum, i) => sum + (i.outstandingAmount !== undefined ? i.outstandingAmount : Math.max(0, i.amount - (i.paidAmount || 0))), 0);

  return (
    <div className="space-y-4 p-6 max-w-7xl mx-auto font-sans">
      {/* Shared Page Context Header */}
      <PageHeader
        title="Receivables Aging"
        subtitle="See outstanding invoices grouped by payment age and urgency."
      />

      {/* Bucket KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <button
          onClick={() => setSelectedBucket('all')}
          className={`p-4 rounded-2xl border text-left transition ${
            selectedBucket === 'all'
              ? 'border-emerald-500 bg-emerald-500/10 text-white'
              : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] font-mono uppercase font-bold text-slate-400">All Outstanding</div>
          <div className="text-lg font-black font-mono text-white mt-1">
            ₹{(totalOutstanding / 100000).toFixed(2)}L
          </div>
          <div className="text-[11px] mt-1 text-slate-400">{uncollectedInvoices.length} invoices</div>
        </button>

        {buckets.map((b) => {
          const totalAmt = b.items.reduce((s, i) => s + (i.outstandingAmount !== undefined ? i.outstandingAmount : Math.max(0, i.amount - (i.paidAmount || 0))), 0);
          const isSelected = selectedBucket === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setSelectedBucket(b.id)}
              className={`p-4 rounded-2xl border text-left transition ${b.bgColor} ${
                isSelected ? 'ring-2 ring-emerald-500 border-emerald-500' : b.color
              }`}
            >
              <div className="text-[10px] font-mono uppercase font-bold">{b.label}</div>
              <div className="text-lg font-black font-mono text-white mt-1">
                ₹{(totalAmt / 100000).toFixed(2)}L
              </div>
              <div className="text-[11px] mt-1 text-slate-400">{b.items.length} invoices</div>
            </button>
          );
        })}
      </div>

      {/* Invoices Table for Selected Bucket */}
      <div className="rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-base font-bold text-white uppercase tracking-wider">
            {selectedBucket === 'all' ? 'All Aging Invoices' : `${activeBucketObj?.label} Invoices`}
          </h2>
          <span className="text-xs font-mono text-slate-400">{displayedInvoices.length} accounts listed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Overdue Days</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {displayedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-900/40 transition">
                  <td className="py-4 px-4 font-bold text-emerald-400">{inv.invoiceNumber}</td>
                  <td className="py-4 px-4 font-sans font-bold text-slate-100">{inv.customerName}</td>
                  <td className="py-4 px-4 font-bold text-white">
                    {inv.currency} {(inv.outstandingAmount !== undefined ? inv.outstandingAmount : Math.max(0, inv.amount - (inv.paidAmount || 0))).toLocaleString()}
                    {((inv.outstandingAmount !== undefined && inv.outstandingAmount !== inv.amount) || (inv.paidAmount && inv.paidAmount > 0)) && (
                      <div className="text-[10px] text-slate-400 font-normal">Total: {inv.currency} {inv.amount.toLocaleString()}</div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-400 text-[11px]">{inv.dueDate}</td>
                  <td className="py-4 px-4">
                    <span className={inv.daysOverdue > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      {inv.daysOverdue > 0 ? `${inv.daysOverdue} days` : 'On Schedule'}
                    </span>
                  </td>
                  <td className="py-4 px-4 uppercase text-[10px] font-bold text-amber-400">{inv.status}</td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-sans font-semibold transition inline-flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
