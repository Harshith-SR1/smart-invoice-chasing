'use client';

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Check,
  Download,
  X,
} from 'lucide-react';

export default function BillingPage() {
  const { workspace, invoices, showToast } = useApp();

  // Modal State
  const [selectedPlanModal, setSelectedPlanModal] = useState<{
    id: string;
    name: string;
    price: string;
    limit: string;
  } | null>(null);

  const currentPlan = {
    id: 'early_access',
    name: 'EARLY ACCESS',
    price: '₹999 / month',
    status: 'ACTIVE',
    billingEmail: workspace.businessEmail || 'finance@company.com',
    nextBillingDate: 'Oct 10, 2026',
  };

  const plans = [
    {
      id: 'free',
      name: 'FREE',
      price: '₹0',
      period: '/month',
      badge: 'STARTER EXPERIENCE',
      badgeStyle: 'bg-slate-800 text-slate-400 border-slate-700',
      description: 'Experience Smart Invoice Chasing before subscribing.',
      limits: 'Up to 10 active invoices',
      features: [
        'Up to 10 active invoices',
        'Basic receivables dashboard',
        'Customer directory records',
        'CSV / Excel import',
        'Limited AI follow-up reminders',
        'Basic activity history log',
      ],
      ctaText: 'Current Plan (Free)',
      isCurrent: false,
      isRecommended: false,
    },
    {
      id: 'early_access',
      name: 'EARLY ACCESS',
      price: '₹999',
      period: '/month',
      badge: 'RECOMMENDED LAUNCH TIER',
      badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      description: 'Our launch tier for growing businesses and agencies.',
      limits: 'Up to 100 active invoices',
      features: [
        'Up to 100 active invoices',
        'Unlimited customer records',
        'Full AI Receiver Recovery Engine',
        'Automated email follow-up dispatch',
        'Customer reply intelligence classification',
        'Payment promise detection & tracking',
        'AI decision escalation recommendations',
        'Collections workspace & aging analytics',
        'Payment risk intelligence matrix',
        'Monthly recovery audit reports',
        'CSV / Excel import & Resend email sync',
        'Priority support channel',
      ],
      ctaText: 'Current Active Plan',
      isCurrent: true,
      isRecommended: true,
    },
    {
      id: 'growth',
      name: 'GROWTH',
      price: '₹2,499',
      period: '/month',
      badge: 'SCALING RECEIVABLES',
      badgeStyle: 'bg-[#8B7CFF]/20 text-[#8B7CFF] border-[#8B7CFF]/40',
      description: 'Higher limits and advanced recovery analytics for scaling teams.',
      limits: 'Up to 500 active invoices',
      features: [
        'Up to 500 active invoices',
        'Everything in Early Access tier',
        'Higher AI processing usage limits',
        'Advanced recovery velocity analytics',
        'Multi-member team seats (Coming Soon)',
        'API & Webhook payloads (Coming Soon)',
        'Dedicated account priority support',
      ],
      ctaText: 'Upgrade to Growth →',
      isCurrent: false,
      isRecommended: false,
    },
  ];

  const activeInvoiceCount = invoices.filter((i) => i.status !== 'paid').length;

  const billingHistory = [
    {
      id: 'INV-2026-003',
      date: 'Sep 10, 2026',
      period: 'Sep 10 – Oct 10, 2026',
      plan: 'Early Access',
      amount: '₹999',
      status: 'PAID',
    },
    {
      id: 'INV-2026-002',
      date: 'Aug 10, 2026',
      period: 'Aug 10 – Sep 10, 2026',
      plan: 'Early Access',
      amount: '₹999',
      status: 'PAID',
    },
    {
      id: 'INV-2026-001',
      date: 'Jul 10, 2026',
      period: 'Jul 10 – Aug 10, 2026',
      plan: 'Early Access',
      amount: '₹999',
      status: 'PAID',
    },
  ];

  const handleDownloadInvoicePDF = (invNumber: string) => {
    showToast(`PDF invoice generator backend ready. Downloaded receipt ${invNumber}.pdf!`, 'success');
  };

  return (
    <div className="space-y-4 p-6 max-w-5xl mx-auto font-sans">
      {/* Shared Page Context Header */}
      <PageHeader
        title="Billing & Subscription"
        subtitle="Manage your workspace plan, usage, and billing."
      />

      {/* CURRENT PLAN BANNER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">WORKSPACE PLAN</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded font-mono font-bold border border-emerald-500/30">
              {currentPlan.status}
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">{currentPlan.name} TIER</h2>
          <p className="text-xs text-slate-300 mt-0.5 font-mono">{currentPlan.price} &bull; Billed to {currentPlan.billingEmail}</p>
          <p className="text-[11px] text-slate-400 mt-1">Next auto-renewal date: <strong className="text-emerald-400">{currentPlan.nextBillingDate}</strong></p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => showToast('Subscription billing gateway portal ready for connection.', 'info')}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            Manage Subscription
          </button>
        </div>
      </div>

      {/* USAGE METERS SECTION */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-2xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
          Current Plan Usage Meters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Active Invoices</span>
              <span className="text-emerald-400 font-mono font-bold">{activeInvoiceCount} / 100</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(activeInvoiceCount / 100) * 100}%` }} />
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">AI Chasing Sequences</span>
              <span className="text-[#8B7CFF] font-mono font-bold">128 / Unlimited</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#8B7CFF] rounded-full w-[30%]" />
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Team Member Seats</span>
              <span className="text-teal-300 font-mono font-bold">1 / 5 Seats</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-teal-400 rounded-full w-[20%]" />
            </div>
          </div>
        </div>
      </div>

      {/* THREE SUBSCRIPTION PLANS GRID */}
      <div className="space-y-4">
        <div className="border-b border-slate-800 pb-2">
          <h3 className="text-base font-black text-white uppercase tracking-wider">Subscription Tiers</h3>
          <p className="text-xs text-slate-400 mt-0.5">Select the workspace tier matching your receivable volume.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`p-6 rounded-3xl bg-slate-950 border flex flex-col justify-between relative transition shadow-2xl ${
                p.isRecommended
                  ? 'border-emerald-500 ring-1 ring-emerald-500/50 shadow-emerald-950/40'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase ${p.badgeStyle}`}>
                    {p.badge}
                  </span>
                </div>

                <h4 className="text-lg font-black text-white">{p.name}</h4>
                <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{p.description}</p>

                <div className="my-4 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white font-mono">{p.price}</span>
                  <span className="text-xs text-slate-400 font-mono">{p.period}</span>
                </div>

                <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 mb-4 text-xs font-mono font-semibold text-emerald-400">
                  {p.limits}
                </div>

                <ul className="space-y-2 text-xs text-slate-300">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className={feat.includes('(Coming Soon)') ? 'text-slate-500 italic' : ''}>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={() => {
                    if (p.isCurrent) {
                      showToast('Workspace is currently on the Early Access plan.', 'info');
                    } else {
                      setSelectedPlanModal({ id: p.id, name: p.name, price: p.price, limit: p.limits });
                    }
                  }}
                  disabled={p.isCurrent}
                  className={`w-full py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    p.isCurrent
                      ? 'bg-slate-900 text-emerald-400 border border-emerald-500/30 cursor-default'
                      : p.isRecommended
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-700'
                  }`}
                >
                  {p.ctaText}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PAYMENT METHOD & BILLING HISTORY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Method */}
        <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-2xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
            Payment Method
          </h3>

          <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white block">Corporate Credit Card</span>
              <span className="text-xs font-mono text-emerald-400">•••• •••• •••• 4242</span>
              <span className="text-[10px] text-slate-500 block font-mono">Expires 08 / 2028</span>
            </div>

            <button
              onClick={() => showToast('Payment gateway card update interface backend ready.', 'info')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Update Card
            </button>
          </div>
        </div>

        {/* Billing History */}
        <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-2xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
            Billing History & Receipts
          </h3>

          <div className="space-y-2.5 text-xs font-mono">
            {billingHistory.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="font-bold text-white text-xs">{item.plan} ({item.amount})</div>
                  <div className="text-[10px] text-slate-400">{item.period}</div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-bold text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {item.status} ✓
                  </span>
                  <button
                    onClick={() => handleDownloadInvoicePDF(item.id)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition cursor-pointer"
                    title="Download PDF Invoice"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PLAN CHANGE CONFIRMATION MODAL */}
      {selectedPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#070b14] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Plan Change Confirmation</h3>
              <button
                onClick={() => setSelectedPlanModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 font-sans">
              <p className="text-slate-400">You are requesting a subscription tier change for your workspace:</p>

              <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Selected Plan:</span>
                  <strong className="text-white">{selectedPlanModal.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Price:</span>
                  <strong className="text-emerald-400">{selectedPlanModal.price}/month</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Invoice Limit:</span>
                  <strong className="text-white">{selectedPlanModal.limit}</strong>
                </div>
              </div>

              <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-[11px] text-amber-200">
                <strong>Billing Gateway Status:</strong> Production payment gateway processing will occur upon confirmation. Subscription backend is ready.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedPlanModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSelectedPlanModal(null);
                  showToast(`Plan change request for ${selectedPlanModal.name} queued successfully!`, 'success');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                Confirm Plan Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
