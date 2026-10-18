'use client';

import React, { useState } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Calendar,
  ShieldAlert,
  HelpCircle,
  Brain,
  History,
  DollarSign,
  Check,
  PlusCircle,
  Sparkles,
  Clock,
  CreditCard,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { evaluateInvoiceDecision, getWhyUnpaidDiagnosis } from '../../lib/decisionEngine';

export const InvoiceDetailModal: React.FC = () => {
  const {
    selectedInvoice,
    setSelectedInvoice,
    setReviewMessageInvoice,
    customers,
    promises,
    handleRecordPayment,
    handleClaimPayment,
    handleVerifyClaimedPayment,
    handleCreatePromise,
    handleEscalateInvoice,
    handleExecuteDecision,
  } = useApp();

  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialInputAmount, setPartialInputAmount] = useState('');
  
  const [showPromiseModal, setShowPromiseModal] = useState(false);
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [promiseQuote, setPromiseQuote] = useState('');

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimAmount, setClaimAmount] = useState('');
  const [claimNote, setClaimNote] = useState('');

  if (!selectedInvoice) return null;

  const customer = customers.find((c) => c.id === selectedInvoice.customerId);
  const invoicePromises = promises.filter((p) => p.invoiceId === selectedInvoice.id);
  const activePromise = invoicePromises.find((p) => p.status === 'ACTIVE' || p.status === 'pending');
  const brokenPromise = invoicePromises.find((p) => p.status === 'BROKEN' || p.status === 'missed');

  const decision = evaluateInvoiceDecision(selectedInvoice, customer, promises);
  const whyDiagnosis = selectedInvoice.whyUnpaidReason || getWhyUnpaidDiagnosis(selectedInvoice, customer, promises);

  const totalAmount = selectedInvoice.amount;
  const paidAmount = selectedInvoice.paidAmount || 0;
  const outstanding = selectedInvoice.outstandingAmount !== undefined ? selectedInvoice.outstandingAmount : totalAmount - paidAmount;
  const currencySymbol = selectedInvoice.currency.includes('INR') || selectedInvoice.currency === 'INR' ? '₹' : '$';

  const isHighRisk = selectedInvoice.collectionHealth < 30 || selectedInvoice.status === 'escalated';
  const isMediumRisk = selectedInvoice.collectionHealth >= 30 && selectedInvoice.collectionHealth < 70;

  const submitPartialPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(partialInputAmount);
    if (val > 0) {
      handleRecordPayment(selectedInvoice.id, val, false);
      setShowPartialModal(false);
      setPartialInputAmount('');
    }
  };

  const submitPromise = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(promiseAmount) || outstanding;
    if (promiseDate) {
      handleCreatePromise(selectedInvoice.id, amt, promiseDate, promiseQuote || 'Customer promised via conversation');
      setShowPromiseModal(false);
      setPromiseDate('');
      setPromiseAmount('');
      setPromiseQuote('');
    }
  };

  const submitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(claimAmount) || outstanding;
    handleClaimPayment(selectedInvoice.id, amt, claimNote);
    setShowClaimModal(false);
    setClaimAmount('');
    setClaimNote('');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => setSelectedInvoice(null)}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition hover:border-slate-700"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-black text-white">{selectedInvoice.customerName}</h2>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                {selectedInvoice.invoiceNumber}
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                selectedInvoice.status === 'paid'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : selectedInvoice.status === 'partially_paid'
                  ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                  : selectedInvoice.status === 'disputed'
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                  : selectedInvoice.status === 'promised'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : selectedInvoice.status === 'escalated'
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {selectedInvoice.status === 'partially_paid' ? 'PARTIALLY PAID' : selectedInvoice.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Issued: {selectedInvoice.issueDate} &bull; Due: {selectedInvoice.dueDate} &bull; {selectedInvoice.daysOverdue > 0 ? `${selectedInvoice.daysOverdue} days overdue` : 'Within due date'}
            </p>
          </div>

          {/* Financial Breakdown Badges */}
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800/80 p-3 rounded-2xl">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Invoiced</p>
              <p className="text-sm font-black text-slate-300 font-mono">
                {currencySymbol}{totalAmount.toLocaleString()}
              </p>
            </div>
            {paidAmount > 0 && (
              <div className="border-l border-slate-800 pl-3">
                <p className="text-[10px] text-emerald-400 uppercase font-semibold">Paid / Received</p>
                <p className="text-sm font-black text-emerald-400 font-mono">
                  {currencySymbol}{paidAmount.toLocaleString()}
                </p>
              </div>
            )}
            <div className="border-l border-slate-800 pl-3">
              <p className="text-[10px] text-amber-400 uppercase font-semibold">Outstanding</p>
              <p className="text-lg font-black text-white font-mono">
                {currencySymbol}{outstanding.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Payment Claim Banner (if customer claimed unverified payment) */}
        {selectedInvoice.paymentClaimStatus === 'CLAIMED' && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Payment Claimed by Customer (Unverified)
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  {selectedInvoice.paymentClaimNote || 'Customer reported payment was released. Verification required.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleVerifyClaimedPayment(selectedInvoice.id, true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition"
              >
                <Check className="w-3.5 h-3.5" />
                Confirm Receipt
              </button>
              <button
                onClick={() => handleVerifyClaimedPayment(selectedInvoice.id, false)}
                className="bg-slate-900 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold px-3 py-1.5 rounded-xl text-xs transition"
              >
                Reject Claim
              </button>
            </div>
          </div>
        )}

        {/* Section 1: "Why Isn't This Invoice Paid?" Diagnostic Panel */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Why Isn't This Invoice Paid?
              </h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
              Confidence: {whyDiagnosis.confidence}%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Likely Reason</p>
              <p className="font-semibold text-slate-200">{whyDiagnosis.likelyReason}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Grounded Evidence</p>
              <p className="text-slate-300 leading-relaxed">{whyDiagnosis.evidence}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Recommended Operator Action</p>
              <p className="text-emerald-400 font-semibold">{whyDiagnosis.recommendedAction}</p>
            </div>
          </div>
        </div>

        {/* Section 2: Customer Payment Memory & Behavioral Profile */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-violet-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Customer Payment Memory & Behavioral Intelligence
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase">Avg Delay</p>
              <p className="font-bold text-white font-mono">{customer?.avgPaymentDelayDays || selectedInvoice.daysOverdue} Days</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase">Promise Reliability</p>
              <p className="font-bold text-amber-400 font-mono">
                {customer?.promiseReliability !== undefined ? `${customer.promiseReliability}%` : '75%'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase">Preferred Channel</p>
              <p className="font-bold text-emerald-400">{customer?.preferredChannel || 'Email'}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase">Broken Promises</p>
              <p className="font-bold text-rose-400 font-mono">
                {customer?.missedPromisesCount !== undefined ? customer.missedPromisesCount : selectedInvoice.missedPromisesCount}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
            <p className="text-slate-300">
              <span className="font-bold text-slate-200">Behavior Archetype:</span>{' '}
              {customer?.paymentPersonality || 'Customer requires regular structured reminders and typical approval window.'}
            </p>
            {customer?.typicalBlocker && (
              <p className="text-slate-400 mt-1">
                <span className="font-bold text-slate-300">Typical Blocker:</span> {customer.typicalBlocker}
              </p>
            )}
          </div>
        </div>

        {/* Section 3: Active / Broken Payment Promise Intelligence */}
        {(activePromise || brokenPromise) && (
          <div className={`p-4 rounded-2xl border mb-6 ${
            brokenPromise
              ? 'bg-rose-950/20 border-rose-500/30'
              : 'bg-amber-950/20 border-amber-500/30'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 ${brokenPromise ? 'text-rose-400' : 'text-amber-400'}`} />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${brokenPromise ? 'text-rose-400' : 'text-amber-400'}`}>
                  {brokenPromise ? 'Broken Payment Commitment Detected' : 'Active Payment Commitment'}
                </h4>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                brokenPromise ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {brokenPromise ? 'MISSED COMMITMENT' : 'ACTIVE PROMISE'}
              </span>
            </div>
            <p className="text-xs text-slate-200">
              Amount: <strong className="text-white font-mono">{currencySymbol}{(brokenPromise || activePromise)?.amount.toLocaleString()}</strong> committed by{' '}
              <strong className="text-white">{(brokenPromise || activePromise)?.promisedDate}</strong>.
            </p>
            <p className="text-[11px] text-slate-400 italic mt-1">
              &quot;{(brokenPromise || activePromise)?.quoteText}&quot;
            </p>
          </div>
        )}

        {/* Section 4: AI Next Best Action Engine Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/30 mb-6">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Next Best Action
                  </span>
                  <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-mono border border-emerald-500/40">
                    {decision.action}
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                    Priority: {decision.priority}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  Timing: <strong className="text-white">{decision.recommendedTiming}</strong> &bull; Channel: <strong className="text-white">{decision.recommendedChannel}</strong>
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                {decision.reason}
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                {decision.action !== 'STOP' && (
                  <button
                    onClick={() => {
                      setSelectedInvoice(null);
                      setReviewMessageInvoice(selectedInvoice);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/40"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Review & Send Contextual Message
                  </button>
                )}

                {decision.action !== 'STOP' && (
                  <button
                    onClick={() => handleExecuteDecision(decision.id)}
                    className="bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Execute Action Directly
                  </button>
                )}

                <button
                  onClick={() => setShowPromiseModal(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Log Promise
                </button>

                {selectedInvoice.status !== 'paid' && selectedInvoice.paymentClaimStatus !== 'CLAIMED' && (
                  <button
                    onClick={() => setShowClaimModal(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Log Payment Claim
                  </button>
                )}

                <button
                  onClick={() => setShowPartialModal(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-sky-400 border border-sky-500/30 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Record Partial Payment
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Collection History Timeline */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            Collection Activity & Communication Log
          </h3>

          <div className="space-y-3 pl-3 border-l-2 border-slate-800 text-xs">
            {selectedInvoice.timeline.length > 0 ? (
              selectedInvoice.timeline.map((evt) => (
                <div key={evt.id} className="relative pl-5">
                  <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-slate-950 border-2 border-emerald-500" />
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-200">{evt.title}</p>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(evt.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">{evt.description}</p>
                  {evt.badge && (
                    <span className="inline-block text-[10px] bg-slate-900 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono mt-1">
                      {evt.badge}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-slate-500 italic">No historical communication events recorded yet.</p>
            )}
          </div>
        </div>

        {/* Bottom Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleEscalateInvoice(selectedInvoice.id);
                setSelectedInvoice(null);
              }}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <ShieldAlert className="w-4 h-4" />
              Escalate to Human Review
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                handleRecordPayment(selectedInvoice.id, outstanding, true);
                setSelectedInvoice(null);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-950/40"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark Fully PAID ({currencySymbol}{outstanding.toLocaleString()})
            </button>
          </div>
        </div>

        {/* Partial Payment Input Modal */}
        {showPartialModal && (
          <div className="fixed inset-0 bg-slate-950/80 z-60 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl">
              <h4 className="text-base font-bold text-white mb-2">Record Partial Payment</h4>
              <p className="text-xs text-slate-400 mb-4">
                Total amount: {currencySymbol}{totalAmount.toLocaleString()} &bull; Current outstanding: {currencySymbol}{outstanding.toLocaleString()}
              </p>
              <form onSubmit={submitPartialPayment} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Payment Received ({currencySymbol})</label>
                  <input
                    type="number"
                    max={outstanding}
                    min={1}
                    required
                    value={partialInputAmount}
                    onChange={(e) => setPartialInputAmount(e.target.value)}
                    placeholder={`e.g. ${Math.round(outstanding / 2)}`}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPartialModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400"
                  >
                    Confirm Partial Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Log Payment Promise Modal */}
        {showPromiseModal && (
          <div className="fixed inset-0 bg-slate-950/80 z-60 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl">
              <h4 className="text-base font-bold text-white mb-2">Log Customer Payment Promise</h4>
              <p className="text-xs text-slate-400 mb-4">
                Record payment commitment extracted from customer communication.
              </p>
              <form onSubmit={submitPromise} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Promised Date</label>
                  <input
                    type="date"
                    required
                    value={promiseDate}
                    onChange={(e) => setPromiseDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white text-xs focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Promised Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    value={promiseAmount}
                    onChange={(e) => setPromiseAmount(e.target.value)}
                    placeholder={`Defaults to full balance: ${outstanding}`}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono text-xs focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Customer Quote / Context</label>
                  <input
                    type="text"
                    value={promiseQuote}
                    onChange={(e) => setPromiseQuote(e.target.value)}
                    placeholder='e.g. "We will release payment by Friday"'
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white text-xs focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPromiseModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400"
                  >
                    Save Promise
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Log Customer Payment Claim Modal (CLM-001) */}
        {showClaimModal && (
          <div className="fixed inset-0 bg-slate-950/80 z-60 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl">
              <h4 className="text-base font-bold text-white mb-2">Log Customer Payment Claim</h4>
              <p className="text-xs text-slate-400 mb-4">
                Record an unverified claim from the customer that funds have been sent. Financial balances remain unchanged until verified in your bank ledger.
              </p>
              <form onSubmit={submitClaim} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Claimed Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={outstanding}
                    required
                    value={claimAmount}
                    onChange={(e) => setClaimAmount(e.target.value)}
                    placeholder={`Defaults to full balance: ${outstanding}`}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Payment Reference / UTR / Note
                  </label>
                  <input
                    type="text"
                    required
                    value={claimNote}
                    onChange={(e) => setClaimNote(e.target.value)}
                    placeholder='e.g. UTR / NEFT ref #98721345 or Bank transfer receipt'
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white text-xs focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClaimModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400"
                  >
                    Log Unverified Claim
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
