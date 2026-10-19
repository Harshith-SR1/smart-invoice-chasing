'use client';

import React from 'react';
import { X, ShieldCheck, FileText, Lock } from 'lucide-react';

interface PolicyModalProps {
  isOpen: boolean;
  type: 'terms' | 'privacy' | null;
  onClose: () => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({ isOpen, type, onClose }) => {
  if (!isOpen || !type) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Modal backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-[#070b14] border border-slate-800 rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden font-sans text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              {type === 'terms' ? <FileText className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                {type === 'terms' ? 'TERMS OF SERVICE' : 'PRIVACY POLICY'}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Smart Invoice Chasing &bull; Effective Date: October 2026
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300 leading-relaxed font-sans select-text">
          {type === 'terms' ? (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300 space-y-1">
                <p className="font-semibold text-white">Notice & Disclaimer</p>
                <p className="text-[11px] text-slate-400">
                  This Terms of Service agreement applies to your access and use of the Smart Invoice Chasing platform. Please read these terms carefully before creating an account.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">1. Introduction & Acceptance</h3>
                <p>
                  By creating an account, accessing, or using Smart Invoice Chasing (&quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you are entering into these Terms on behalf of a company or other legal entity, you represent that you have the authority to bind such entity to these Terms.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">2. Description of Service</h3>
                <p>
                  Smart Invoice Chasing provides an AI-assisted receivables recovery agent platform designed to monitor invoice due dates, generate automated follow-up sequences, classify customer communication responses, track payment promises, and escalate delinquent accounts to human intervention.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">3. Account Creation & Workspace Setup</h3>
                <p>
                  You must register for an account by providing accurate, current, and complete business information (business name, registered business address, financial contact details). You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your workspace account.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">4. Invoice Data & Customer Content</h3>
                <p>
                  You retain all ownership rights to the invoice details, customer contact data, transaction history, and communication records you upload or connect to the Service (&quot;Customer Content&quot;). You grant Smart Invoice Chasing a limited, non-exclusive license to process, store, and display Customer Content solely to provide and improve the Service.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">5. AI Recommendations & Automated Chasing</h3>
                <p>
                  The Service uses artificial intelligence algorithms to evaluate payment risks, suggest messaging templates, and execute scheduled follow-up reminders. You acknowledge that AI recommendations are tools for operational support. Where human review is recommended or required by your business settings, you retain final responsibility for reviewing and approving actions taken toward your customers.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">6. Email Communications</h3>
                <p>
                  You agree to ensure that all customer contact details uploaded to the Service comply with applicable anti-spam laws. You acknowledge that communications dispatched by the Service (email notifications) are authorized by you as an agent acting on your behalf.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">7. No Guarantee of Payment Recovery</h3>
                <p>
                  SMART INVOICE CHASING IS A SOFTWARE TOOL TO ASSIST IN RECEIVABLES COLLECTION. SMART INVOICE CHASING DOES NOT GUARANTEE THAT ANY OVERDUE INVOICE WILL BE COLLECTED OR THAT ANY CUSTOMER WILL FULFILL A PAYMENT PROMISE.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">8. Fees, Subscriptions & Billing</h3>
                <p>
                  Access to premium features is billed on a subscription basis (e.g. Early Access at ₹999/month or Growth at ₹2,499/month). Fees are non-refundable except as required by law. Subscriptions automatically renew unless cancelled prior to the billing cycle renewal date.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">9. Prohibited Uses</h3>
                <p>
                  You may not use the Service for fraudulent purposes, harassment, sending unlawful communications, attempting unauthorized access to other accounts, or reverse-engineering the AI decision models.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">10. Limitation of Liability</h3>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL SMART INVOICE CHASING BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING OUT OF YOUR USE OR INABILITY TO USE THE SERVICE.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">11. Governing Law & Contact</h3>
                <p>
                  These Terms shall be governed by and construed in accordance with applicable state and federal laws. For support or legal inquiries, please contact: <span className="text-emerald-400 font-mono">support@smart-invoice-chasing.vercel.app</span>.
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300 space-y-1">
                <p className="font-semibold text-white">Privacy Commitment</p>
                <p className="text-[11px] text-slate-400">
                  Your privacy and the security of your corporate receivables data are paramount to Smart Invoice Chasing. This Privacy Policy explains how we collect, process, and safeguard your data.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">1. Information We Collect</h3>
                <p>We collect information directly from you when you register and configure your workspace, including:</p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-slate-400">
                  <li><strong className="text-white">Account Information:</strong> Name, business email, contact phone number, credentials.</li>
                  <li><strong className="text-white">Workspace Data:</strong> Business name, address, tax identifiers (GSTIN), default currency.</li>
                  <li><strong className="text-white">Customer & Invoice Data:</strong> Customer names, email addresses, invoice amounts, issue/due dates, payment reference numbers.</li>
                  <li><strong className="text-white">Communication Records:</strong> Customer reply text, payment promise commitments, AI classification logs.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">2. How We Use Information</h3>
                <p>Your information is processed strictly for providing the Service functionality, including:</p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-slate-400">
                  <li>Executing automated invoice chasing sequences according to your rules.</li>
                  <li>Analyzing customer payment delay patterns and scoring risk profiles.</li>
                  <li>Generating executive recovery reports and auditing collection performance.</li>
                  <li>Providing customer support and legal notifications.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">3. AI Model Processing</h3>
                <p>
                  Natural language text from incoming customer responses is processed using secure, privacy-isolated AI classification pipelines. Your customer data is not shared publicly or used to train open third-party foundational models without anonymization.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">4. Data Security & Storage</h3>
                <p>
                  We implement industry-standard administrative, physical, and technical safeguards to protect your data against unauthorized access, loss, or alteration. Data is stored in secure server infrastructure hosted in cloud data centers.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">5. Third-Party Integrations</h3>
                <p>
                  If you connect third-party integrations (e.g., Gmail, Outlook, QuickBooks, Razorpay, Stripe), data is exchanged securely via API tokens solely to sync invoices and payment statuses as authorized by you.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">6. User Rights & Data Retention</h3>
                <p>
                  You have the right to inspect, update, or request deletion of your account and workspace data at any time by contacting support at <span className="text-emerald-400 font-mono">support@smart-invoice-chasing.vercel.app</span>. Data is retained for as long as your account remains active.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">7. Contact Information</h3>
                <p>
                  For any privacy inquiries or data requests, please reach out to our team at <span className="text-emerald-400 font-mono">support@smart-invoice-chasing.vercel.app</span> or through your account workspace settings.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80 shrink-0">
          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Terms &amp; Privacy &bull; Smart Invoice Chasing</span>
          </span>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs border border-slate-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
