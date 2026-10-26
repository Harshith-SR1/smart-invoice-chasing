'use client';

import React, { useState } from 'react';
import { Eye, ShieldAlert, Sparkles, Send, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Invoice, isCollectibleStatus } from '../../types';
import { MarkAsPaidModal } from '../common/MarkAsPaidModal';
import { PageHeader } from '../layout/PageHeader';
import { evaluateInvoiceDecision } from '../../lib/decisionEngine';
import { exportInvoicesToCsv } from '../../lib/invoiceExport';

export const CollectionsHub: React.FC = () => {
  const {
    invoices,
    customers,
    promises,
    decisions,
    activeCollectionFilter,
    setActiveCollectionFilter,
    setSelectedInvoice,
    setReviewMessageInvoice,
    searchQuery,
    workspace,
    showToast,
    loadError,
  } = useApp();

  const [markingPaidInvoice, setMarkingPaidInvoice] = useState<Invoice | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const filterTabs = [
    { id: 'All', label: 'All Accounts', count: invoices.length },
    { id: 'Active', label: 'Active Pipeline', count: invoices.filter((i) => i.status !== 'paid').length },
    { id: 'Promisers', label: 'Promisers', count: invoices.filter((i) => i.collectionCategory === 'PROMISERS' || i.status === 'promised').length },
    { id: 'Disputers', label: 'Disputers', count: invoices.filter((i) => i.collectionCategory === 'DISPUTERS' || i.status === 'disputed').length },
    { id: 'Ghosters', label: 'Ghosters', count: invoices.filter((i) => i.collectionCategory === 'GHOSTERS' || (i.remindersSent >= 3 && i.customerRepliesCount === 0)).length },
    { id: 'Recovered', label: 'Recovered', count: invoices.filter((i) => i.status === 'paid').length },
  ];

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerEmail.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeCollectionFilter === 'All') return true;
    if (activeCollectionFilter === 'Active') return inv.status !== 'paid';
    if (activeCollectionFilter === 'Promisers') return inv.collectionCategory === 'PROMISERS' || inv.status === 'promised';
    if (activeCollectionFilter === 'Disputers') return inv.collectionCategory === 'DISPUTERS' || inv.status === 'disputed';
    if (activeCollectionFilter === 'Ghosters') return inv.collectionCategory === 'GHOSTERS' || (inv.remindersSent >= 3 && inv.customerRepliesCount === 0);
    if (activeCollectionFilter === 'Recovered') return inv.status === 'paid';
    return true;
  });

  const handleExportCSV = () => {
    if (loadError) {
      showToast(`Cannot export invoices: ${loadError}`, 'error');
      return;
    }
    if (filteredInvoices.length === 0) {
      showToast(`No invoices found matching filter "${activeCollectionFilter}" to export.`, 'info');
      return;
    }
    setIsExporting(true);
    try {
      const scopeLabel = `Collections_${activeCollectionFilter}`;
      const result = exportInvoicesToCsv(filteredInvoices, {
        scopeName: scopeLabel,
        fallbackCurrency: workspace?.currency || 'INR',
      });
      if (!result.success) {
        showToast(result.error || 'Failed to export invoices CSV.', 'error');
      } else {
        showToast(`Exported ${result.rowCount} invoice records (${activeCollectionFilter}) to CSV!`, 'success');
      }
    } catch (err: any) {
      showToast(`Export failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto font-sans">
      <MarkAsPaidModal invoice={markingPaidInvoice} onClose={() => setMarkingPaidInvoice(null)} />

      {/* Shared Page Context Header */}
      <PageHeader
        title="Collections Operations Pipeline"
        subtitle="Monitor ongoing collection sequences, customer promises, dispute exceptions, and next-best actions."
        badge="Autonomous Pipeline"
        badgeColor="emerald"
        actions={
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            title={`Export ${filteredInvoices.length} matching invoices to CSV`}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-300 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{isExporting ? 'Exporting...' : `Export CSV (${filteredInvoices.length})`}</span>
          </button>
        }
      />

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {filterTabs.map((tab) => {
          const isActive = activeCollectionFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCollectionFilter(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-md'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${isActive ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table Card */}
      <div className="rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-6">Customer & Invoice</th>
                <th className="py-3.5 px-4">Outstanding</th>
                <th className="py-3.5 px-4">Days Overdue</th>
                <th className="py-3.5 px-4">Stage / Category</th>
                <th className="py-3.5 px-4">Next Best Action</th>
                <th className="py-3.5 px-4">Last Response</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => {
                  const customer = customers.find((c) => c.id === inv.customerId);
                  const decision = decisions.find((d) => d.invoiceId === inv.id) || evaluateInvoiceDecision(inv, customer, promises);
                  const outstanding = inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount;
                  const currencySymbol = inv.currency.includes('INR') || inv.currency === 'INR' ? '₹' : '$';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-slate-100 text-sm">{inv.customerName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{inv.invoiceNumber} &bull; {inv.customerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white text-sm">
                        {currencySymbol}{outstanding.toLocaleString()}
                        {inv.paidAmount && inv.paidAmount > 0 ? (
                          <span className="block text-[10px] text-emerald-400 font-normal">
                            ({currencySymbol}{inv.paidAmount.toLocaleString()} paid)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {inv.status === 'paid' ? (
                          <span className="text-emerald-400">Settled</span>
                        ) : inv.daysOverdue > 0 ? (
                          <span className="text-rose-400 font-bold">{inv.daysOverdue} days</span>
                        ) : (
                          <span className="text-emerald-400">On Schedule</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              inv.status === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : inv.status === 'escalated'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : inv.status === 'disputed'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : inv.status === 'partially_paid'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                : inv.status === 'promised'
                                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {inv.status === 'partially_paid' ? 'PARTIAL PAID' : inv.status}
                          </span>
                          {inv.collectionCategory && inv.collectionCategory !== 'ACTIVE' && (
                            <span className="text-[9px] font-mono text-slate-400 px-1.5 py-0.2 bg-slate-900 border border-slate-800 rounded">
                              {inv.collectionCategory}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">
                          {decision.action}
                        </span>
                        <span className="block text-[11px] text-slate-300 max-w-xs truncate mt-0.5">
                          {decision.reason}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px] max-w-xs truncate">
                        {inv.lastCustomerReply ? `"${inv.lastCustomerReply}"` : 'No reply recorded'}
                      </td>
                      <td className="py-3.5 px-6 text-right space-x-2">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          title="View Timeline"
                          className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {inv.status === 'paid' || (inv.outstandingAmount !== undefined && inv.outstandingAmount <= 0) ? (
                          <span className="text-emerald-400 font-bold text-xs px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl inline-flex items-center gap-1">
                            PAID ✓
                          </span>
                        ) : !isCollectibleStatus(inv.status) || decision.action === 'STOP' ? (
                          <span className="text-slate-400 font-mono font-bold text-[10px] px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl inline-flex items-center uppercase">
                            {inv.status}
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => setReviewMessageInvoice(inv)}
                              className="bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                            >
                              Dispatch Message
                            </button>
                            <button
                              onClick={() => setMarkingPaidInvoice(inv)}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
                            >
                              Record Payment
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                    No collection accounts found matching filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
