'use client';

import React, { useState, useCallback } from 'react';
import { X, Send, RotateCw, Sparkles, HelpCircle, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DecisionTone } from '../../types';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';

type SendState = 'idle' | 'queuing' | 'sending' | 'success' | 'error';

export const AiMessageReviewModal: React.FC = () => {
  const { reviewMessageInvoice, setReviewMessageInvoice, handleSendAiMessage, customers, promises, showToast, workspace } = useApp();

  if (!reviewMessageInvoice) return null;

  return (
    <AiMessageReviewModalInner
      reviewMessageInvoice={reviewMessageInvoice}
      setReviewMessageInvoice={setReviewMessageInvoice}
      handleSendAiMessage={handleSendAiMessage}
      customers={customers}
      promises={promises}
      showToast={showToast}
      workspace={workspace}
    />
  );
};

// Inner component — hooks are always called (conditional render is at outer level)
type Props = {
  reviewMessageInvoice: NonNullable<ReturnType<typeof useApp>['reviewMessageInvoice']>;
  setReviewMessageInvoice: (v: null) => void;
  handleSendAiMessage: (invoiceId: string, subject?: string, body?: string) => void;
  customers: ReturnType<typeof useApp>['customers'];
  promises: ReturnType<typeof useApp>['promises'];
  showToast: ReturnType<typeof useApp>['showToast'];
  workspace: ReturnType<typeof useApp>['workspace'];
};

