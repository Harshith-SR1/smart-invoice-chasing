'use client';

import React, { useState, Suspense } from 'react';
import {
  Building2,
  Bot,
  Bell,
  Sliders,
  Mail,
  ShieldCheck,
  Globe,
  Save,
  Lock,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '../layout/PageHeader';

const SettingsViewContent: React.FC = () => {
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get('tab');
  const { workspace, setWorkspace, automationRules, setAutomationRules, showToast } = useApp();

  type TabType = 'business' | 'ai' | 'collection' | 'autonomy' | 'notifications' | 'email' | 'security' | 'preferences';

  const [activeTab, setActiveTab] = useState<TabType>(
    initialTabParam === 'ai' ? 'ai' : 'business'
  );

  // Form states
  const [businessName, setBusinessName] = useState(workspace.businessName);
  const [currency, setCurrency] = useState(workspace.currency);
  const [businessEmail, setBusinessEmail] = useState(workspace.businessEmail);
  
  // AI Receiver states
  const [aiActive, setAiActive] = useState(automationRules.enableAutoFollowup);
  const [tone, setTone] = useState(automationRules.communicationTone);
  const [maxReminders, setMaxReminders] = useState(automationRules.maxReminders);
  const [preDueDays, setPreDueDays] = useState(automationRules.preDueDays || 3);
  const [firstOverdue, setFirstOverdue] = useState(automationRules.postDueScheduleDays[0] || 3);
  const [secondOverdue, setSecondOverdue] = useState(automationRules.postDueScheduleDays[1] || 7);
  const [finalEscalation, setFinalEscalation] = useState(automationRules.humanEscalationThresholdDays || 14);

  // Autonomy Toggles
  const [autoSend, setAutoSend] = useState(true);
  const [autoStopPromise, setAutoStopPromise] = useState(automationRules.autoStopOnPromise);

  // Notification Toggles
  const [notifPayment, setNotifPayment] = useState(true);
  const [notifPromise, setNotifPromise] = useState(true);
  const [notifEscalation, setNotifEscalation] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setWorkspace({ ...workspace, businessName, currency, businessEmail });
      setAutomationRules({
        ...automationRules,
        enableAutoFollowup: aiActive,
        communicationTone: tone as any,
        maxReminders: Number(maxReminders),
        preDueDays: Number(preDueDays),
        postDueScheduleDays: [Number(firstOverdue), Number(secondOverdue)],
        humanEscalationThresholdDays: Number(finalEscalation),
        autoStopOnPromise: autoStopPromise,
      });
      setIsSaving(false);
      showToast('Settings saved successfully across all configuration modules!', 'success');
    }, 500);
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'business', label: '1. Business', icon: <Building2 className="w-4 h-4" /> },
    { id: 'ai', label: '2. AI Receiver', icon: <Bot className="w-4 h-4" /> },
    { id: 'collection', label: '3. Collection Rules', icon: <Sliders className="w-4 h-4" /> },
    { id: 'autonomy', label: '4. AI Autonomy', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'notifications', label: '5. Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'email', label: '6. Email Service', icon: <Mail className="w-4 h-4" /> },
    { id: 'security', label: '7. Security', icon: <Lock className="w-4 h-4" /> },
    { id: 'preferences', label: '8. Preferences', icon: <Globe className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4 p-6 max-w-5xl mx-auto font-sans text-slate-100">
      {/* Shared Page Context Header */}
      <PageHeader
        title="System & AI Settings"
        subtitle="Configure how the AI Receiver operates, follows up, and requests human intervention."
      />

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-md'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Settings Form Container */}
      <form onSubmit={handleSaveSettings} className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* TAB 1: BUSINESS SETTINGS */}
        {activeTab === 'business' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Business Settings</h2>
              <p className="text-xs text-slate-400 mt-0.5">Shared corporate identity variables.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Finance Contact Email</label>
                <input
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Default Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 font-mono font-bold"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI RECEIVER SETTINGS */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">AI Receiver Engine Controls</h2>
                <p className="text-xs text-slate-400 mt-0.5">Control operational state and conversational tone.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAiActive(!aiActive)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    aiActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {aiActive ? <PlayCircle className="w-4 h-4 text-emerald-400" /> : <PauseCircle className="w-4 h-4 text-rose-400" />}
                  <span>{aiActive ? 'AI RECEIVER: ACTIVE' : 'AI RECEIVER: PAUSED'}</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <span className="font-bold text-white block mb-1">Operational State Explanation:</span>
              When paused, Smart Invoice Chasing will not initiate new automated follow-up sequences. Existing pending sequences remain paused in queue until resumed.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Communication Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 font-semibold"
              >
                <option value="friendly">Friendly & Professional (Gentle Reminders)</option>
                <option value="professional">Standard Professional (Recommended)</option>
                <option value="firm">Firm & Direct (Strict Terms)</option>
                <option value="assertive">Assertive (Escalation Tone)</option>
              </select>
            </div>
          </div>
        )}

        {/* TAB 3: COLLECTION RULES */}
        {activeTab === 'collection' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Follow-up Cadence & Sequence Rules</h2>
              <p className="text-xs text-slate-400 mt-0.5">Configure scheduled reminder thresholds in days.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
                <label className="font-semibold text-white block">Pre-Due Courtesy Reminder</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={preDueDays}
                    onChange={(e) => setPreDueDays(Number(e.target.value))}
                    min="1"
                    max="14"
                    className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                  <span className="text-slate-400">days before due date</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
                <label className="font-semibold text-white block">First Overdue Follow-up</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={firstOverdue}
                    onChange={(e) => setFirstOverdue(Number(e.target.value))}
                    min="1"
                    max="30"
                    className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                  <span className="text-slate-400">days post due date</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
                <label className="font-semibold text-white block">Second Overdue Follow-up</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={secondOverdue}
                    onChange={(e) => setSecondOverdue(Number(e.target.value))}
                    min="1"
                    max="60"
                    className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                  <span className="text-slate-400">days post due date</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
                <label className="font-semibold text-white block">Human Escalation Threshold</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={finalEscalation}
                    onChange={(e) => setFinalEscalation(Number(e.target.value))}
                    min="7"
                    max="90"
                    className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-rose-300 font-mono font-bold"
                  />
                  <span className="text-slate-400">days overdue trigger</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AI AUTONOMY */}
        {activeTab === 'autonomy' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">AI Autonomy & Delegation Boundaries</h2>
              <p className="text-xs text-slate-400 mt-0.5">Distinguish automatic execution from human approval triggers.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] block">AUTOMATIC</span>
                  <span className="font-semibold text-white text-xs">Send Automated Email Reminders</span>
                  <p className="text-slate-400 text-[11px]">AI Receiver automatically dispatches scheduled follow-ups according to cadence rules.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoSend}
                  onChange={(e) => setAutoSend(e.target.checked)}
                  className="w-5 h-5 accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-[#8B7CFF]/30 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#8B7CFF] uppercase tracking-wider text-[11px] block">AUTOMATIC</span>
                  <span className="font-semibold text-white text-xs">Pause Chasing on Payment Promise Detection</span>
                  <p className="text-slate-400 text-[11px]">Automatically hold upcoming follow-ups when customer specifies a payment date commitment.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoStopPromise}
                  onChange={(e) => setAutoStopPromise(e.target.checked)}
                  className="w-5 h-5 accent-[#8B7CFF] cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/30 flex items-center justify-between">
                <div>
                  <span className="font-bold text-rose-400 uppercase tracking-wider text-[11px] block">REQUIRES HUMAN APPROVAL</span>
                  <span className="font-semibold text-white text-xs">Escalate to Legal / Direct Phone Outreach</span>
                  <p className="text-slate-400 text-[11px]">Accounts reaching 91+ days or broken promises trigger human review approval cards.</p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 px-2 py-1 rounded border border-rose-500/30">
                  HUMAN REVIEW MANDATORY
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Event Notification Preferences</h2>
              <p className="text-xs text-slate-400 mt-0.5">Toggle email and in-app alerts for receivables events.</p>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 cursor-pointer">
                <div>
                  <span className="font-semibold text-white block">Payment Received Alerts</span>
                  <span className="text-slate-400 text-[11px]">Receive notification when a customer payment is confirmed via bank UTR.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifPayment}
                  onChange={(e) => setNotifPayment(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 cursor-pointer">
                <div>
                  <span className="font-semibold text-white block">Payment Promise Detected</span>
                  <span className="text-slate-400 text-[11px]">Alert when AI classifies customer commitment date.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifPromise}
                  onChange={(e) => setNotifPromise(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 cursor-pointer">
                <div>
                  <span className="font-semibold text-white block">Human Escalation Triggers</span>
                  <span className="text-slate-400 text-[11px]">Alert when account reaches critical escalation threshold.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifEscalation}
                  onChange={(e) => setNotifEscalation(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>
            </div>
          </div>
        )}

        {/* TAB 6: EMAIL SERVICE */}
        {activeTab === 'email' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Email Dispatcher Configuration</h2>
              <p className="text-xs text-slate-400 mt-0.5">High-deliverability AI email integration status.</p>
            </div>

            <div className="p-5 bg-slate-900/80 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">Resend High-Deliverability API</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    CONNECTED & ACTIVE
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1">Sender Domain: <strong className="text-white font-mono">chasing@smartchasing.io</strong></p>
                <span className="text-[11px] text-emerald-400 font-mono mt-0.5 block">Last verified: Today at 09:00 AM</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SECURITY */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Security & Password Management</h2>
              <p className="text-xs text-slate-400 mt-0.5">Manage authentication session security.</p>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3 text-xs">
              <span className="font-semibold text-white block">Password Reset</span>
              <p className="text-slate-400 text-[11px]">Send password update email to {businessEmail}.</p>
              <button
                type="button"
                onClick={() => showToast(`Password update link dispatched to ${businessEmail}`, 'info')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 rounded-xl font-semibold transition cursor-pointer"
              >
                Send Update Email
              </button>
            </div>
          </div>
        )}

        {/* TAB 8: PREFERENCES */}
        {activeTab === 'preferences' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Interface & Regional Preferences</h2>
              <p className="text-xs text-slate-400 mt-0.5">Formatting and display defaults.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Date Format</label>
                <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 font-mono">
                  <option>DD/MM/YYYY (e.g. 15/09/2026)</option>
                  <option>MM/DD/YYYY (e.g. 09/15/2026)</option>
                  <option>YYYY-MM-DD (e.g. 2026-09-15)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Number Notation</label>
                <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 font-mono">
                  <option>Indian Lakhs (₹4.80L)</option>
                  <option>Standard Millions ($480,000)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Save Bar */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">All changes synced to workspace database</span>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs px-6 py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving Settings...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const SettingsView: React.FC = () => {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading settings...</div>}>
      <SettingsViewContent />
    </Suspense>
  );
};

