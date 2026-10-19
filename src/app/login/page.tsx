'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { useApp } from '../../context/AppContext';
import { getAuthRedirectUrl, getSafeRedirectDestination } from '../../lib/authRedirect';
import { validateEmail } from '../../lib/authValidation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setActiveScreen, showToast } = useApp();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  // Validate and sanitize the next destination parameter
  const rawNext = searchParams.get('next');
  const safeNext = getSafeRedirectDestination(rawNext);

  // Check if session exists or if error param exists on load
  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError) {
      if (urlError === 'auth_callback_failed') {
        setErrorMessage('Google authentication could not be completed. Please try again.');
      } else {
        setErrorMessage(decodeURIComponent(urlError));
      }
    }

    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (safeNext) {
          router.push(safeNext);
          return;
        }

        // If already authenticated and no next parameter, check workspace
        const { data: workspaces } = await supabase
          .from('workspaces')
          .select('id')
          .eq('user_id', session.user.id)
          .limit(1);

        if (workspaces && workspaces.length > 0) {
          router.push('/dashboard');
        } else {
          router.push('/setup');
        }
      }
    }
    checkAuth();
  }, [router, supabase, searchParams, safeNext]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    setUnconfirmedEmail(null);

    // Check if Supabase keys are placeholder
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (!supabaseUrl || supabaseUrl.includes('your-supabase-project')) {
      setErrorMessage(
        'Google OAuth requires your Supabase URL & Anon Key in .env.local. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      );
      setIsGoogleLoading(false);
      return;
    }

    try {
      const callbackPath = safeNext
        ? `/auth/callback?next=${encodeURIComponent(safeNext)}`
        : '/auth/callback';
      const redirectTo = getAuthRedirectUrl(callbackPath);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setIsGoogleLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to connect to Google OAuth.');
      setIsGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setUnconfirmedEmail(null);

    const emailRes = validateEmail(email);
    if (!emailRes.isValid) {
      setErrorMessage(emailRes.error || 'Please enter a valid business email.');
      return;
    }
    const trimmedEmail = emailRes.normalized;
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsEmailLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('email not confirmed')) {
          setUnconfirmedEmail(trimmedEmail);
          setErrorMessage('Your email address has not been confirmed yet. Please verify using the 6-digit code sent to your email.');
        } else if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          setErrorMessage('Invalid email or password. Please verify your credentials.');
        } else if (error.status === 429 || msg.includes('too many requests') || msg.includes('rate limit')) {
          setErrorMessage('Too many sign-in attempts. Please wait 60 seconds before trying again.');
        } else {
          setErrorMessage(error.message || 'Incorrect email or password.');
        }
        setIsEmailLoading(false);
        return;
      }

      if (data.user && data.session) {
        showToast('Welcome back!', 'success');
        setActiveScreen('dashboard');

        // Route to safe next destination if provided
        if (safeNext) {
          router.push(safeNext);
          return;
        }

        // Check if workspace exists
        const { data: workspaces } = await supabase
          .from('workspaces')
          .select('id')
          .eq('user_id', data.user.id)
          .limit(1);

        if (workspaces && workspaces.length > 0) {
          router.push('/dashboard');
        } else {
          router.push('/setup');
        }
      } else {
        setErrorMessage('Authentication could not be established. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during sign in. Please try again.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden selection:bg-emerald-500 selection:text-slate-950 font-sans">
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-xs text-slate-400 mt-1">Sign in to continue recovering your money.</p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            id="login-error"
            role="alert"
            aria-live="polite"
            className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {unconfirmedEmail && (
                  <div className="mt-2.5 pt-2 border-t border-rose-500/20">
                    <Link
                      href={`/signup?verify=true&email=${encodeURIComponent(unconfirmedEmail)}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 underline"
                    >
                      Enter 6-digit verification code →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Business Email & Password Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Business Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="you@company.com"
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? 'login-error' : undefined}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300">
                Password
              </label>
              <Link href="/forgot-password" className="text-[11px] text-emerald-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? 'login-error' : undefined}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isEmailLoading || isGoogleLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer"
          >
            {isEmailLoading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="h-px bg-slate-800 flex-1" />
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">OR</span>
          <div className="h-px bg-slate-800 flex-1" />
        </div>

        {/* Google OAuth Option */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isEmailLoading}
          className="w-full bg-slate-900 hover:bg-slate-800 text-slate-100 font-semibold py-3 px-4 rounded-xl border border-slate-700 transition duration-200 flex items-center justify-center gap-3 shadow-md disabled:opacity-50 text-xs cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          {isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}
        </button>

        {/* Bottom Switcher */}
        <div className="mt-8 text-center pt-4 border-t border-slate-800/80">
          <p className="text-xs text-slate-400">
            Don't have an account?{' '}
            <Link href="/signup" className="text-emerald-400 font-bold hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
