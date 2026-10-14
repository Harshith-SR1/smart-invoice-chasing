'use client';

import React, { useState } from 'react';
import { Send, Eye, Check, XCircle, Sparkles, Bot, ShieldAlert, Clock, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../layout/PageHeader';
import { DecisionStatus } from '../../types';

export const AiDecisionsView: React.FC = () => {
  const {
    decisions,
    invoices,
    setSelectedInvoice,
    setReviewMessageInvoice,
    handleApproveDecision,
    handleExecuteDecision,
    handleDismissDecision,
  } = useApp();

  const [activeStatusFilter, setActiveStatusFilter] = useState<'ALL' | DecisionStatus>('ALL');

  const filteredDecisions = decisions.filter((d) => {
    if (activeStatusFilter === 'ALL') return true;
    return d.status === activeStatusFilter;
  });

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'ESCALATE':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'HUMAN':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'FOLLOW_UP':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'NUDGE':
        return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
      case 'WAIT':
        return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
      case 'STOP':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
  };

  const getStatusBadge = (status: DecisionStatus) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">PENDING APPROVAL</span>;
      case 'APPROVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-300 border border-sky-500/30">APPROVED</span>;
      case 'EXECUTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">EXECUTED ✅</span>;
      case 'DISMISSED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">DISMISSED</span>;
      case 'EXPIRED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">EXPIRED</span>;
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto font-sans">
      {/* Shared Page Context Header */}
      <PageHeader
        title="AI Decisions Control Center"
        subtitle="Every collection action evaluated by the AI Decision Engine with grounded evidence and confidence scores."
        badge="Next-Best-Action Engine"
        badgeColor="violet"
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['ALL', 'PENDING', 'APPROVED', 'EXECUTED', 'DISMISSED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveStatusFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer whitespace-nowrap ${
              activeStatusFilter === tab
                ? 'bg-[#8B7CFF] text-slate-950 shadow-md shadow-[#8B7CFF]/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Decisions Cards Grid */}
      {filteredDecisions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDecisions.map((dec) => {
            const relatedInvoice = invoices.find((i) => i.id === dec.invoiceId);
            const currencySymbol = dec.currency.includes('INR') || dec.currency === 'INR' ? '₹' : '$';

            return (
              <div
                key={dec.id}
                className="p-5 rounded-3xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-[#8B7CFF]/50 transition shadow-xl"
              >
                <div className="space-y-3">
                  {/* Top Bar: Customer & Amount */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-white text-base">{dec.customerName}</h3>
                      <span className="text-[11px] font-mono text-slate-400">
                        {dec.invoiceNumber}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-extrabold text-white font-mono block">
                        {currencySymbol}{dec.outstandingAmount.toLocaleString()}
                      </span>
                      {getStatusBadge(dec.status)}
                    </div>
                  </div>

                  {/* Primary Recommendation Banner */}
                  <div className={`p-3 rounded-2xl border ${getActionBadgeColor(dec.action)} text-xs space-y-1`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase font-bold tracking-wider">
                        ACTION: {dec.action}
                      </span>
                      <span className="font-mono text-[10px] font-bold">
                        Confidence: {dec.confidence}%
                      </span>
                    </div>
                    <p className="text-white font-semibold text-xs leading-snug">{dec.reason}</p>
                  </div>

                  {/* Grounded Evidence Box */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <span className="text-slate-500 font-mono text-[10px] uppercase font-bold block">
                      SUPPORTING EVIDENCE & CONTEXT
                    </span>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {dec.evidence}
                    </p>
                  </div>

                  {/* Execution Parameters */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono text-slate-400 pt-1">
                    <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block uppercase">Timing</span>
                      <span className="text-white font-bold">{dec.recommendedTiming}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block uppercase">Channel</span>
                      <span className="text-emerald-400 font-bold">{dec.recommendedChannel}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block uppercase">Tone</span>
                      <span className="text-amber-400 font-bold">{dec.recommendedTone}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  {(dec.status === 'PENDING' || dec.status === 'APPROVED') && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleExecuteDecision(dec.id)}
                        className="py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1 shadow-md shadow-emerald-950"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Execute Now</span>
                      </button>
                      <button
                        onClick={() => {
                          if (relatedInvoice) setReviewMessageInvoice(relatedInvoice);
                        }}
                        className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Review Message</span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <button
                      onClick={() => {
                        if (relatedInvoice) setSelectedInvoice(relatedInvoice);
                      }}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Invoice Dossier
                    </button>

                    {dec.status === 'PENDING' && (
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => handleApproveDecision(dec.id)}
                          className="text-sky-400 hover:text-sky-300 text-[11px] font-semibold flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleDismissDecision(dec.id)}
                          className="text-slate-500 hover:text-rose-400 text-[11px]"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-950 border border-slate-800 rounded-3xl space-y-3">
          <Bot className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-300 font-semibold text-sm">No decisions matching filter &quot;{activeStatusFilter}&quot;</p>
          <p className="text-slate-500 text-xs">The AI Collection Decision Engine evaluates receivables automatically as events occur.</p>
        </div>
      )}
    </div>
  );
};
