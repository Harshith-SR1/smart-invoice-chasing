'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check whether an active recovery session exists
  useEffect(() => {
    let isMounted = true;
    let fallbackTimer: NodeJS.Timeout | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;

    async function checkRecoverySession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session) {
          setIsCheckingSession(false);
          setIsSessionExpired(false);
          return;
        }

        // Detect supported Supabase recovery URL parameters (hash tokens or PKCE code/token_hash)
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const search = typeof window !== 'undefined' ? window.location.search : '';
        const hasRecoveryTokens =
          hash.includes('access_token') ||
          hash.includes('type=recovery') ||
          search.includes('code=') ||
          search.includes('token_hash=');

        // Listen for recovery event if tokens are being processed by client
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
          if (!isMounted) return;
          if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && currentSession)) {
            if (fallbackTimer) clearTimeout(fallbackTimer);
            setIsSessionExpired(false);
            setErrorMessage(null);
            setIsCheckingSession(false);
          }
        });
        authSubscription = subscription;

        // Give sufficient window (3000ms) if tokens exist in URL, or 800ms if URL has no tokens
        const timeoutMs = hasRecoveryTokens ? 3000 : 800;

        fallbackTimer = setTimeout(async () => {
          if (!isMounted) return;
          const { data: { session: verifiedSession } } = await supabase.auth.getSession();
          if (!verifiedSession) {
            setIsSessionExpired(true);
            setErrorMessage('Your password reset link is invalid, expired, or missing. Please request a new recovery link.');
          } else {
            setIsSessionExpired(false);
          }
          setIsCheckingSession(false);
        }, timeoutMs);
      } catch {
        if (isMounted) {
          setIsSessionExpired(true);
          setErrorMessage('Unable to verify your recovery session. Please request a new recovery link.');
          setIsCheckingSession(false);
        }
      }
    }

    checkRecoverySession();

    return () => {
      isMounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [supabase]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage('Password must contain at least 8 characters.');
      return;
    }

    if (password.length > 128) {
      setErrorMessage('Password must not exceed 128 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setIsUpdated(false);
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('session') || msg.includes('auth') || msg.includes('expired') || msg.includes('token')) {
          setIsSessionExpired(true);
          setErrorMessage('Your recovery session has expired or is invalid. Please request a new password reset link.');
        } else {
          setErrorMessage(error.message || 'Failed to update password. Please try again.');
        }
      } else {
        setIsUpdated(true);
        setErrorMessage(null);
      }
    } catch (err: any) {
      setIsUpdated(false);
      setErrorMessage(err?.message || 'An unexpected error occurred while updating your password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-slate-950">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[300px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-950 border border-slate-800/90 rounded-3xl p-8 shadow-2xl relative z-10 glass-card">
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

          {isUpdated ? (
            <div role="status" aria-live="polite">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30 mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Password Updated</h1>
              <p className="text-xs text-slate-300 mt-2">Your password has been updated successfully.</p>
            </div>
          ) : isSessionExpired ? (
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Recovery Link Expired</h1>
              <p className="text-xs text-slate-400 mt-1">This link is no longer valid or has expired.</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white tracking-tight">Set new password</h1>
              <p className="text-xs text-slate-400 mt-1">Enter your new password below.</p>
            </>
          )}
        </div>

        {errorMessage && (
          <div
            id="reset-error"
            role="alert"
            aria-live="polite"
            className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isUpdated ? (
          <div className="pt-2">
            <Link
              href="/login"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-wider block text-center"
            >
              Continue to Sign In →
            </Link>
          </div>
        ) : isSessionExpired ? (
          <div className="space-y-4 pt-2">
            <Link
              href="/forgot-password"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-wider block text-center"
            >
              Request New Recovery Link →
            </Link>
            <div className="text-center pt-2">
              <Link href="/login" className="text-xs text-slate-400 hover:text-white transition inline-flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : isCheckingSession ? (
          <div className="text-center py-6 text-xs text-slate-400 flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Verifying recovery link...</span>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4" noValidate>
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  name="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  placeholder="At least 8 characters"
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? 'reset-error' : undefined}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  placeholder="Confirm new password"
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? 'reset-error' : undefined}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isCheckingSession}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50"
            >
              {isLoading ? 'Updating...' : 'Update Password →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
