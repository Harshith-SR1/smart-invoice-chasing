'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  X,
  Send,
  RotateCw,
  Sparkles,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Mail,
  Phone,
  MessageSquare,
  AlertCircle,
  Undo2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DecisionTone, isCollectibleStatus } from '../../types';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';
import { isUuid } from '../../services/accountService';

type SendState = 'idle' | 'queuing' | 'sending' | 'success' | 'error';

export const AiMessageReviewModal: React.FC = () => {
  const {
    reviewMessageInvoice,
    setReviewMessageInvoice,
    handleSendAiMessage,
    invoices,
    decisions,
    customers,
    promises,
    showToast,
    workspace,
  } = useApp();

  if (!reviewMessageInvoice) return null;

  return (
    <AiMessageReviewModalInner
      reviewMessageInvoice={reviewMessageInvoice}
      setReviewMessageInvoice={setReviewMessageInvoice}
      handleSendAiMessage={handleSendAiMessage}
      invoices={invoices}
      decisions={decisions}
      customers={customers}
      promises={promises}
      showToast={showToast}
      workspace={workspace}
    />
  );
};

type Props = {
  reviewMessageInvoice: NonNullable<ReturnType<typeof useApp>['reviewMessageInvoice']>;
  setReviewMessageInvoice: (v: null) => void;
  handleSendAiMessage: (invoiceId: string, subject?: string, body?: string) => void;
  invoices: ReturnType<typeof useApp>['invoices'];
  decisions: ReturnType<typeof useApp>['decisions'];
  customers: ReturnType<typeof useApp>['customers'];
  promises: ReturnType<typeof useApp>['promises'];
  showToast: ReturnType<typeof useApp>['showToast'];
  workspace: ReturnType<typeof useApp>['workspace'];
};

