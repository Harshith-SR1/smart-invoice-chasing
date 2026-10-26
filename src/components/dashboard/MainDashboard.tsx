'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Coins,
  CheckCircle2,
  ShieldAlert,
  Bot,
  Activity,
  Target,
  UploadCloud,
  Flame,
  HelpCircle,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Sliders,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Invoice, InvoiceStatus, isCollectibleStatus } from '../../types';
import { ImportModal } from '../common/ImportModal';
import { getWhatToChaseToday, evaluateInvoiceDecision } from '../../lib/decisionEngine';

export const MainDashboard: React.FC = () => {
  const router = useRouter();
  const {
    invoices,
    customers,
    promises,
    automationRules,
    reportSummary,
    workspace,
    user,
    setActiveScreen,
    setSelectedInvoice,
    showToast,
    isLoading,
    loadError,
  } = useApp();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'active' | 'promisers' | 'disputers' | 'ghosters' | 'recovered'>('all');
  const [greeting, setGreeting] = useState('Good morning');

  // Greeting based on client local time
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const businessOrUserName = useMemo(() => {
    if (
      workspace.businessName &&
      workspace.businessName !== 'My Business' &&
      workspace.businessName !== 'Apex Creative Media & Tech Solutions'
    ) {
      return workspace.businessName;
    }
    if (user?.user_metadata?.full_name?.trim()) {
      return user.user_metadata.full_name.trim().split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Account Owner';
  }, [user, workspace]);

  // Financial Metrics derived directly from single source of truth
  // Ineligible/non-collectible statuses (paid, cancelled, void, held, on_hold, draft) are strictly excluded
  const isCollectible = isCollectibleStatus;

  const totalOutstanding = useMemo(() => {
    return invoices
      .filter((i) => isCollectible(i.status))
      .reduce((acc, curr) => {
        const out = curr.outstandingAmount !== undefined ? curr.outstandingAmount : Math.max(0, curr.amount - (curr.paidAmount || 0));
        return acc + out;
      }, 0);
  }, [invoices]);

  const totalOverdue = useMemo(() => {
    return invoices
      .filter(
        (i) =>
          isCollectible(i.status) &&
          (i.status === 'overdue' ||
            i.status === 'escalated' ||
            i.status === 'disputed' ||
            i.daysOverdue > 0)
      )
      .reduce((acc, curr) => {
        const out = curr.outstandingAmount !== undefined ? curr.outstandingAmount : Math.max(0, curr.amount - (curr.paidAmount || 0));
        return acc + out;
      }, 0);
  }, [invoices]);

  const activeChasingCount = useMemo(() => {
    return invoices.filter((i) => isCollectible(i.status)).length;
  }, [invoices]);

  const paidInvoices = useMemo(() => {
    return invoices.filter((i) => i.status === 'paid');
  }, [invoices]);

  const moneyRecovered = useMemo(() => {
    return invoices.reduce((acc, curr) => {
      const paid = curr.paidAmount !== undefined ? curr.paidAmount : (curr.status === 'paid' ? curr.amount : 0);
      return acc + paid;
    }, 0);
  }, [invoices]);

  // "What Should I Chase Today?" Prioritization Engine
  const chaseTodayList = useMemo(() => {
    return getWhatToChaseToday(invoices, customers, promises).slice(0, 3);
  }, [invoices, customers, promises]);

  // Cases requiring Human Attention (strictly unverified claims, disputes, broken commitments, escalations)
  const humanAttentionCases = useMemo(() => {
    if (!invoices || invoices.length === 0) return [];

    return invoices.filter(
      (i) =>
        i.status !== 'paid' &&
        (i.paymentClaimStatus === 'CLAIMED' ||
         i.status === 'disputed' ||
         i.status === 'escalated' ||
         i.missedPromisesCount > 0 ||
         (i.daysOverdue >= 70))
    ).slice(0, 3);
  }, [invoices]);

  // Deterministic time formatter
  const formatEventTime = (timestamp?: string): string => {
    if (!timestamp) return '—';
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return '—';
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[d.getMonth()];
      const day = d.getDate();
      return `${month} ${day}, ${hours}:${minutes}`;
    } catch {
      return '—';
    }
  };

  // Recent Live Activity extracted strictly from real invoice timelines, sorted by full timestamp
  const liveEvents = useMemo(() => {
    const events: Array<{
      id: string;
      timestamp: string;
      time: string;
      customer: string;
      description: string;
      amount?: number;
      type: 'sent' | 'reply' | 'promise' | 'paid' | 'escalated';
    }> = [];

    invoices.forEach((inv) => {
      if (inv.timeline && inv.timeline.length > 0) {
        inv.timeline.forEach((t) => {
          events.push({
            id: t.id,
            timestamp: t.timestamp,
            time: formatEventTime(t.timestamp),
            customer: inv.customerName,
            description: t.title || t.description,
            amount: inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount,
            type: t.type === 'payment_received' || t.type === 'partial_payment_received' ? 'paid' : t.type === 'promise_detected' ? 'promise' : t.type === 'escalation_triggered' ? 'escalated' : t.type === 'customer_replied' ? 'reply' : 'sent',
          });
        });
      }
    });

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events.slice(0, 5);
  }, [invoices]);

  // Aging Buckets Calculation - reconciled strictly with collectible outstanding balances
  const agingBuckets = useMemo(() => {
    const calcOut = (i: Invoice) => i.outstandingAmount !== undefined ? i.outstandingAmount : Math.max(0, i.amount - (i.paidAmount || 0));
    const current = invoices.filter((i) => isCollectible(i.status) && i.daysOverdue <= 0);
    const days1_7 = invoices.filter((i) => isCollectible(i.status) && i.daysOverdue >= 1 && i.daysOverdue <= 7);
    const days8_30 = invoices.filter((i) => isCollectible(i.status) && i.daysOverdue >= 8 && i.daysOverdue <= 30);
    const days31_60 = invoices.filter((i) => isCollectible(i.status) && i.daysOverdue > 30 && i.daysOverdue <= 60);
    const days61_90 = invoices.filter((i) => isCollectible(i.status) && i.daysOverdue > 60 && i.daysOverdue <= 90);
    const days90Plus = invoices.filter((i) => isCollectible(i.status) && i.daysOverdue > 90);

    return {
      current: { count: current.length, amount: current.reduce((sum, i) => sum + calcOut(i), 0) },
      days1_7: { count: days1_7.length, amount: days1_7.reduce((sum, i) => sum + calcOut(i), 0) },
      days8_30: { count: days8_30.length, amount: days8_30.reduce((sum, i) => sum + calcOut(i), 0) },
      days31_60: { count: days31_60.length, amount: days31_60.reduce((sum, i) => sum + calcOut(i), 0) },
      days61_90: { count: days61_90.length, amount: days61_90.reduce((sum, i) => sum + calcOut(i), 0) },
      days90Plus: { count: days90Plus.length, amount: days90Plus.reduce((sum, i) => sum + calcOut(i), 0) },
    };
  }, [invoices]);

  // Top 3 High Risk Accounts for snapshot
  const topRiskAccounts = useMemo(() => {
    return invoices
      .filter((i) => isCollectible(i.status) && (i.daysOverdue > 60 || i.status === 'escalated' || i.healthCategory === 'high_risk'))
      .slice(0, 3);
  }, [invoices]);

  // Filtered Collections for Snapshot table
  const filteredOverviewInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (collectionFilter === 'all') return true;
      if (collectionFilter === 'active') return inv.status !== 'paid';
      if (collectionFilter === 'promisers') return inv.collectionCategory === 'PROMISERS' || inv.status === 'promised';
      if (collectionFilter === 'disputers') return inv.collectionCategory === 'DISPUTERS' || inv.status === 'disputed';
      if (collectionFilter === 'ghosters') return inv.collectionCategory === 'GHOSTERS' || (inv.remindersSent >= 3 && inv.customerRepliesCount === 0);
      if (collectionFilter === 'recovered') return inv.status === 'paid';
      return true;
    }).slice(0, 5);
  }, [invoices, collectionFilter]);

  const formatLakhs = (amt: number) => {
    if (amt >= 100000) {
      return `₹${(amt / 100000).toFixed(2)}L`;
    }
    if (amt >= 1000) {
      return `₹${(amt / 1000).toFixed(1)}K`;
    }
    return `₹${Math.round(amt)}`;
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'chasing':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">ACTIVE CHASING</span>;
      case 'promised':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-500/10 text-violet-300 border border-violet-500/30">PROMISED</span>;
      case 'disputed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">DISPUTED</span>;
      case 'partially_paid':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">PARTIAL PAID</span>;
      case 'escalated':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">ESCALATED</span>;
      case 'overdue':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">NEEDS ATTENTION</span>;
      case 'paid':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">RECOVERED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">MONITORING</span>;
    }
  };

  // 1. Loading State: Display while authenticated workspace data is loading
  if (isLoading) {
    return (
      <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-sans text-slate-100 animate-in fade-in duration-150">
        {/* Top Command Area Skeleton */}
        <div className="bg-[#070B18] p-5 sm:p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden shadow-2xl">
          <div className="space-y-2.5 w-full max-w-md">
            <div className="h-6 w-48 rounded-full bg-slate-800 animate-pulse" />
            <div className="h-8 w-64 rounded-xl bg-slate-800/80 animate-pulse" />
            <div className="h-4 w-80 rounded-lg bg-slate-800/60 animate-pulse" />
          </div>
          <div className="h-10 w-36 rounded-xl bg-slate-800/60 animate-pulse shrink-0" />
        </div>

        {/* Financial Overview Grid Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900/40 border border-slate-800 h-64 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-4 w-32 rounded bg-slate-800 animate-pulse" />
              <div className="h-12 w-48 rounded bg-slate-800/80 animate-pulse" />
              <div className="h-3 w-40 rounded bg-slate-800/60 animate-pulse" />
            </div>
            <div className="h-4 w-full rounded bg-slate-800/40 animate-pulse" />
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 h-32 flex flex-col justify-between">
                <div className="h-3 w-16 rounded bg-slate-800 animate-pulse" />
                <div className="h-6 w-24 rounded bg-slate-800/80 animate-pulse" />
                <div className="h-3 w-20 rounded bg-slate-800/50 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Priority Mission Skeleton */}
        <div className="p-6 rounded-3xl bg-slate-900/30 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-44 rounded bg-slate-800 animate-pulse" />
            <div className="h-4 w-24 rounded bg-slate-800/60 animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Error State: Display honest error if backend loading failed
  if (loadError && (!invoices || invoices.length === 0)) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans text-slate-100 animate-in fade-in duration-150">
        <div className="p-8 rounded-3xl bg-slate-950 border border-rose-500/30 text-center max-w-2xl mx-auto space-y-5 my-12 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 mx-auto flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-white tracking-tight">Unable to Load Workspace Data</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{loadError}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition border border-slate-700 cursor-pointer"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // 3. Legitimate Empty State: Display only after loading completes with 0 invoices
  if (!invoices || invoices.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans text-slate-100">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-[#111936] via-[#091024] to-[#070B18] border border-slate-800 text-center max-w-2xl mx-auto space-y-6 my-12 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#8B7CFF]/20 border border-[#8B7CFF]/40 mx-auto flex items-center justify-center">
            <Bot className="w-8 h-8 text-[#8B7CFF]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Your AI Collection Operator is ready.</h2>
            <p className="text-sm text-[#9AA5C2] max-w-md mx-auto">
              Import invoices to start automated due-date monitoring, promise tracking, and decision making.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/20 cursor-pointer inline-flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              <span>+ Import Invoices</span>
            </button>
            <Link
              href="/settings?tab=ai"
              onClick={() => setActiveScreen('settings')}
              className="px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 font-semibold text-sm transition cursor-pointer inline-flex items-center gap-2"
            >
              <Sliders className="w-4 h-4" />
              <span>Configure AI Rules</span>
            </Link>
          </div>
          <span className="text-[11px] text-slate-400 font-mono block text-center mt-2">Upload CSV or Excel &bull; Customize Cadence</span>
        </div>

        <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-sans text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      
      {/* ========================================================================= */}
      {/* 1. TOP COMMAND AREA (AI Receiver Status) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-[#070B18] via-[#111936] to-[#070B18] p-5 sm:p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            {automationRules.enableAutoFollowup !== false ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold tracking-wider uppercase">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>AI COLLECTION OPERATOR ACTIVE</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold tracking-wider uppercase">
                <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                <span>AI OPERATOR PAUSED</span>
              </div>
            )}
          </div>

          <h1 suppressHydrationWarning className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {greeting}, {businessOrUserName}.
          </h1>

          <p className="text-xs sm:text-sm text-[#9AA5C2] leading-relaxed">
            Monitoring {activeChasingCount} active collections &bull; Evaluating promises, replies, and next-best actions.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <Link
            href="/settings?tab=ai"
            onClick={() => setActiveScreen('settings')}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configure AI Rules</span>
          </Link>

          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>+ Import Invoices</span>
            </button>
            <span className="text-[10px] text-slate-400 font-mono">Upload CSV or Excel</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FINANCIAL OVERVIEW */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Money Recovered Hero */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-gradient-to-br from-[#111936] via-[#091024] to-[#070B18] border-2 border-emerald-500/40 shadow-2xl shadow-emerald-950/40 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <CheckCircle2 className="w-4 h-4" /> MONEY RECOVERED
              </span>
            </div>

            <div className="mt-4">
              <span className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono tracking-tight">
                {moneyRecovered > 0 ? formatLakhs(moneyRecovered) : '₹0'}
              </span>
            </div>

            <p className="text-xs text-[#9AA5C2] mt-2">
              {paidInvoices.length > 0
                ? `${paidInvoices.length} payments recorded as settled`
                : 'No settled payments recorded yet'}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-slate-400">Promise Recovery Rate</span>
            <span className="text-emerald-400 font-mono font-bold">
              {reportSummary.promisesDetected > 0
                ? `${Math.min(100, Math.round((reportSummary.promisesFulfilled / reportSummary.promisesDetected) * 100))}% Fulfilled`
                : promises.length > 0
                ? `${promises.filter((p) => p.status === 'FULFILLED' || p.status === 'fulfilled').length} of ${promises.length} Fulfilled`
                : '0% Fulfilled'}
            </span>
          </div>
        </div>

        {/* 4 Supporting Financial Metrics */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            onClick={() => {
              setActiveScreen('invoices');
              router.push('/invoices');
            }}
            className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between hover:border-emerald-500/40 cursor-pointer transition group"
          >
            <span className="text-[10px] text-[#9AA5C2] uppercase font-mono font-bold tracking-wider">Outstanding</span>
            <div className="my-2">
              <span className="text-xl font-extrabold text-white font-mono">{formatLakhs(totalOutstanding)}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
              View Invoices →
            </span>
          </div>

          <div
            onClick={() => {
              setActiveScreen('invoices');
              router.push('/invoices');
            }}
            className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between hover:border-rose-500/40 cursor-pointer transition group"
          >
            <span className="text-[10px] text-rose-400 uppercase font-mono font-bold tracking-wider">Overdue</span>
            <div className="my-2">
              <span className="text-xl font-extrabold text-rose-400 font-mono">{formatLakhs(totalOverdue)}</span>
            </div>
            <span className="text-[10px] text-rose-400/80 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
              Overdue Accounts →
            </span>
          </div>

          <div
            onClick={() => {
              setActiveScreen('collections');
              router.push('/collections');
            }}
            className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between hover:border-amber-500/40 cursor-pointer transition group"
          >
            <span className="text-[10px] text-[#FFB84D] uppercase font-mono font-bold tracking-wider">Active Chasing</span>
            <div className="my-2">
              <span className="text-xl font-extrabold text-[#FFB84D] font-mono">{activeChasingCount}</span>
            </div>
            <span className="text-[10px] text-[#FFB84D]/80 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
              Active Pipeline →
            </span>
          </div>

          <div
            onClick={() => {
              setActiveScreen('collections');
              router.push('/collections');
            }}
            className="p-4 rounded-2xl bg-[#111936]/80 border border-slate-800 flex flex-col justify-between hover:border-violet-500/40 cursor-pointer transition group"
          >
            <span className="text-[10px] text-[#8B7CFF] uppercase font-mono font-bold tracking-wider">Promises</span>
            <div className="my-2">
              <span className="text-xl font-extrabold text-[#8B7CFF] font-mono">{promises.length}</span>
            </div>
            <span className="text-[10px] text-[#8B7CFF]/80 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
              Promise Tracking →
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. AI DECISION CENTER & "WHAT SHOULD I CHASE TODAY?" */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-3xl bg-[#111936]/90 border border-[#8B7CFF]/30 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#8B7CFF]/20 border border-[#8B7CFF]/40 flex items-center justify-center">
              <Flame className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>WHAT SHOULD I CHASE TODAY?</span>
                <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  AI DECISION CENTER
                </span>
              </h2>
              <p className="text-xs text-[#9AA5C2]">
                Ranked by financial urgency, broken commitments, and customer payment memory.
              </p>
            </div>
          </div>
          
          <button
            onClick={() => {
              setActiveScreen('ai-decisions');
              router.push('/ai-decisions');
            }}
            className="text-xs font-mono text-[#8B7CFF] bg-[#8B7CFF]/10 hover:bg-[#8B7CFF]/20 px-3.5 py-1.5 rounded-full border border-[#8B7CFF]/30 font-bold transition flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>ALL AI DECISIONS →</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {chaseTodayList.map(({ invoice: inv, decision: dec, urgencyLabel, reason }, idx) => {
            const isHigh = urgencyLabel === 'HIGH PRIORITY';
            const outstanding = inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount;

            return (
              <div
                key={inv.id}
                className={`p-5 rounded-2xl bg-[#070B18] border ${
                  isHigh
                    ? 'border-rose-500/40 hover:border-rose-500/70'
                    : 'border-amber-500/40 hover:border-amber-500/70'
                } flex flex-col justify-between space-y-4 transition`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black font-mono text-slate-500">#{idx + 1}</span>
                        <h3 className="font-bold text-white text-sm">{inv.customerName}</h3>
                      </div>
                      <span className={`text-[10px] font-mono font-bold ${isHigh ? 'text-rose-400' : 'text-amber-400'}`}>
                        {urgencyLabel} &bull; {inv.daysOverdue > 0 ? `${inv.daysOverdue}D OVERDUE` : 'DUE SOON'}
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-white font-mono">{formatLakhs(outstanding)}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-[#9AA5C2]">
                    <span className="text-slate-300 font-semibold block text-[11px] mb-0.5">Why Chase Today:</span>
                    {reason}
                  </div>

                  <div className="p-2.5 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    <span className="font-bold block text-[10px] font-mono uppercase text-emerald-400">
                      NEXT BEST ACTION: {dec.action}
                    </span>
                    Timing: {dec.recommendedTiming} via {dec.recommendedChannel} ({dec.recommendedTone} tone)
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setSelectedInvoice(inv)}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-xs text-slate-950 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                  >
                    <span>Operator Review</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. HUMAN ATTENTION REQUIRED (Disputes, Unverified Claims, Chronic Breaks) */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-3xl bg-[#111936]/90 border border-rose-500/30 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">HUMAN ATTENTION REQUIRED</h2>
              <p className="text-xs text-[#9AA5C2]">Exceptions requiring account manager verification or mediation.</p>
            </div>
          </div>
          <span className="text-xs font-mono text-rose-400 font-bold">
            {humanAttentionCases.length} {humanAttentionCases.length === 1 ? 'Case' : 'Cases'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {humanAttentionCases.length > 0 ? (
            humanAttentionCases.map((inv) => (
              <div
                key={inv.id}
                className="p-4 bg-[#070B18] rounded-2xl border border-rose-500/20 hover:border-rose-500/40 transition space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{inv.customerName}</span>
                    <span className="font-mono font-bold text-rose-400 text-xs">
                      {formatLakhs(inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount)}
                    </span>
                  </div>
                  
                  <div className="text-xs text-[#9AA5C2]">
                    <span className="text-slate-400 font-semibold block text-[11px]">Exception Issue:</span>
                    {inv.paymentClaimStatus === 'CLAIMED'
                      ? 'Customer claimed payment was made. Verification required.'
                      : inv.status === 'disputed'
                      ? 'Customer raised milestone or rate dispute.'
                      : inv.missedPromisesCount > 0
                      ? `Repeated broken promises (${inv.missedPromisesCount} missed).`
                      : 'Severe overdue threshold reached; requires founder intervention.'}
                  </div>

                  <div className="text-[11px] text-amber-300 font-mono pt-1">
                    {(() => {
                      const cust = customers.find((c) => c.id === inv.customerId);
                      const dec = evaluateInvoiceDecision(inv, cust, promises);
                      return `Recommended: ${dec.action} • ${dec.reason}`;
                    })()}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedInvoice(inv)}
                  className="w-full py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
                >
                  Review Exception
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-3 p-6 bg-[#070B18] rounded-2xl border border-white/5 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              All clean. Zero exceptions pending human intervention.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. COLLECTIONS OVERVIEW (Exception-Based Categories) */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-3xl bg-[#111936]/90 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">COLLECTIONS PIPELINE</h2>
              <p className="text-xs text-[#9AA5C2]">Categorized by customer response & commitment state.</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'active', 'promisers', 'disputers', 'ghosters', 'recovered'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setCollectionFilter(filterKey)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition uppercase cursor-pointer whitespace-nowrap ${
                  collectionFilter === filterKey
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {filterKey}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#9AA5C2] uppercase font-mono text-[10px]">
                <th className="pb-3 font-semibold">Customer</th>
                <th className="pb-3 font-semibold">Outstanding</th>
                <th className="pb-3 font-semibold">Stage</th>
                <th className="pb-3 font-semibold">Days Overdue</th>
                <th className="pb-3 font-semibold">Next Best Action</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredOverviewInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3.5 pr-3">
                    <div className="font-bold text-white font-sans text-xs">{inv.customerName}</div>
                    <div className="text-[10px] text-slate-400">{inv.invoiceNumber}</div>
                  </td>
                  <td className="py-3.5 pr-3 font-bold text-white">
                    {formatLakhs(inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount)}
                  </td>
                  <td className="py-3.5 pr-3">
                    {getStatusBadge(inv.status)}
                  </td>
                  <td className="py-3.5 pr-3 text-slate-300">
                    {inv.status === 'paid' ? '0d' : `${inv.daysOverdue}d`}
                  </td>
                  <td className="py-3.5 pr-3 font-sans text-slate-300 text-[11px] max-w-xs truncate">
                    {(() => {
                      const cust = customers.find((c) => c.id === inv.customerId);
                      const dec = evaluateInvoiceDecision(inv, cust, promises);
                      return (
                        <span>
                          <strong className="font-mono text-emerald-400 mr-1.5">[{dec.action}]</strong>
                          {dec.reason}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-sans text-xs transition cursor-pointer"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-2">
          <button
            onClick={() => {
              setActiveScreen('collections');
              router.push('/collections');
            }}
            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>VIEW FULL COLLECTIONS PIPELINE →</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. RECEIVABLES AGING + PAYMENT RISK (Side-by-Side Snapshots) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Receivables Aging Snapshot */}
        <div className="lg:col-span-6 p-6 rounded-3xl bg-[#111936]/90 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-[#FFB84D]" />
                RECEIVABLES AGING
              </h2>
              <button
                onClick={() => {
                  setActiveScreen('aging');
                  router.push('/aging');
                }}
                className="text-[11px] font-mono text-[#FFB84D] hover:text-amber-300 font-bold cursor-pointer transition"
              >
                VIEW FULL AGING →
              </button>
            </div>

            <div className="space-y-2 font-mono text-xs mt-3">
              <div
                onClick={() => {
                  setActiveScreen('aging');
                  router.push('/aging');
                }}
                className="p-2.5 rounded-xl bg-[#070B18] border border-white/5 flex items-center justify-between hover:border-[#4F7CFF]/50 cursor-pointer transition"
              >
                <span className="text-[#9AA5C2]">Current (0d)</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-[10px]">{agingBuckets.current.count} inv</span>
                  <span className="text-white font-bold">{formatLakhs(agingBuckets.current.amount)}</span>
                </div>
              </div>

              <div
                onClick={() => {
                  setActiveScreen('aging');
                  router.push('/aging');
                }}
                className="p-2.5 rounded-xl bg-[#070B18] border border-white/5 flex items-center justify-between hover:border-teal-500/50 cursor-pointer transition"
              >
                <span className="text-teal-400">1–7 Days Overdue</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-[10px]">{agingBuckets.days1_7.count} inv</span>
                  <span className="text-teal-400 font-bold">{formatLakhs(agingBuckets.days1_7.amount)}</span>
                </div>
              </div>

              <div
                onClick={() => {
                  setActiveScreen('aging');
                  router.push('/aging');
                }}
                className="p-2.5 rounded-xl bg-[#070B18] border border-white/5 flex items-center justify-between hover:border-amber-400/50 cursor-pointer transition"
              >
                <span className="text-amber-400">8–30 Days Overdue</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-[10px]">{agingBuckets.days8_30.count} inv</span>
                  <span className="text-amber-400 font-bold">{formatLakhs(agingBuckets.days8_30.amount)}</span>
                </div>
              </div>

              <div
                onClick={() => {
                  setActiveScreen('aging');
                  router.push('/aging');
                }}
                className="p-2.5 rounded-xl bg-[#070B18] border border-white/5 flex items-center justify-between hover:border-[#FFB84D]/50 cursor-pointer transition"
              >
                <span className="text-[#FFB84D]">31–60 Days</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-[10px]">{agingBuckets.days31_60.count} inv</span>
                  <span className="text-[#FFB84D] font-bold">{formatLakhs(agingBuckets.days31_60.amount)}</span>
                </div>
              </div>

              <div
                onClick={() => {
                  setActiveScreen('aging');
                  router.push('/aging');
                }}
                className="p-2.5 rounded-xl bg-[#070B18] border border-white/5 flex items-center justify-between hover:border-rose-400/50 cursor-pointer transition"
              >
                <span className="text-rose-300">61–90 Days</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-[10px]">{agingBuckets.days61_90.count} inv</span>
                  <span className="text-rose-300 font-bold">{formatLakhs(agingBuckets.days61_90.amount)}</span>
                </div>
              </div>

              <div
                onClick={() => {
                  setActiveScreen('aging');
                  router.push('/aging');
                }}
                className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-center justify-between hover:border-rose-500 cursor-pointer transition"
              >
                <span className="text-rose-400 font-bold">90+ Days (Urgent)</span>
                <div className="flex items-center gap-3">
                  <span className="text-rose-300 text-[10px]">{agingBuckets.days90Plus.count} inv</span>
                  <span className="text-rose-400 font-black">{formatLakhs(agingBuckets.days90Plus.amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Risk Snapshot */}
        <div className="lg:col-span-6 p-6 rounded-3xl bg-[#111936]/90 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                PAYMENT RISK
              </h2>
              <button
                onClick={() => {
                  setActiveScreen('risk');
                  router.push('/risk');
                }}
                className="text-[11px] font-mono text-rose-400 hover:text-rose-300 font-bold cursor-pointer transition"
              >
                VIEW FULL RISK →
              </button>
            </div>

            <div className="space-y-2 mt-3">
              {topRiskAccounts.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => {
                    setActiveScreen('risk');
                    router.push('/risk');
                  }}
                  className="p-3 bg-[#070B18] rounded-xl border border-rose-500/20 hover:border-rose-500/40 cursor-pointer transition flex items-center justify-between font-mono text-xs"
                >
                  <div>
                    <span className="font-bold text-white font-sans text-xs block">{inv.customerName}</span>
                    <span className="text-[10px] text-slate-400">{inv.daysOverdue} days overdue</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-rose-400 font-bold">
                      {formatLakhs(inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      High Risk
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. RECENT AI ACTIVITY */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-3xl bg-[#111936]/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#4F7CFF]" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">RECENT AI ACTIVITY</h2>
          </div>
          <button
            onClick={() => {
              setActiveScreen('activity');
              router.push('/activity');
            }}
            className="text-[11px] font-mono text-[#4F7CFF] hover:text-[#7ba0ff] font-bold cursor-pointer transition"
          >
            VIEW FULL ACTIVITY →
          </button>
        </div>

        <div className="space-y-2.5 font-mono text-xs">
          {liveEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-3 bg-[#070B18] rounded-xl border border-white/5 flex items-start justify-between gap-3 hover:border-white/15 transition"
            >
              <div className="flex items-start gap-2.5">
                <span suppressHydrationWarning className="text-[#9AA5C2] text-[10px] shrink-0 mt-0.5">{evt.time}</span>
                <div>
                  <div className="font-bold text-white font-sans text-xs">{evt.customer}</div>
                  <div className="text-[#9AA5C2] text-[11px] font-sans">{evt.description}</div>
                </div>
              </div>
              {evt.amount && (
                <span className={`font-bold shrink-0 text-xs ${evt.type === 'paid' ? 'text-emerald-400' : evt.type === 'promise' ? 'text-[#8B7CFF]' : evt.type === 'escalated' ? 'text-rose-400' : 'text-[#FFB84D]'}`}>
                  {formatLakhs(evt.amount)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CSV / Excel Import Modal */}
      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

    </div>
  );
};
