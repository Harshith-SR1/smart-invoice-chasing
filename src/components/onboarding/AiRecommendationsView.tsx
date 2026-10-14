'use client';

import React from 'react';
import {
  Sparkles,
  ArrowRight,
  Bot,
  PlayCircle,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Building2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Invoice } from '../../types';

export const AiRecommendationsView: React.FC = () => {
  const {
    invoices,
    setActiveScreen,
    setSelectedInvoice,
    setReviewMessageInvoice,
    handleResumeAllCollections,
    handleResumeInvoiceCollection,
  } = useApp();

  const recommendedInvoices = invoices.filter(
    (inv) => inv.status === 'overdue' || inv.status === 'chasing' || inv.status === 'escalated'
  );

  const handleReviewSingleMessage = (inv: Invoice) => {
    setReviewMessageInvoice(inv);
  };

  const handleActivateAll = () => {
    handleResumeAllCollections();
    setActiveScreen('automation_setup');
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-slate-800/80 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-mono font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              18 Unfinished Conversations Identified
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Recommended Action Plan</h1>
            <p className="text-xs text-slate-400 mt-1">
              Review AI recommendations generated based on historical context, payment promises, and delay patterns.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleActivateAll}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition shadow-xl shadow-emerald-500/25 flex items-center gap-2 text-xs uppercase tracking-wider"
            >
              <PlayCircle className="w-4 h-4" />
              Resume All Recommended Collections
            </button>
          </div>
        </div>

        {/* Recommendations Table */}
        <div className="space-y-4 mb-8">
          {recommendedInvoices.slice(0, 6).map((inv) => {
            const isHighRisk = inv.collectionHealth < 30;
            return (
              <div
                key={inv.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  {/* Health Score Pill */}
                  <div
                    className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-xs shrink-0 border ${
                      isHighRisk
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    <span>{inv.collectionHealth}</span>
                    <span className="text-[9px] uppercase opacity-70">Health</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-100 text-base">{inv.customerName}</h3>
                      <span className="text-xs text-slate-400 font-mono">({inv.invoiceNumber})</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <strong className="text-slate-200">{inv.currency} {inv.amount.toLocaleString()}</strong> &bull; {inv.daysOverdue} days overdue &bull; Last Contact: {inv.lastContactDate}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] bg-slate-950 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-medium">
                        AI: {inv.aiRecommendation.title}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <button
                    onClick={() => setSelectedInvoice(inv)}
                    className="p-2 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-center gap-1.5 transition"
                  >
                    <Eye className="w-4 h-4 text-slate-400" />
                    Timeline
                  </button>

                  <button
                    onClick={() => handleReviewSingleMessage(inv)}
                    className="bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Review AI Message
                  </button>

                  <button
                    onClick={() => handleResumeInvoiceCollection(inv.id)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition"
                  >
                    Resume
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs">
          <button
            onClick={() => setActiveScreen('aha_moment')}
            className="text-slate-400 hover:text-slate-200"
          >
            &larr; Back to Aha Moment Overview
          </button>

          <button
            onClick={() => setActiveScreen('automation_setup')}
            className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold px-6 py-2.5 rounded-xl border border-slate-700 transition flex items-center gap-2"
          >
            Configure Automation Rules &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
