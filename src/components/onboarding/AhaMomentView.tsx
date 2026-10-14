'use client';

import React from 'react';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  Coins,
  FileText,
  MessageSquareX,
  CheckCircle2,
  Bot,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AhaMomentView: React.FC = () => {
  const { setActiveScreen, workspace } = useApp();

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10">
        {/* Header Badge & Greeting */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-mono font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              AI Receivables Intelligence Brief
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Good morning 👋</h1>
            <p className="text-sm text-slate-400 mt-1">Here is what the AI found in your imported receivables data.</p>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-right">
            <p className="text-[11px] text-slate-400">Workspace</p>
            <p className="text-xs font-bold text-slate-200">{workspace.businessName}</p>
          </div>
        </div>

        {/* Major KPI Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
          {/* Total Outstanding */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Outstanding</span>
              <Coins className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-white font-mono">₹18.42L</p>
              <p className="text-[10px] text-slate-400 mt-1">Total pending cash</p>
            </div>
          </div>

          {/* Overdue Invoices */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Overdue</span>
              <FileText className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-rose-400 font-mono">43</p>
              <p className="text-[10px] text-slate-400 mt-1">Invoices past due</p>
            </div>
          </div>

          {/* Unfinished Follow-ups */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Unfinished</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-amber-400 font-mono">18</p>
              <p className="text-[10px] text-slate-400 mt-1">Forgotten follow-ups</p>
            </div>
          </div>

          {/* Missed Payment Promises */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Missed</span>
              <MessageSquareX className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-rose-400 font-mono">11</p>
              <p className="text-[10px] text-slate-400 mt-1">Broken payment promises</p>
            </div>
          </div>

          {/* High Priority Receivables */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950 border border-emerald-500/40 glow-emerald flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Priority</span>
              <AlertTriangle className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-400 font-mono">₹6.20L</p>
              <p className="text-[10px] text-emerald-300/80 mt-1">Requires immediate action</p>
            </div>
          </div>
        </div>

        {/* AI Executive Summary Card */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 relative overflow-hidden mb-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                AI Receiver Agent Synthesis
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed font-normal">
                &ldquo;Your business currently has <strong>₹18.42L in outstanding receivables</strong> across 43 overdue invoices.
                We identified <strong>18 unfinished collection conversations</strong> where previous manual reminders were abandoned,
                and <strong>11 missed payment promises</strong> where customers promised payment but never fulfilled.
                Seven high-value accounts have received 5+ reminders and require immediate attention.&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setActiveScreen('invoices')}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            View All Imported Invoices Table &rarr;
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setActiveScreen('ai_recommendations')}
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-3.5 rounded-xl transition shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-3 text-sm"
            >
              Review AI Recommendations
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
