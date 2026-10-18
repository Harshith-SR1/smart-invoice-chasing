'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Eye, EyeOff, AlertCircle, CheckCircle2, Mail, RefreshCw, ArrowLeft, ShieldCheck } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { useApp } from '../../context/AppContext';
import { PolicyModal } from '../../components/common/PolicyModal';
import { getAuthRedirectUrl } from '../../lib/authRedirect';
import { ensureUserWorkspaceProvisioned } from '../../lib/workspaceProvisioning';
import {
  validateFullName,
  validatePhoneNumber,
  validateEmail,
  validatePassword,
  validateSignupPayload,
} from '../../lib/authValidation';

export default function SignupPage() {
  const router = useRouter();
  const { setActiveScreen, showToast } = useApp();
  const supabase = createClient();

  // Signup form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Inline field validation errors
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [agreeTermsError, setAgreeTermsError] = useState<string | null>(null);

  const [policyModalType, setPolicyModalType] = useState<'terms' | 'privacy' | null>(null);

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // OTP Verification state
  const [isVerifyStep, setIsVerifyStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccessMessage, setResendSuccessMessage] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Check URL params on mount (for users redirected from login to verify)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const verify = params.get('verify');
      const emailParam = params.get('email');
      if (verify === 'true' && emailParam) {
        setEmail(decodeURIComponent(emailParam));
        setIsVerifyStep(true);
      }
    }
  }, []);

  // 60-second resend cooldown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Live field blur validators
  const handleBlurFullName = () => {
    if (!fullName) return;
    const res = validateFullName(fullName);
    setFullNameError(res.isValid ? null : res.error || 'Invalid name');
  };

  const handleBlurPhone = () => {
    if (!phone) return;
    const res = validatePhoneNumber(phone, 'IN');
    setPhoneError(res.isValid ? null : res.error || 'Invalid phone number');
  };

  const handleBlurEmail = () => {
    if (!email) return;
    const res = validateEmail(email);
    setEmailError(res.isValid ? null : res.error || 'Invalid email address');
  };

  const handleBlurPassword = () => {
    if (!password) return;
    const res = validatePassword(password);
    setPasswordError(res.isValid ? null : res.error || 'Invalid password');
  };

  const handleBlurConfirmPassword = () => {
    if (!confirmPassword) return;
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
    } else {
      setConfirmPasswordError(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (!supabaseUrl || supabaseUrl.includes('your-supabase-project')) {
      setErrorMessage(
        'Google OAuth requires your Supabase URL & Anon Key in .env.local. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      );
      setIsGoogleLoading(false);
      return;
    }

    try {
      const redirectTo = getAuthRedirectUrl('/auth/callback');
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Clear inline errors before full validation run
    setFullNameError(null);
    setPhoneError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setAgreeTermsError(null);

    // Comprehensive payload validation
    const validation = validateSignupPayload({
      fullName,
      phone,
      email,
      password,
      confirmPassword,
      agreeTerms,
    });

    if (!validation.isValid) {
      if (validation.errors.fullName) setFullNameError(validation.errors.fullName);
      if (validation.errors.phone) setPhoneError(validation.errors.phone);
      if (validation.errors.email) setEmailError(validation.errors.email);
      if (validation.errors.password) setPasswordError(validation.errors.password);
      if (validation.errors.confirmPassword) setConfirmPasswordError(validation.errors.confirmPassword);
      if (validation.errors.agreeTerms) setAgreeTermsError(validation.errors.agreeTerms);

      const firstError =
        validation.errors.fullName ||
        validation.errors.phone ||
        validation.errors.email ||
        validation.errors.password ||
        validation.errors.confirmPassword ||
        validation.errors.agreeTerms;

      setErrorMessage(firstError || 'Please fix the highlighted errors before submitting.');
      return;
    }

    setIsEmailLoading(true);

    try {
      const emailRedirectTo = getAuthRedirectUrl('/auth/callback');
      const { data, error } = await supabase.auth.signUp({
        email: validation.sanitized.email,
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: validation.sanitized.fullName,
            phone: validation.sanitized.phoneE164,
          },
        },
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('already registered') || msg.includes('exists')) {
          setErrorMessage('An account with this email already exists. Please sign in instead.');
        } else if (error.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
          setErrorMessage('Too many signup attempts. Please wait 60 seconds before trying again.');
        } else if (
          msg.includes('smtp') ||
          msg.includes('error sending confirmation email') ||
          msg.includes('email provider') ||
          msg.includes('failed to send')
        ) {
          setErrorMessage(
            'Email delivery service could not send the verification code. Please check your email address or try again shortly.'
          );
        } else {
          setErrorMessage(error.message);
        }
        setIsEmailLoading(false);
        return;
      }

      if (data.user && data.session) {
        // Immediate session granted (email confirmation disabled in Supabase)
        showToast('Account created successfully!', 'success');
        setActiveScreen('dashboard');

        // Provision workspace and profile idempotently
        await ensureUserWorkspaceProvisioned(supabase, data.user, validation.sanitized.fullName);
        router.push('/dashboard');
      } else if (data.user && !data.session) {
        // Email confirmation required -> transition to OTP screen
        setIsVerifyStep(true);
        setResendCooldown(60);
      } else {
        setErrorMessage('Could not initiate account creation. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create account. Please try again.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifyingOtp) return;

    setOtpError(null);
    setResendSuccessMessage(null);

    const cleanCode = otpCode.trim().replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      setOtpError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);

    try {
      const emailValidation = validateEmail(email);
      const trimmedEmail = emailValidation.isValid ? emailValidation.normalized : email.trim().toLowerCase();

      const { data, error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: cleanCode,
        type: 'signup',
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('expired')) {
          setOtpError('This verification code has expired. Please click "Resend code" below to receive a new one.');
        } else if (msg.includes('invalid') || msg.includes('token') || msg.includes('incorrect')) {
          setOtpError('Invalid or already used verification code. Please check your latest email or request a new code.');
        } else if (error.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
          setOtpError('Too many failed attempts. Please wait 60 seconds before trying again.');
        } else {
          setOtpError(error.message || 'Verification failed. Please try again.');
        }
        setIsVerifyingOtp(false);
        return;
      }

      // Supabase Auth verified email successfully
      if (data.user) {
        showToast('Email verified successfully! Welcome to Smart Invoice Chasing.', 'success');
        setActiveScreen('dashboard');

        // Provision profile and workspace idempotently after verification
        const validName = validateFullName(fullName).normalized || data.user.user_metadata?.full_name;
        await ensureUserWorkspaceProvisioned(supabase, data.user, validName);

        router.push('/dashboard');
      } else {
        showToast('Email verified! Please sign in to continue.', 'success');
        router.push('/login');
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Verification failed. Please check your connection and try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResendingOtp) return;
    setIsResendingOtp(true);
    setOtpError(null);
    setResendSuccessMessage(null);

    try {
      const emailValidation = validateEmail(email);
      const trimmedEmail = emailValidation.isValid ? emailValidation.normalized : email.trim().toLowerCase();

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (
          error.status === 429 ||
          msg.includes('rate limit') ||
          msg.includes('60 seconds') ||
          msg.includes('security purposes')
        ) {
          setOtpError('For security, you can only request a new code once every 60 seconds.');
          setResendCooldown(60);
        } else if (
          msg.includes('smtp') ||
          msg.includes('email provider') ||
          msg.includes('sending email') ||
          msg.includes('error sending')
        ) {
          setOtpError(
            'Email delivery service is currently encountering an issue. Please verify your email address or try again shortly.'
          );
        } else {
          setOtpError(error.message || 'Failed to resend verification code.');
        }
      } else {
        setResendSuccessMessage('A fresh 6-digit verification code has been sent to your email.');
        setResendCooldown(60);
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Failed to resend verification code.');
    } finally {
      setIsResendingOtp(false);
    }
  };
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden selection:bg-emerald-500 selection:text-slate-950 font-sans">
      {/* Glow backdrop */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[300px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-950 border border-slate-800/90 rounded-3xl p-8 shadow-2xl relative z-10 glass-card">
        {/* Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <span className="font-extrabold text-white text-base tracking-tight">SMART INVOICE</span>
              <span className="text-emerald-400 font-bold text-base ml-1">CHASING</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isVerifyStep ? 'Verify your email' : 'Create your account'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isVerifyStep
              ? 'Enter the 6-digit verification code sent to your inbox.'
              : 'Start recovering your overdue invoices.'}
          </p>
        </div>

        {/* ── STEP 2: OTP VERIFICATION VIEW ────────────────────────────────────── */}
        {isVerifyStep ? (
          <div className="space-y-4">
            {/* Email destination pill with option to edit */}
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200 font-medium truncate">{email}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsVerifyStep(false);
                  setOtpError(null);
                  setResendSuccessMessage(null);
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline shrink-0 cursor-pointer ml-2"
              >
                Change email
              </button>
            </div>

            {/* Error Message */}
            {otpError && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{otpError}</span>
              </div>
            )}

            {/* Resend Success Message */}
            {resendSuccessMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resendSuccessMessage}</span>
              </div>
            )}

            {/* OTP Form */}
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 text-center">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(val);
                      setOtpError(null);
                    }}
                    placeholder="••••••"
                    autoFocus
                    required
                    disabled={isVerifyingOtp}
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 text-center text-2xl font-mono tracking-[0.5em] text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition shadow-inner disabled:opacity-50"
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-center mt-2">
                  Check your inbox and spam/junk folder. Verification confirms your account access.
                </p>
              </div>

              <button
                type="submit"
                disabled={isVerifyingOtp || otpCode.length !== 6}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer"
              >
                {isVerifyingOtp ? 'Verifying Code...' : 'Verify & Continue →'}
              </button>
            </form>

            {/* Resend Cooldown Action */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isResendingOtp}
                className="text-xs text-slate-400 hover:text-emerald-400 transition font-medium disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResendingOtp ? 'animate-spin' : ''}`} />
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : isResendingOtp
                  ? 'Sending new code...'
                  : 'Resend verification code'}
              </button>
            </div>

            {/* Back to Sign In Link */}
            <div className="pt-4 border-t border-slate-800/80 text-center">
              <Link href="/login" className="text-xs text-slate-400 hover:text-white transition inline-flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          /* ── STEP 1: INITIAL SIGNUP FORM ─────────────────────────────────────── */
          <>
            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Signup Form */}
            <form onSubmit={handleSignup} className="space-y-3.5" noValidate>
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fullNameError) setFullNameError(null);
                  }}
                  onBlur={handleBlurFullName}
                  required
                  placeholder="John Doe"
                  className={`w-full bg-slate-900 border ${
                    fullNameError
                      ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500'
                  } rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 transition`}
                />
                {fullNameError && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fullNameError}</span>
                  </p>
                )}
              </div>

              {/* Contact Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) setPhoneError(null);
                  }}
                  onBlur={handleBlurPhone}
                  required
                  placeholder="+91 98765 43210"
                  className={`w-full bg-slate-900 border ${
                    phoneError
                      ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500'
                  } rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 transition font-mono`}
                />
                {phoneError ? (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{phoneError}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Indian (+91) or international formats accepted. Normalized to E.164.
                  </p>
                )}
              </div>

              {/* Business Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Business Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  onBlur={handleBlurEmail}
                  required
                  placeholder="you@company.com"
                  className={`w-full bg-slate-900 border ${
                    emailError
                      ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500'
                  } rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 transition`}
                />
                {emailError ? (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{emailError}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">
                    A 6-digit verification code will be sent to confirm inbox ownership.
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    onBlur={handleBlurPassword}
                    required
                    placeholder="At least 8 characters"
                    className={`w-full bg-slate-900 border ${
                      passwordError
                        ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                        : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500'
                    } rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 transition font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (confirmPasswordError) setConfirmPasswordError(null);
                    }}
                    onBlur={handleBlurConfirmPassword}
                    required
                    placeholder="Confirm password"
                    className={`w-full bg-slate-900 border ${
                      confirmPasswordError
                        ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                        : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500'
                    } rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 transition font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPasswordError && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{confirmPasswordError}</span>
                  </p>
                )}
              </div>

              {/* Terms & Privacy */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400 leading-snug">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked);
                      if (agreeTermsError) setAgreeTermsError(null);
                    }}
                    className="w-4 h-4 accent-emerald-500 rounded mt-0.5"
                  />
                  <span>
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPolicyModalType('terms');
                      }}
                      className="text-emerald-400 font-semibold underline hover:text-emerald-300 transition cursor-pointer"
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPolicyModalType('privacy');
                      }}
                      className="text-emerald-400 font-semibold underline hover:text-emerald-300 transition cursor-pointer"
                    >
                      Privacy Policy
                    </button>
                    .
                  </span>
                </label>
                {agreeTermsError && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{agreeTermsError}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isEmailLoading || isGoogleLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer"
              >
                {isEmailLoading ? 'Creating account...' : 'Create account →'}
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
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                Already have an account?{' '}
                <Link href="/login" className="text-emerald-400 font-bold hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Policy Modal Overlay */}
      <PolicyModal
        isOpen={Boolean(policyModalType)}
        type={policyModalType}
        onClose={() => setPolicyModalType(null)}
      />
    </div>
  );
}