const AiMessageReviewModalInner: React.FC<Props> = ({
  reviewMessageInvoice,
  setReviewMessageInvoice,
  handleSendAiMessage,
  promises,
  showToast,
  workspace,
}) => {
  const invoicePromises = promises.filter((p) => p.invoiceId === reviewMessageInvoice.id);
  const brokenPromise = invoicePromises.find((p) => p.status === 'BROKEN' || p.status === 'missed');
  const activePromise = invoicePromises.find((p) => p.status === 'ACTIVE' || p.status === 'pending');

  const outstanding =
    reviewMessageInvoice.outstandingAmount !== undefined
      ? reviewMessageInvoice.outstandingAmount
      : reviewMessageInvoice.amount;
  const currencySymbol =
    reviewMessageInvoice.currency.includes('INR') || reviewMessageInvoice.currency === 'INR' ? '₹' : '$';

  const defaultMsg = reviewMessageInvoice.aiRecommendation.suggestedMessage;
  const [subject, setSubject] = useState(defaultMsg.subject);
  const [body, setBody] = useState(defaultMsg.body);
  const [selectedTone, setSelectedTone] = useState<DecisionTone>('Professional');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generateToneMessage = useCallback(
    (tone: DecisionTone) => {
      const custFirst = reviewMessageInvoice.customerName.split(' ')[0];
      const isPartial = (reviewMessageInvoice.paidAmount || 0) > 0;
      let newSub = '';
      let newBody = '';

      if (tone === 'Gentle') {
        newSub = `Friendly Reminder: Invoice ${reviewMessageInvoice.invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()})`;
        newBody = `Hi ${custFirst},\n\nHope you are having a productive week!\n\nJust a quick friendly check-in regarding invoice ${reviewMessageInvoice.invoiceNumber} for ${currencySymbol}${outstanding.toLocaleString()}${isPartial ? ` (remaining balance after your previous payment of ${currencySymbol}${(reviewMessageInvoice.paidAmount || 0).toLocaleString()})` : ''}.\n\nPlease let us know if everything is on track for settlement or if you need any additional details from our end.\n\nWarm regards,\nFinance Team`;
      } else if (tone === 'Firm') {
        newSub = `Urgent Follow-up: Overdue Invoice ${reviewMessageInvoice.invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()})`;
        newBody = `Hi ${custFirst},\n\nWe are following up regarding overdue invoice ${reviewMessageInvoice.invoiceNumber}, which is now ${reviewMessageInvoice.daysOverdue} days past due.\n\n${brokenPromise ? `As discussed, payment of ${currencySymbol}${brokenPromise.amount.toLocaleString()} was committed for ${brokenPromise.promisedDate}, but we have not received confirmation of transfer.\n\n` : ''}The outstanding balance of ${currencySymbol}${outstanding.toLocaleString()} requires your immediate attention today.\n\nPlease share the payment transfer reference or confirm settlement by end of day.\n\nBest regards,\nAccounts Management`;
      } else if (tone === 'Final Escalation') {
        newSub = `FINAL NOTICE: Escalation Pending for Invoice ${reviewMessageInvoice.invoiceNumber}`;
        newBody = `Hi ${custFirst},\n\nDespite multiple follow-ups, invoice ${reviewMessageInvoice.invoiceNumber} for ${currencySymbol}${outstanding.toLocaleString()} remains unpaid (${reviewMessageInvoice.daysOverdue} days overdue).\n\nTo avoid this account being transferred to formal legal collection and service suspension, please ensure funds are credited today.\n\nKindly contact our executive finance desk immediately.\n\nSincerely,\nSenior Finance Operations`;
      } else {
        // Professional
        newSub = `Payment Status: Invoice ${reviewMessageInvoice.invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()})`;
        newBody = `Hi ${custFirst},\n\nFollowing up on invoice ${reviewMessageInvoice.invoiceNumber} for ${currencySymbol}${outstanding.toLocaleString()}${isPartial ? ` (remaining balance)` : ''}.\n\n${activePromise ? `We noted the planned payment for ${activePromise.promisedDate}. ` : ''}Could you please update us on the processing status and expected credit date?\n\nThank you for your cooperation.\n\nBest regards,\nAccounts Receivable`;
      }

      setSubject(newSub);
      setBody(newBody);
    },
    [reviewMessageInvoice, outstanding, currencySymbol, brokenPromise, activePromise]
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
    }, 400);
  };

  const handleSend = async () => {
    if (sendState === 'sending' || sendState === 'queuing' || sendState === 'success') return;

    setSendState('queuing');
    setErrorMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();

      // ── Step 1: Persist draft → queued message row ────────────────────────
      // This gives us a stable DB ID and prevents sending without a record.
      const { data: msgRow, error: insertError } = await supabase
        .from('messages')
        .insert({
          workspace_id: workspace.id,
          invoice_id: reviewMessageInvoice.id,
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
        throw new Error(insertError?.message || 'Failed to create message record. Please try again.');
      }

      const messageRowId = msgRow.id;

      // ── Step 2: Dispatch via server endpoint ──────────────────────────────
      setSendState('sending');

      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // send session cookie
        body: JSON.stringify({
          message_row_id: messageRowId,
          // Pass the exact text the user has edited so the server can sanitise it.
          // The canonical recipient always comes from the DB record, not these fields.
          subject_override: subject,
          body_override: body,
        }),
      });

      const result = await res.json() as { ok: boolean; error?: string; providerMessageId?: string };

      if (!res.ok || !result.ok) {
        throw new Error(result.error || `Server responded ${res.status}`);
      }

      // ── Step 3: Update local state optimistically ─────────────────────────
      handleSendAiMessage(reviewMessageInvoice.id, subject, body);

      setSendState('success');
      showToast('Follow-up email dispatched successfully!', 'success');

      // Auto-close modal after brief success display
      setTimeout(() => setReviewMessageInvoice(null), 1400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
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

        {/* Modal Title */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">AI Recommended Follow-up Message</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Targeting outstanding balance of{' '}
              <strong className="text-white font-mono">
                {currencySymbol}{outstanding.toLocaleString()}
              </strong>{' '}
              for {reviewMessageInvoice.customerName}
            </p>
          </div>
        </div>

        {/* Tone Selector */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Recommended Tone
          </label>
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

        {/* Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">To</label>
            <input
              type="text"
              readOnly
              value={`${reviewMessageInvoice.customerName} <${reviewMessageInvoice.customerEmail}>`}
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

        {/* AI Rationale */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 mb-6">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-1">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            Why this message? (AI Context Rationale)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {brokenPromise
              ? `Follows up directly on the broken promise commitment (${currencySymbol}${brokenPromise.amount.toLocaleString()} on ${brokenPromise.promisedDate}) without using repetitive generic template phrases.`
              : (reviewMessageInvoice.paidAmount || 0) > 0
              ? `Tailored specifically to the remaining ${currencySymbol}${outstanding.toLocaleString()} outstanding balance after partial payment receipt.`
              : defaultMsg.rationale || 'Tailored to customer payment memory and delay history.'}
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
            Email dispatched successfully! Closing…
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
            disabled={isBusy || sendState === 'success'}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
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
