'use client';

import React, { useState } from 'react';
import { CheckCircle2, DollarSign, X } from 'lucide-react';
import { Invoice } from '../../types';
import { useApp } from '../../context/AppContext';

interface MarkAsPaidModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export const MarkAsPaidModal: React.FC<MarkAsPaidModalProps> = ({ invoice, onClose }) => {
  const { handleRecordPayment } = useApp();
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [customAmount, setCustomAmount] = useState<string>('');

  if (!invoice) return null;

  const totalAmount = invoice.amount;
  const paidAmount = invoice.paidAmount || 0;
  const outstanding = invoice.outstandingAmount !== undefined ? invoice.outstandingAmount : totalAmount - paidAmount;
  const currencySymbol = invoice.currency.includes('INR') || invoice.currency === 'INR' ? '₹' : '$';

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentType === 'full') {
      handleRecordPayment(invoice.id, outstanding, true);
    } else {
      const val = Number(customAmount);
      if (val > 0) {
        handleRecordPayment(invoice.id, val, false);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">Record Payment Receipt</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-sans">Customer</span>
              <span className="text-white font-bold font-sans">{invoice.customerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-sans">Invoice #</span>
              <span className="text-emerald-400 font-bold">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-sans">Current Outstanding</span>
              <span className="text-white font-bold">{currencySymbol}{outstanding.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">Payment Option</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType('full')}
                className={`py-2 px-3 rounded-xl font-semibold text-xs border transition cursor-pointer ${
                  paymentType === 'full'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                Full Settle ({currencySymbol}{outstanding.toLocaleString()})
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('partial')}
                className={`py-2 px-3 rounded-xl font-semibold text-xs border transition cursor-pointer ${
                  paymentType === 'partial'
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                Partial Payment
              </button>
            </div>
          </div>

          {paymentType === 'partial' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Amount Received ({currencySymbol})
              </label>
              <input
                type="number"
                min={1}
                max={outstanding}
                required
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder={`e.g. ${Math.round(outstanding / 2)}`}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:border-emerald-500 outline-none"
              />
            </div>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Verified payments reduce outstanding balances, update customer payment memory, and record verified recovery events.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              Confirm Receipt ✓
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
