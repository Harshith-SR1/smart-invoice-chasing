'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bot, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { getAuthRedirectUrl } from '../../lib/authRedirect';
import { validateEmail } from '../../lib/authValidation';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const emailRes = validateEmail(email);
    if (!emailRes.isValid) {
      setErrorMessage(emailRes.error || 'Please enter a valid business email.');
      return;
    }

    const normalizedEmail = emailRes.normalized;
    setIsLoading(true);

    try {
      const redirectTo = getAuthRedirectUrl('/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (error.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
          setErrorMessage('Too many password reset requests. Please wait 60 seconds before trying again.');
        } else if (msg.includes('smtp') || msg.includes('delivery') || msg.includes('email provider')) {
          setErrorMessage('Email delivery service is temporarily unavailable. Please try again shortly.');
        } else {
          // Anti-enumeration: preserve honest presentation without crashing or leaking sensitive provider details
          setSubmittedEmail(normalizedEmail);
          setIsSubmitted(true);
        }
      } else {
        setSubmittedEmail(normalizedEmail);
        setIsSubmitted(true);
      }
    } catch {
      // In case of network exception, avoid leaking stack or provider details
      setSubmittedEmail(normalizedEmail);
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Glow backdrop */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[300px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-950 border border-slate-800/90 rounded-3xl p-8 shadow-2xl relative z-10 glass-card">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <span className="font-extrabold text-white text-base tracking-tight">SMART INVOICE</span>
              <span className="text-emerald-400 font-bold text-base ml-1">CHASING</span>
            </div>
          </Link>

          {isSubmitted ? (
            <div role="status" aria-live="polite">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30 mb-3">
                <Mail className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Check your email</h1>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                If an account exists for <strong className="text-white">{submittedEmail || email}</strong>, you will receive a secure password reset link.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white tracking-tight">Reset your password</h1>
              <p className="text-xs text-slate-400 mt-1">
                Enter your business email and we'll send you a secure password reset link.
              </p>
            </>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            id="forgot-error"
            role="alert"
            aria-live="polite"
            className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {!isSubmitted && (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Business Email
              </label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoComplete="email"
                required
                placeholder="you@company.com"
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? 'forgot-error' : undefined}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send reset link →'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center pt-4 border-t border-slate-800/80">
          <Link href="/login" className="text-xs text-emerald-400 font-bold hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
