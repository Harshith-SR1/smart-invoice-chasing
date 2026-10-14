'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../layout/PageHeader';

export const ActivityFeedView: React.FC = () => {
  const { invoices } = useApp();

  const allEvents = invoices
    .flatMap((inv) =>
      (inv.timeline || []).map((evt) => ({
        ...evt,
        customerName: inv.customerName,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount,
        currency: inv.currency,
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-4 p-6 max-w-7xl mx-auto font-sans">
      {/* Shared Page Context Header */}
      <PageHeader
        title="Activity"
        subtitle="Track collection actions, customer replies, AI decisions, promises, and payments."
      />

      {/* Activity Timeline List */}
      <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl space-y-4">
        <div className="space-y-3 font-mono text-xs">
          {allEvents.length > 0 ? (
            allEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 shrink-0">
                    <Clock className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{evt.customerName}</span>
                      <span className="text-[11px] text-slate-400 font-mono">({evt.invoiceNumber})</span>
                      {evt.badge && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {evt.badge}
                        </span>
                      )}
                    </div>
                    <div className="font-sans text-xs text-slate-300 font-semibold">{evt.title}</div>
                    <div className="font-sans text-xs text-slate-400">{evt.description}</div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                  <span className="text-white font-extrabold font-mono text-sm">
                    {evt.currency} {evt.amount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500">{new Date(evt.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              No activity events recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
