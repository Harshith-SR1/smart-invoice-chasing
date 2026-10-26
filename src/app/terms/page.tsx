import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, ShieldCheck, ArrowLeft, ArrowUpRight, Lock, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service — Smart Invoice Chasing',
  description: 'Terms of Service agreement governing access and use of the Smart Invoice Chasing platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-white hover:opacity-90 transition group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#070b14] rounded-[10px] flex items-center justify-center">
                <FileText className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block leading-none">
                Smart Invoice Chasing
              </span>
              <span className="text-[10px] font-mono text-slate-400 leading-none">
                Legal &bull; Terms of Service
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            <Link
              href="/privacy"
              className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition cursor-pointer"
            >
              Privacy Policy
            </Link>
            <Link
              href="/login"
              className="text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition cursor-pointer"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-3.5 py-1.5 rounded-lg transition shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-emerald-400 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>

          {/* Quick Switch Tab Pill */}
          <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-medium">
            <Link
              href="/privacy"
              className="px-3 py-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            >
              Privacy Policy
            </Link>
            <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              Terms of Service
            </span>
          </div>
        </div>

        {/* Header Hero */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/30 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Commercial Terms &bull; Service Agreement</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              TERMS OF SERVICE
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-mono">
              Smart Invoice Chasing &bull; Effective Date: October 2026
            </p>
          </div>
        </div>

        {/* Notice & Disclaimer Banner */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300 space-y-1.5">
          <p className="font-semibold text-white text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Notice &amp; Disclaimer</span>
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            This Terms of Service agreement applies to your access and use of the Smart Invoice Chasing platform. Please read these terms carefully before creating an account or connecting invoices.
          </p>
        </div>

        {/* Legal Sections Container */}
        <div className="bg-[#0b101d] border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed shadow-xl">
          {/* Section 1 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">1.</span> Introduction &amp; Acceptance
            </h2>
            <p>
              By creating an account, accessing, or using Smart Invoice Chasing (&quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you are entering into these Terms on behalf of a company or other legal entity, you represent that you have the authority to bind such entity to these Terms.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">2.</span> Description of Service
            </h2>
            <p>
              Smart Invoice Chasing provides an AI-assisted receivables recovery agent platform designed to monitor invoice due dates, generate automated follow-up sequences, classify customer communication responses, track payment promises, and escalate delinquent accounts to human intervention.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">3.</span> Account Creation &amp; Workspace Setup
            </h2>
            <p>
              You must register for an account by providing accurate, current, and complete business information (business name, registered business address, financial contact details). You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your workspace account.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">4.</span> Invoice Data &amp; Customer Content
            </h2>
            <p>
              You retain all ownership rights to the invoice details, customer contact data, transaction history, and communication records you upload or connect to the Service (&quot;Customer Content&quot;). You grant Smart Invoice Chasing a limited, non-exclusive license to process, store, and display Customer Content solely to provide and improve the Service.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">5.</span> AI Recommendations &amp; Automated Chasing
            </h2>
            <p>
              The Service uses artificial intelligence algorithms to evaluate payment risks, suggest messaging templates, and execute scheduled follow-up reminders. You acknowledge that AI recommendations are tools for operational support. Where human review is recommended or required by your business settings, you retain final responsibility for reviewing and approving actions taken toward your customers.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">6.</span> Email Communications
            </h2>
            <p>
              You agree to ensure that all customer contact details uploaded to the Service comply with applicable anti-spam laws. You acknowledge that communications dispatched by the Service (email notifications) are authorized by you as an agent acting on your behalf.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">7.</span> No Guarantee of Payment Recovery
            </h2>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 font-mono text-xs leading-relaxed">
              SMART INVOICE CHASING IS A SOFTWARE TOOL TO ASSIST IN RECEIVABLES COLLECTION. SMART INVOICE CHASING DOES NOT GUARANTEE THAT ANY OVERDUE INVOICE WILL BE COLLECTED OR THAT ANY CUSTOMER WILL FULFILL A PAYMENT PROMISE.
            </div>
          </section>

          {/* Section 8 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">8.</span> Fees, Subscriptions &amp; Billing
            </h2>
            <p>
              Access to premium features is billed on a subscription basis (e.g. Early Access at ₹999/month or Growth at ₹2,499/month). Fees are non-refundable except as required by law. Subscriptions automatically renew unless cancelled prior to the billing cycle renewal date.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">9.</span> Prohibited Uses
            </h2>
            <p>
              You may not use the Service for fraudulent purposes, harassment, sending unlawful communications, attempting unauthorized access to other accounts, or reverse-engineering the AI decision models.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">10.</span> Limitation of Liability
            </h2>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 font-mono text-xs leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL SMART INVOICE CHASING BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING OUT OF YOUR USE OR INABILITY TO USE THE SERVICE.
            </div>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">11.</span> Governing Law &amp; Contact
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable state and federal laws. For support or legal inquiries, please contact:{' '}
              <a
                href="mailto:support@smart-invoice-chasing.vercel.app"
                className="text-emerald-400 font-mono underline hover:text-emerald-300 transition"
              >
                support@smart-invoice-chasing.vercel.app
              </a>
              .
            </p>
          </section>
        </div>

        {/* Footer Navigation Bar */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>&copy; {new Date().getFullYear()} Smart Invoice Chasing. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-300 transition">
              Privacy Policy
            </Link>
            <Link href="/login" className="hover:text-slate-300 transition">
              Sign In
            </Link>
            <Link href="/" className="hover:text-slate-300 transition">
              Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
