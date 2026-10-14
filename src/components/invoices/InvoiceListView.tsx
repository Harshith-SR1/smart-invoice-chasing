'use client';

import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Invoice } from '../../types';
import { MarkAsPaidModal } from '../common/MarkAsPaidModal';
import { PageHeader } from '../layout/PageHeader';

export const InvoiceListView: React.FC = () => {
  const {
    invoices,
    activeInvoiceFilter,
    setActiveInvoiceFilter,
    setSelectedInvoice,
    searchQuery,
    setSearchQuery,
    setActiveScreen,
  } = useApp();

  const [markingPaidInvoice, setMarkingPaidInvoice] = useState<Invoice | null>(null);

  const filterOptions = [
    'All',
    'Due Soon',
    'Overdue',
    'Chasing',
    'Promised',
    'Disputed',
    'Partially Paid',
    'Paid',
    'Escalated',
  ];

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerEmail.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeInvoiceFilter === 'All') return true;
    if (activeInvoiceFilter === 'Overdue') return inv.status === 'overdue';
    if (activeInvoiceFilter === 'Chasing') return inv.status === 'chasing';
    if (activeInvoiceFilter === 'Promised') return inv.status === 'promised';
    if (activeInvoiceFilter === 'Disputed') return inv.status === 'disputed';
    if (activeInvoiceFilter === 'Partially Paid') return inv.status === 'partially_paid';
    if (activeInvoiceFilter === 'Paid') return inv.status === 'paid';
    if (activeInvoiceFilter === 'Escalated') return inv.status === 'escalated';
    if (activeInvoiceFilter === 'Due Soon') return inv.daysOverdue <= 0 && inv.status !== 'paid';
    return true;
  });

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto font-sans">
      <MarkAsPaidModal invoice={markingPaidInvoice} onClose={() => setMarkingPaidInvoice(null)} />

      {/* Shared Page Context Header */}
      <PageHeader
        title="Invoices & Ledger"
        subtitle="Manage invoice records, track partial payments, outstanding balances, and collection states."
        actions={
          <button
            onClick={() => setActiveScreen('import_data')}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Import Invoices
          </button>
        }
      />

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice # or customer..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {filterOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setActiveInvoiceFilter(opt)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeInvoiceFilter === opt
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
      <div className="rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px] font-mono">
                <th className="py-4 px-6">Invoice #</th>
                <th className="py-4 px-4">Customer</th>
                <th className="py-4 px-4">Amount</th>
                <th className="py-4 px-4">Outstanding</th>
                <th className="py-4 px-4">Due Date</th>
                <th className="py-4 px-4">Overdue</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Reminders</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInvoices.map((inv) => {
                const outstanding = inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount - (inv.paidAmount || 0);
                const currencySymbol = inv.currency.includes('INR') || inv.currency === 'INR' ? '₹' : '$';

                return (
                  <tr key={inv.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-4 px-6 font-mono font-bold text-emerald-400">{inv.invoiceNumber}</td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-100">{inv.customerName}</div>
                      <div className="text-[11px] text-slate-400">{inv.customerEmail}</div>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300">
                      {currencySymbol}{inv.amount.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-white">
                      {currencySymbol}{outstanding.toLocaleString()}
                      {inv.paidAmount && inv.paidAmount > 0 ? (
                        <span className="block text-[10px] text-emerald-400 font-normal">
                          ({currencySymbol}{inv.paidAmount.toLocaleString()} paid)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-4 px-4 text-slate-400 font-mono text-[11px]">{inv.dueDate}</td>
                    <td className="py-4 px-4 font-mono font-bold">
                      {inv.status === 'paid' ? (
                        <span className="text-emerald-400">0d</span>
                      ) : inv.daysOverdue > 0 ? (
                        <span className="text-rose-400">{inv.daysOverdue}d</span>
                      ) : (
                        <span className="text-emerald-400">0d</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : inv.status === 'partially_paid'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            : inv.status === 'disputed'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : inv.status === 'escalated'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : inv.status === 'promised'
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {inv.status === 'partially_paid' ? 'PARTIAL PAID' : inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-center text-slate-300">{inv.remindersSent}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          title="View Details"
                          className="px-3 py-1.5 text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          Dossier
                        </button>
                        {inv.status !== 'paid' ? (
                          <button
                            onClick={() => setMarkingPaidInvoice(inv)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
                          >
                            Record Payment
                          </button>
                        ) : (
                          <span className="text-emerald-400 font-bold text-xs px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl inline-flex items-center gap-1">
                            PAID ✓
                          </span>
                        )}
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
