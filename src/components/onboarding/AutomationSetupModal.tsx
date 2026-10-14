'use client';

import React, { useState } from 'react';
import { Sliders, ArrowRight, CheckCircle2, Bot, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AutomationSetupModal: React.FC = () => {
  const { automationRules, handleUpdateAutomationRules, setActiveScreen, showToast } = useApp();

  const [tone, setTone] = useState(automationRules.communicationTone);
  const [maxReminders, setMaxReminders] = useState(automationRules.maxReminders);
  const [escalationDays, setEscalationDays] = useState(automationRules.humanEscalationThresholdDays);
  const [autoStopOnPromise, setAutoStopOnPromise] = useState(automationRules.autoStopOnPromise);

  const handleSaveAndActivate = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdateAutomationRules({
      communicationTone: tone,
      maxReminders: Number(maxReminders),
      humanEscalationThresholdDays: Number(escalationDays),
      autoStopOnPromise: autoStopOnPromise,
    });
    showToast('AI Chasing activated across workspace!', 'success');
    setActiveScreen('dashboard');
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400">Step 3 of 3 &bull; Automation Workflow</span>
            <h2 className="text-xl font-bold text-white leading-tight">Configure AI Follow-Up Rules</h2>
          </div>
        </div>

        <form onSubmit={handleSaveAndActivate} className="space-y-5">
          {/* Tone Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Default Communication Tone</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'friendly', title: 'Friendly & Soft', desc: 'Best for long-term clients' },
                { id: 'professional', title: 'Professional (Default)', desc: 'Standard business etiquette' },
                { id: 'firm', title: 'Firm & Direct', desc: 'Clear deadlines & PO requests' },
                { id: 'assertive', title: 'Assertive / Legal', desc: 'Urgent collection demands' },
              ].map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTone(t.id as any)}
                  className={`p-3 rounded-xl text-left border transition ${
                    tone === t.id
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <p className="font-bold text-xs">{t.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Sequence Preview Box */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <p className="font-semibold text-slate-300 mb-2">Configured Sequence Schedule:</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-800">-3d Pre-Due</span>
              <span>&rarr;</span>
              <span className="bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-800">Due Date Notice</span>
              <span>&rarr;</span>
              <span className="bg-slate-950 px-2 py-1 rounded text-emerald-400 border border-emerald-500/30">+3d Soft</span>
              <span>&rarr;</span>
              <span className="bg-slate-950 px-2 py-1 rounded text-amber-400 border border-amber-500/30">+7d Firm</span>
              <span>&rarr;</span>
              <span className="bg-slate-950 px-2 py-1 rounded text-rose-400 border border-rose-500/30">+14d Final</span>
              <span>&rarr;</span>
              <span className="bg-rose-500/20 text-rose-300 px-2 py-1 rounded font-bold">Human Escalation</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Max Automated Reminders</label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxReminders}
                onChange={(e) => setMaxReminders(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Escalation Threshold (Days)</label>
              <input
                type="number"
                min={15}
                max={120}
                value={escalationDays}
                onChange={(e) => setEscalationDays(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Toggle Pause on Promise */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">Pause Chasing on Payment Promise</p>
              <p className="text-[11px] text-slate-400">If AI detects promised date, automatically wait until date passes.</p>
            </div>
            <input
              type="checkbox"
              checked={autoStopOnPromise}
              onChange={(e) => setAutoStopOnPromise(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
          >
            Activate AI Chasing Workspace
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
