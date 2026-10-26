import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock, ShieldCheck, ArrowLeft, ArrowUpRight, FileText, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy — Smart Invoice Chasing',
  description: 'Privacy Policy and corporate receivables data handling standards for Smart Invoice Chasing.',
};

export default function PrivacyPage() {
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
                <Lock className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block leading-none">
                Smart Invoice Chasing
              </span>
              <span className="text-[10px] font-mono text-slate-400 leading-none">
                Legal &bull; Privacy Policy
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            <Link
              href="/terms"
              className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition cursor-pointer"
            >
              Terms of Service
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
            <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              Privacy Policy
            </span>
            <Link
              href="/terms"
              className="px-3 py-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            >
              Terms of Service
            </Link>
          </div>
        </div>

        {/* Header Hero */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/30 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Data Protection &bull; Corporate Receivables</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              PRIVACY POLICY
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-mono">
              Smart Invoice Chasing &bull; Effective Date: October 2026
            </p>
          </div>
        </div>

        {/* Commitment Banner */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300 space-y-1.5">
          <p className="font-semibold text-white text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Privacy Commitment</span>
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your privacy and the security of your corporate receivables data are paramount to Smart Invoice Chasing. This Privacy Policy explains how we collect, process, and safeguard your data when using our platform.
          </p>
        </div>

        {/* Legal Sections Container */}
        <div className="bg-[#0b101d] border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed shadow-xl">
          {/* Section 1 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">1.</span> Information We Collect
            </h2>
            <p>We collect information directly from you when you register and configure your workspace, including:</p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-400">
              <li>
                <strong className="text-white">Account Information:</strong> Name, business email, contact phone number, credentials.
              </li>
              <li>
                <strong className="text-white">Workspace Data:</strong> Business name, address, tax identifiers (GSTIN), default currency.
              </li>
              <li>
                <strong className="text-white">Customer &amp; Invoice Data:</strong> Customer names, email addresses, invoice amounts, issue/due dates, payment reference numbers.
              </li>
              <li>
                <strong className="text-white">Communication Records:</strong> Customer reply text, payment promise commitments, AI classification logs.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">2.</span> How We Use Information
            </h2>
            <p>Your information is processed strictly for providing the Service functionality, including:</p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-400">
              <li>Executing automated invoice chasing sequences according to your rules.</li>
              <li>Analyzing customer payment delay patterns and scoring risk profiles.</li>
              <li>Generating executive recovery reports and auditing collection performance.</li>
              <li>Providing customer support and legal notifications.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">3.</span> AI Model Processing
            </h2>
            <p>
              Natural language text from incoming customer responses is processed using secure, privacy-isolated AI classification pipelines. Your customer data is not shared publicly or used to train open third-party foundational models without anonymization.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">4.</span> Data Security &amp; Storage
            </h2>
            <p>
              We implement industry-standard administrative, physical, and technical safeguards to protect your data against unauthorized access, loss, or alteration. Data is stored in secure server infrastructure hosted in cloud data centers with encryption at rest and in transit.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">5.</span> Third-Party Integrations
            </h2>
            <p>
              If you connect third-party integrations (e.g., Gmail, Outlook, QuickBooks, Razorpay, Stripe), data is exchanged securely via API tokens solely to sync invoices and payment statuses as authorized by you.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 pb-6 border-b border-slate-800/80">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">6.</span> User Rights &amp; Data Retention
            </h2>
            <p>
              You have the right to inspect, update, or request deletion of your account and workspace data at any time by contacting support at{' '}
              <a
                href="mailto:support@smart-invoice-chasing.vercel.app"
                className="text-emerald-400 font-mono underline hover:text-emerald-300 transition"
              >
                support@smart-invoice-chasing.vercel.app
              </a>
              . Data is retained for as long as your account remains active.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="text-emerald-400">7.</span> Contact Information
            </h2>
            <p>
              For any privacy inquiries or data requests, please reach out to our team at{' '}
              <a
                href="mailto:support@smart-invoice-chasing.vercel.app"
                className="text-emerald-400 font-mono underline hover:text-emerald-300 transition"
              >
                support@smart-invoice-chasing.vercel.app
              </a>{' '}
              or through your account workspace settings.
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
            <Link href="/terms" className="hover:text-slate-300 transition">
              Terms of Service
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
