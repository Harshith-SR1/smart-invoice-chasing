'use client';

import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Bot,
  AlertTriangle,
  Eye,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../layout/PageHeader';

export const RecoveryReportsView: React.FC = () => {
  const { reportSummary, showToast } = useApp();
  const [selectedReportInvoice, setSelectedReportInvoice] = useState<any | null>(null);

  const handleExportPDF = () => {
    showToast('Exporting Recovery Audit Report as PDF...', 'info');
    setTimeout(() => {
      showToast(`Downloaded ${reportSummary.month}_Recovery_Report.pdf!`, 'success');
    }, 1000);
  };

  const handleExportCSV = () => {
    const headers = 'Invoice,Customer,Amount,Reminders Sent,Days Overdue,Last Response,Recommendation\n';
    const rows = reportSummary.unrecoveredAccounts
      .map(
        (a) =>
          `${a.invoiceNumber},"${a.customerName}",${a.amount},${a.remindersCount},${a.daysOverdue},"${a.lastResponse}","${a.recommendation}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Smart_Invoice_Recovery_Report_${reportSummary.month}_${reportSummary.year || 2026}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Recovery Report CSV!', 'success');
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto font-sans">
      {/* Shared Page Context Header */}
      <PageHeader
        title="Recovery Intelligence & Reports"
        subtitle="Track recovered cash, promises, escalations, and outstanding receivables."
        actions={
          <>
            <button
              onClick={handleExportCSV}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download PDF Report
            </button>
          </>
        }
      />

      {/* Main KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950 border-2 border-emerald-500/50 glow-emerald shadow-lg col-span-1 sm:col-span-2">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            ₹ Money Recovered ({reportSummary.month})
          </p>
          <p className="text-3xl font-black text-emerald-400 font-mono mt-1">
            ₹{(reportSummary.totalRecovered / 100000).toFixed(2)}L
          </p>
          <p className="text-xs text-emerald-300/80 mt-1">
            {reportSummary.promisesFulfilled} promises fulfilled out of {reportSummary.promisesDetected} detected
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <p className="text-[11px] text-slate-400 uppercase font-semibold">Still Outstanding</p>
          <p className="text-xl font-black text-white font-mono mt-1">₹{(reportSummary.totalOutstanding / 100000).toFixed(2)}L</p>
          <p className="text-[10px] text-slate-500 mt-1">active pending cash</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <p className="text-[11px] text-slate-400 uppercase font-semibold">Reminders Dispatched</p>
          <p className="text-xl font-black text-teal-400 font-mono mt-1">{reportSummary.remindersSent}</p>
          <p className="text-[10px] text-slate-500 mt-1">{reportSummary.repliesReceived} replies received</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <p className="text-[11px] text-amber-400 uppercase font-semibold">Promises Detected</p>
          <p className="text-xl font-black text-amber-400 font-mono mt-1">{reportSummary.promisesDetected}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            {reportSummary.promisesDetected > 0
              ? `${Math.min(100, Math.round((reportSummary.promisesFulfilled / reportSummary.promisesDetected) * 100))}% fulfillment rate`
              : '0% fulfillment rate'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <p className="text-[11px] text-rose-400 uppercase font-semibold">Human Escalations</p>
          <p className="text-xl font-black text-rose-400 font-mono mt-1">{reportSummary.escalatedCount}</p>
          <p className="text-[10px] text-slate-500 mt-1">5+ reminders unanswered</p>
        </div>
      </div>

      {/* AI Monthly Executive Summary Card */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                AI Recovery Summary ({reportSummary.month} 2026)
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {reportSummary.aiExecutiveSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Invoices With Repeated Follow-ups */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Invoices With Repeated Follow-ups But No Payment ({reportSummary.unrecoveredAccounts.length} Flagged)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              These accounts received 5+ automated follow-ups without settlement and require manual phone outreach.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Reminders</th>
                <th className="py-3 px-4">Days Overdue</th>
                <th className="py-3 px-4">Last Customer Response</th>
                <th className="py-3 px-4">AI Recommendation</th>
                <th className="py-3 px-4 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {reportSummary.unrecoveredAccounts.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40 transition">
                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">{item.invoiceNumber}</td>
                  <td className="py-3 px-4 font-bold text-slate-200">{item.customerName}</td>
                  <td className="py-3 px-4 font-mono font-bold text-white">₹{item.amount.toLocaleString()}</td>
                  <td className="py-3 px-4 font-mono">{item.remindersCount}</td>
                  <td className="py-3 px-4 font-mono text-rose-400 font-bold">{item.daysOverdue} days</td>
                  <td className="py-3 px-4 text-slate-400 italic max-w-xs truncate">&ldquo;{item.lastResponse}&rdquo;</td>
                  <td className="py-3 px-4">
                    <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-semibold">
                      {item.recommendation}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedReportInvoice(item)}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-lg text-xs transition flex items-center gap-1 ml-auto cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Audit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Final Invoice Recovery Outcome Report */}
      {selectedReportInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto">
            <button
              onClick={() => setSelectedReportInvoice(null)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition cursor-pointer"
            >
              &times;
            </button>

            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Final Invoice Outcome Report: {selectedReportInvoice.invoiceNumber}</h2>
                <p className="text-xs text-slate-400">Customer: {selectedReportInvoice.customerName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase">Invoice Amount</p>
                <p className="text-base font-bold text-white font-mono">₹{selectedReportInvoice.amount.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-[10px] text-rose-400 uppercase">Days Overdue</p>
                <p className="text-base font-bold text-rose-400 font-mono">{selectedReportInvoice.daysOverdue} Days</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs mb-6">
              <p><strong>Reminders Sent:</strong> {selectedReportInvoice.remindersCount}</p>
              <p><strong>Customer Replies:</strong> 2</p>
              <p><strong>Payment Promises:</strong> 1 (Missed)</p>
              <p><strong>Amount Received:</strong> ₹0</p>
              <p><strong>Final Outcome:</strong> <span className="text-rose-400 font-bold">UNPAID — HUMAN ESCALATION RECOMMENDED</span></p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedReportInvoice(null)}
                className="bg-slate-900 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close Audit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