const AiMessageReviewModalInner: React.FC<Props> = ({
  reviewMessageInvoice,
  setReviewMessageInvoice,
  handleSendAiMessage,
  invoices,
  decisions,
  customers,
  promises,
  showToast,
  workspace,
}) => {
  // ── 1. Authoritative Data Grounding ───────────────────────────────────────
  // Find live canonical invoice from current application context
  const liveInvoice = useMemo(() => {
    return invoices.find((inv) => inv.id === reviewMessageInvoice.id) || reviewMessageInvoice;
  }, [invoices, reviewMessageInvoice]);

  // Find authoritative customer record
  const liveCustomer = useMemo(() => {
    return customers.find((c) => c.id === liveInvoice.customerId);
  }, [customers, liveInvoice.customerId]);

  // Find active deterministic AI decision for this invoice
  const activeDecision = useMemo(() => {
    return decisions.find((d) => d.invoiceId === liveInvoice.id || d.id === `dec-${liveInvoice.id}`);
  }, [decisions, liveInvoice.id]);

  const invoiceNumber = liveInvoice.invoiceNumber || 'Unknown Invoice';
  const customerName = liveCustomer?.name || liveInvoice.customerName || 'Customer';
  const customerEmail = liveInvoice.customerEmail || liveCustomer?.email || '';
  const dueDate = liveInvoice.dueDate ? new Date(liveInvoice.dueDate).toLocaleDateString() : 'No due date set';
  const daysOverdue = typeof liveInvoice.daysOverdue === 'number' ? liveInvoice.daysOverdue : 0;

  // Authoritative balance: Confirmed payments reduce balance; unverified claims do not
  const outstanding =
    liveInvoice.outstandingAmount !== undefined
      ? liveInvoice.outstandingAmount
      : Math.max(0, liveInvoice.amount - (liveInvoice.paidAmount || 0));

  const currencySymbol =
    liveInvoice.currency?.includes('INR') || liveInvoice.currency === 'INR' ? '₹' : '$';

  // Ground recommendation variables from active decision
  const recommendedChannel = activeDecision?.recommendedChannel || 'Email';
  const initialTone: DecisionTone = activeDecision?.recommendedTone || 'Professional';
  const originalSubject =
    activeDecision?.suggestedMessage?.subject ||
    liveInvoice.aiRecommendation?.suggestedMessage?.subject ||
    `Payment Status: Invoice ${invoiceNumber}`;
  const originalBody =
    activeDecision?.suggestedMessage?.body ||
    liveInvoice.aiRecommendation?.suggestedMessage?.body ||
    '';
  const rationale =
    activeDecision?.suggestedMessage?.rationale ||
    activeDecision?.reason ||
    liveInvoice.aiRecommendation?.suggestedMessage?.rationale ||
    'Tailored to customer payment memory and delay history.';

  // ── 2. Staleness Tracking ─────────────────────────────────────────────────
  // Snapshot of financial and collection state at the moment the modal is opened
  const [snapshotState, setSnapshotState] = useState({
    invoiceId: liveInvoice.id,
    outstandingAmount: liveInvoice.outstandingAmount,
    paidAmount: liveInvoice.paidAmount,
    status: liveInvoice.status,
    paymentClaimStatus: liveInvoice.paymentClaimStatus,
  });

  const isStale =
    liveInvoice.outstandingAmount !== snapshotState.outstandingAmount ||
    liveInvoice.paidAmount !== snapshotState.paidAmount ||
    liveInvoice.status !== snapshotState.status ||
    liveInvoice.paymentClaimStatus !== snapshotState.paymentClaimStatus;

  // ── 3. Draft & Tone Editing State ─────────────────────────────────────────
  const [subject, setSubject] = useState(originalSubject);
  const [body, setBody] = useState(originalBody);
  const [selectedTone, setSelectedTone] = useState<DecisionTone>(initialTone);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDraftModified = subject !== originalSubject || body !== originalBody;

  const invoicePromises = promises.filter((p) => p.invoiceId === liveInvoice.id);
  const brokenPromise = invoicePromises.find((p) => p.status === 'BROKEN' || p.status === 'missed');
  const activePromise = invoicePromises.find((p) => p.status === 'ACTIVE' || p.status === 'pending');

  const custFirst = customerName.trim().split(' ')[0] || 'Customer';
  const isPartial = (liveInvoice.paidAmount || 0) > 0;

  const generateToneMessage = useCallback(
    (tone: DecisionTone) => {
      let newSub = '';
      let newBody = '';

      if (tone === 'Gentle') {
        newSub = `Friendly Reminder: Invoice ${invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()})`;
        newBody = `Hi ${custFirst},\n\nHope you are having a productive week!\n\nJust a quick friendly check-in regarding invoice ${invoiceNumber} for ${currencySymbol}${outstanding.toLocaleString()}${isPartial ? ` (remaining balance after your previous payment of ${currencySymbol}${(liveInvoice.paidAmount || 0).toLocaleString()})` : ''}.\n\nPlease let us know if everything is on track for settlement or if you need any additional details from our end.\n\nWarm regards,\nFinance Team`;
      } else if (tone === 'Firm') {
        newSub = `Urgent Follow-up: Overdue Invoice ${invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()})`;
        newBody = `Hi ${custFirst},\n\nWe are following up regarding overdue invoice ${invoiceNumber}, which is now ${daysOverdue} days past due.\n\n${brokenPromise ? `As discussed, payment of ${currencySymbol}${brokenPromise.amount.toLocaleString()} was committed for ${brokenPromise.promisedDate}, but we have not received confirmation of transfer.\n\n` : ''}The outstanding balance of ${currencySymbol}${outstanding.toLocaleString()} requires your immediate attention today.\n\nPlease share the payment transfer reference or confirm settlement by end of day.\n\nBest regards,\nAccounts Management`;
      } else if (tone === 'Final Escalation') {
        newSub = `FINAL NOTICE: Escalation Pending for Invoice ${invoiceNumber}`;
        newBody = `Hi ${custFirst},\n\nDespite multiple follow-ups, invoice ${invoiceNumber} for ${currencySymbol}${outstanding.toLocaleString()} remains unpaid (${daysOverdue} days overdue).\n\nTo avoid this account being transferred to formal legal collection and service suspension, please ensure funds are credited today.\n\nKindly contact our executive finance desk immediately.\n\nSincerely,\nSenior Finance Operations`;
      } else {
        // Professional
        newSub = `Payment Status: Invoice ${invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()})`;
        newBody = `Hi ${custFirst},\n\nFollowing up on invoice ${invoiceNumber} for ${currencySymbol}${outstanding.toLocaleString()}${isPartial ? ` (remaining balance)` : ''}.\n\n${activePromise ? `We noted the planned payment for ${activePromise.promisedDate}. ` : ''}Could you please update us on the processing status and expected credit date?\n\nThank you for your cooperation.\n\nBest regards,\nAccounts Receivable`;
      }

      setSubject(newSub);
      setBody(newBody);
    },
    [invoiceNumber, currencySymbol, outstanding, custFirst, isPartial, liveInvoice.paidAmount, daysOverdue, brokenPromise, activePromise]
  );

  const handleToneChange = (tone: DecisionTone) => {
    setSelectedTone(tone);
    generateToneMessage(tone);
  };

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setIsRegenerating(false);
      generateToneMessage(selectedTone);
      showToast('Regenerated message with fresh AI operator context!', 'info');
    }, 300);
  };

  const handleRefreshToLatest = () => {
    setSnapshotState({
      invoiceId: liveInvoice.id,
      outstandingAmount: liveInvoice.outstandingAmount,
      paidAmount: liveInvoice.paidAmount,
      status: liveInvoice.status,
      paymentClaimStatus: liveInvoice.paymentClaimStatus,
    });
    generateToneMessage(selectedTone);
    showToast('Refreshed review modal with latest financial records.', 'info');
  };

  const handleResetToRecommendation = () => {
    setSubject(originalSubject);
    setBody(originalBody);
    setSelectedTone(initialTone);
    showToast('Reset to original AI recommendation.', 'info');
  };

  // ── 4. Dispatch Preconditions & Eligibility Guards ────────────────────────
  const isCollectible = isCollectibleStatus(liveInvoice.status);
  const isSettled = outstanding <= 0 || liveInvoice.status === 'paid';
  const hasClaimPending = liveInvoice.paymentClaimStatus === 'CLAIMED';
  const isStopDecision = activeDecision?.action === 'STOP';
  const isEmailChannel = recommendedChannel === 'Email';
  const hasValidRecipient = Boolean(customerEmail && customerEmail.includes('@'));
  const isRealWs = isUuid(workspace.id) && workspace.id !== 'ws-default';

  let dispatchBlocker: string | null = null;
  if (isStale) {
    dispatchBlocker = 'Invoice financial state has changed. Please refresh to latest data before sending.';
  } else if (hasClaimPending) {
    dispatchBlocker = 'Invoice has an unverified payment claim awaiting verification. Outbound reminders are paused.';
  } else if (isSettled) {
    dispatchBlocker = 'Invoice is fully settled. Chasing reminders cannot be dispatched.';
  } else if (liveInvoice.status === 'draft') {
    dispatchBlocker = 'Invoice is in draft status. Only finalized and issued invoices can be dispatched.';
  } else if (!isCollectible) {
    dispatchBlocker = `Invoice status is ${liveInvoice.status}. Collections outreach is inactive.`;
  } else if (isStopDecision) {
    dispatchBlocker = 'AI decision engine recommended STOP for this invoice. Automated outreach is halted.';
  } else if (!isEmailChannel) {
    dispatchBlocker = `Recommended channel is ${recommendedChannel}. Direct automated dispatch is only supported for Email. Please contact customer via manual telephony or messaging.`;
  } else if (!hasValidRecipient) {
    dispatchBlocker = 'Customer email address is missing or invalid. Add an email to dispatch.';
  }

  // ── 5. Dispatch Execution ─────────────────────────────────────────────────
  const handleSend = async () => {
    if (dispatchBlocker) {
      showToast(dispatchBlocker, 'error');
      return;
    }
    if (sendState === 'sending' || sendState === 'queuing' || sendState === 'success') return;

    if (!isRealWs) {
      setErrorMessage('Dispatch is disabled in Demo / Preview Mode. Sign in with an authenticated workspace to dispatch live messages.');
      setSendState('error');
      showToast('Dispatch is disabled in Demo Mode.', 'error');
      return;
    }

    setSendState('queuing');
    setErrorMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();

      // ── Step 1: Persist draft → queued message row ────────────────────────
      const { data: msgRow, error: insertError } = await supabase
        .from('messages')
        .insert({
          workspace_id: workspace.id,
          invoice_id: liveInvoice.id,
          sender_type: 'ai',
          sender_name: workspace.businessName || 'Finance Team',
          sender_email: workspace.businessEmail || '',
          subject: subject,
          body: body,
          delivery_status: 'queued',
        })
        .select('id')
        .single();

      if (insertError || !msgRow?.id) {
        throw new Error(insertError?.message || 'Failed to create message record in database.');
      }

      const messageRowId = msgRow.id;

      // ── Step 2: Dispatch via server endpoint ──────────────────────────────
      setSendState('sending');

      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message_row_id: messageRowId,
          subject_override: subject,
          body_override: body,
        }),
      });

      const result = (await res.json()) as { ok: boolean; error?: string; providerMessageId?: string; status?: string };

      if (!res.ok || !result.ok) {
        throw new Error(result.error || `Server dispatch failed (${res.status})`);
      }

      // ── Step 3: Update local state ─────────────────────────────────────────
      handleSendAiMessage(liveInvoice.id, subject, body);

      setSendState('success');
      showToast('Follow-up email dispatched successfully via email provider!', 'success');

      // Auto-close modal after brief success display
      setTimeout(() => setReviewMessageInvoice(null), 1400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected dispatch error occurred.';
      setErrorMessage(msg);
      setSendState('error');
      showToast(msg, 'error');
    }
  };

  const isBusy = sendState === 'queuing' || sendState === 'sending';

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto">
        {/* Close Button */}
        <button
          onClick={() => setReviewMessageInvoice(null)}
          disabled={isBusy}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white leading-tight">AI Recommended Follow-up Message</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                {recommendedChannel === 'Email' ? (
                  <Mail className="w-3 h-3 text-emerald-400" />
                ) : recommendedChannel === 'Phone' ? (
                  <Phone className="w-3 h-3 text-blue-400" />
                ) : (
                  <MessageSquare className="w-3 h-3 text-green-400" />
                )}
                Channel: {recommendedChannel}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Invoice #{invoiceNumber} • Due: {dueDate} • Outstanding:{' '}
              <strong className="text-white font-mono">
                {currencySymbol}{outstanding.toLocaleString()}
              </strong>{' '}
              for {customerName}
            </p>
          </div>
        </div>

        {/* Stale Preview Warning Banner */}
        {isStale && (
          <div className="flex items-start justify-between gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-5 text-xs text-amber-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Stale Preview Detected</strong>
                <p className="text-amber-300/90 text-[11px] mt-0.5">
                  The invoice financial state or settlement records have changed since this review was opened. The current draft preview has been invalidated.
                </p>
              </div>
            </div>
            <button
              onClick={handleRefreshToLatest}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        )}

        {/* Dispatch Blocker Notice */}
        {dispatchBlocker && !isStale && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 mb-5 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Dispatch Inactive</strong>
              <p className="text-red-300/90 text-[11px] mt-0.5">{dispatchBlocker}</p>
            </div>
          </div>
        )}

        {/* Tone Selector & Draft State */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Recommended Tone
            </label>
            {isDraftModified && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md font-medium">
                  Customized by Operator
                </span>
                <button
                  type="button"
                  onClick={handleResetToRecommendation}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 font-medium transition"
                >
                  <Undo2 className="w-3 h-3" />
                  Reset
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(['Gentle', 'Professional', 'Firm', 'Final Escalation'] as const).map((tone) => (
              <button
                key={tone}
                type="button"
                disabled={isBusy}
                onClick={() => handleToneChange(tone)}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer text-center ${
                  selectedTone === tone
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {tone}
              </button>
            ))}
          </div>
        </div>

        {/* Message Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Destination Contact</label>
            <input
              type="text"
              readOnly
              value={customerEmail ? `${customerName} <${customerEmail}>` : `${customerName} (No destination email on file)`}
              className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              disabled={isBusy}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">Message Body</label>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isRegenerating || isBusy}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
            </div>
            <textarea
              rows={7}
              value={body}
              disabled={isBusy}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 leading-relaxed font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* AI Context Rationale */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 mb-6">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-1">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            Why this message? (AI Context Rationale)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {brokenPromise
              ? `Follows up directly on the broken promise commitment (${currencySymbol}${brokenPromise.amount.toLocaleString()} on ${brokenPromise.promisedDate}) without using generic template phrases.`
              : isPartial
              ? `Tailored specifically to the remaining ${currencySymbol}${outstanding.toLocaleString()} outstanding balance after partial payment receipt.`
              : rationale}
          </p>
        </div>

        {/* Error Banner */}
        {sendState === 'error' && errorMessage && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 mb-4 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Banner */}
        {sendState === 'success' && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 mb-4 text-xs text-emerald-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            Follow-up email dispatched successfully! Closing…
          </div>
        )}

        {/* Modal Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={() => setReviewMessageInvoice(null)}
            disabled={isBusy}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            onClick={handleSend}
            disabled={isBusy || Boolean(dispatchBlocker) || sendState === 'success'}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {sendState === 'queuing' ? 'Preparing…' : 'Dispatching…'}
              </>
            ) : sendState === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Sent!
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Approve &amp; Dispatch Follow-Up
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
