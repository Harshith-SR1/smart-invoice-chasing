'use client';

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Search,
  FileSpreadsheet,
  Bot,
  Coins,
  CreditCard,
  Mail,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function HelpPage() {
  const { showToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Support form state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [requestType, setRequestType] = useState<'support' | 'bug' | 'feature'>('support');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const faqs = [
    {
      q: 'How does Smart Invoice Chasing monitor invoice due dates?',
      a: 'The AI Receiver continuously tracks invoice issue dates, due dates, and customer payment terms uploaded via CSV/Excel or API. It automatically schedules multi-stage follow-up reminders relative to the due date.',
    },
    {
      q: 'What happens when a customer replies to an automated email?',
      a: 'Incoming customer responses are processed through our AI classification pipeline to detect intents such as payment promises, internal approval delays, invoice copy requests, or dispute flags. The system automatically pauses aggressive chasing when a promise is detected.',
    },
    {
      q: 'Can I manually override or review AI follow-up messages before sending?',
      a: 'Yes! In the AI Decision Center and Collections workspace, you can inspect suggested AI messages, edit subject/body text, or click "Review AI Message" to approve or modify before dispatch.',
    },
    {
      q: 'How are payment promises tracked and verified?',
      a: 'When an AI or user logs a customer promise (e.g. "Will transfer on Friday"), the system sets a promise tracking timer. If payment is received before the date, chasing stops. If missed, the account is flagged for follow-up.',
    },
    {
      q: 'How do I export my monthly recovery reports?',
      a: 'Navigate to Recovery Reports from the top menu or dashboard. You can download a full CSV audit export or print a PDF summary of total cash recovered, promises fulfilled, and unrecovered high-risk accounts.',
    },
  ];

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      showToast('Please fill out both subject and message fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubject('');
      setMessage('');
      showToast(`Your ${requestType === 'bug' ? 'bug report' : requestType === 'feature' ? 'feature request' : 'support request'} has been dispatched to our engineering team!`, 'success');
    }, 600);
  };

  return (
    <div className="space-y-4 p-6 max-w-5xl mx-auto font-sans">
      {/* Shared Page Context Header */}
      <PageHeader
        title="Help & Support"
        subtitle="Find guidance for using Smart Invoice Chasing and managing your account."
      />

      {/* SEARCH HELP KNOWLEDGE BASE */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-2xl">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Search Knowledge Base</h2>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles e.g., 'CSV import', 'AI tone', 'promises', 'PDF invoice'..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition"
          />
        </div>
      </div>

      {/* SIX CATEGORY HELP GUIDES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <FileSpreadsheet className="w-4 h-4" /> 1. Getting Started
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="hover:text-emerald-400 cursor-pointer transition">• Importing receivables via CSV / Excel</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Navigating the Dashboard Command Center</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Setting up initial company workspace</li>
          </ul>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center gap-2 text-[#8B7CFF] font-bold text-xs uppercase tracking-wider">
            <Coins className="w-4 h-4" /> 2. Collections Engine
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="hover:text-emerald-400 cursor-pointer transition">• Configuring automated follow-up cadence</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Payment promise detection & tracking</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Marking invoices paid & UTR entry</li>
          </ul>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Bot className="w-4 h-4" /> 3. AI Intelligence
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="hover:text-emerald-400 cursor-pointer transition">• AI tone adjustments (Friendly to Firm)</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Human escalation thresholds</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Reviewing AI message suggestions</li>
          </ul>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
            <CreditCard className="w-4 h-4" /> 4. Analytics & Reports
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="hover:text-emerald-400 cursor-pointer transition">• Understanding Aging spectrum buckets</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Customer payment risk classification</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Exporting recovery audit reports</li>
          </ul>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center gap-2 text-teal-300 font-bold text-xs uppercase tracking-wider">
            <Mail className="w-4 h-4" /> 5. Account & Workspace
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="hover:text-emerald-400 cursor-pointer transition">• Profile photo & password security</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Business parameters & currency settings</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Team member seat management</li>
          </ul>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
            <CreditCard className="w-4 h-4" /> 6. Subscription & Billing
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="hover:text-emerald-400 cursor-pointer transition">• Subscription plan tiers (Free, Early Access, Growth)</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Usage meters & invoice tracking limits</li>
            <li className="hover:text-emerald-400 cursor-pointer transition">• Downloading PDF billing receipts</li>
          </ul>
        </div>
      </div>

      {/* FREQUENTLY ASKED QUESTIONS */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-2xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
          Frequently Asked Questions
        </h3>

        <div className="space-y-2">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between text-xs font-bold text-white hover:text-emerald-400 transition cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 shrink-0 text-emerald-400" /> : <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTACT SUPPORT / REPORT BUG FORM */}
      <form onSubmit={handleSupportSubmit} className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Submit Support Ticket</h3>
            <p className="text-xs text-slate-400 mt-0.5">Contact our technical team or report a system issue.</p>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setRequestType('support')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${requestType === 'support' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'}`}
            >
              Support Request
            </button>
            <button
              type="button"
              onClick={() => setRequestType('bug')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${requestType === 'bug' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400'}`}
            >
              Report Problem
            </button>
            <button
              type="button"
              onClick={() => setRequestType('feature')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${requestType === 'feature' ? 'bg-[#8B7CFF] text-slate-950 font-bold' : 'text-slate-400'}`}
            >
              Request Feature
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="Brief summary of your inquiry..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Detailed Message</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              placeholder="Describe your question or issue in detail..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
          <span className="text-[11px] text-slate-500">Average response time: &lt; 2 hours</span>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
