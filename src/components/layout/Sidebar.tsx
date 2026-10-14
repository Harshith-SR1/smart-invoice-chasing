'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Coins,
  FileText,
  Users,
  BarChart3,
  Link2,
  Settings,
  Sparkles,
  Bot,
  Bell,
  Search,
  LogOut,
  ChevronDown,
  Building2,
  Plus,
  User,
  CreditCard,
  HelpCircle,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ActiveScreen } from '../../types';
import { ImportModal } from '../common/ImportModal';

export const Sidebar: React.FC = () => {
  return null;
};

export const Navbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { activeScreen, setActiveScreen, searchQuery, setSearchQuery, workspace, user, signOut } = useApp();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<'normal' | 'ai'>('normal');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile menu on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsProfileOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (
    activeScreen === 'landing' ||
    activeScreen === 'signin' ||
    activeScreen === 'business_setup' ||
    activeScreen === 'import_data' ||
    activeScreen === 'ai_processing' ||
    activeScreen === 'aha_moment' ||
    activeScreen === 'ai_recommendations'
  ) {
    return null;
  }

  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Harshith S R';
  const userDisplayEmail = user?.email || workspace.businessEmail;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (searchMode === 'ai') {
      setIsSearching(true);
      setAiAnswer(null);
      setTimeout(() => {
        setIsSearching(false);
        const q = searchQuery.toLowerCase();
        if (q.includes('owe') || q.includes('most') || q.includes('highest')) {
          setAiAnswer(
            'Nexus Tech Solutions owes ₹2,50,000 (Target Date: Friday). ABC Pvt Ltd has ₹1,80,000 past due (91 days overdue).'
          );
        } else if (q.includes('pay') || q.includes('week') || q.includes('likely')) {
          setAiAnswer(
            'Nexus Tech Solutions promised payment of ₹2.50L on Friday. Horizon Logistics has high liquidity index.'
          );
        } else if (q.includes('chase') || q.includes('today')) {
          setAiAnswer(
            'Priority Chasing Mission: 1. Escalate ABC Pvt Ltd (₹1.80L, 91d overdue). 2. Send firm promise confirmation to Rahul Enterprises (₹85K).'
          );
        } else if (q.includes('60') || q.includes('overdue')) {
          setAiAnswer(
            'Found 2 invoices overdue more than 60 days: ABC Pvt Ltd (INV-1088, 91d, ₹1.80L) and Rahul Enterprises (INV-1042, 83d, ₹85K).'
          );
        } else {
          setAiAnswer(
            'AI Receiver analysis complete: Total outstanding is ₹9.87L across 8 invoices. ₹4.80L recovered this month (+18.4% velocity).'
          );
        }
      }, 600);
    } else {
      // Normal search filter routing if not already on invoices/customers
      if (pathname !== '/invoices' && pathname !== '/customers') {
        setActiveScreen('invoices');
        router.push('/invoices');
      }
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-30 px-6 flex items-center justify-between font-sans">
      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

      {/* Brand Header — Left */}
      <Link
        href="/dashboard"
        onClick={() => setActiveScreen('dashboard')}
        className="flex items-center gap-3 group cursor-pointer shrink-0"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/30 group-hover:scale-105 transition-transform">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="hidden sm:block text-left">
          <h1 className="font-bold text-slate-100 text-xs tracking-wide leading-tight group-hover:text-emerald-400 transition-colors">
            SMART INVOICE
          </h1>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Chasing</span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0 rounded font-mono border border-emerald-500/30">
              AI Agent
            </span>
          </div>
        </div>
      </Link>

      {/* Universal Search Bar / AI Interface */}
      <div className="relative w-80 sm:w-[520px]">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-slate-400 z-10" />
          
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              searchMode === 'ai'
                ? 'Ask anything about your receivables (e.g. Who owes me the most?)...'
                : 'Search invoices, customers, amounts...'
            }
            className={`w-full bg-slate-900/90 border rounded-xl pl-10 pr-24 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
              searchMode === 'ai'
                ? 'border-violet-500/60 ring-1 ring-violet-500/60'
                : 'border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60'
            }`}
          />

          {/* Mode Switcher Controls */}
          <div className="absolute right-1.5 flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setSearchMode('normal');
                setAiAnswer(null);
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider transition cursor-pointer ${
                searchMode === 'normal'
                  ? 'bg-slate-800 text-slate-200'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              SEARCH
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchMode('ai');
                if (!searchQuery) setSearchQuery('What should I chase today?');
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider transition flex items-center gap-1 cursor-pointer ${
                searchMode === 'ai'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                  : 'text-slate-500 hover:text-violet-400'
              }`}
            >
              <Sparkles className="w-3 h-3 text-violet-400" />
              <span>AI</span>
            </button>
          </div>
        </form>

        {/* AI Dropdown Result Card */}
        {searchMode === 'ai' && (isSearching || aiAnswer) && (
          <div className="absolute top-full left-0 right-0 mt-2 p-4 rounded-2xl bg-slate-950 border border-violet-500/40 shadow-2xl z-50 text-xs animate-in fade-in duration-150 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-violet-400 font-bold font-mono">
                <Sparkles className="w-4 h-4" />
                <span>AI RECEIVER INTELLIGENCE</span>
              </div>
              <button
                type="button"
                onClick={() => setAiAnswer(null)}
                className="text-slate-500 hover:text-slate-300 text-[10px] font-mono cursor-pointer"
              >
                CLOSE [×]
              </button>
            </div>

            {isSearching ? (
              <p className="text-slate-400 italic animate-pulse">Analyzing workspace receivables data...</p>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-200 leading-relaxed font-sans">{aiAnswer}</p>

                {/* Quick Contextual Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
                  <button
                    onClick={() => {
                      setAiAnswer(null);
                      setActiveScreen('collections');
                      router.push('/collections');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 text-[10px] font-bold transition cursor-pointer"
                  >
                    Open Collections →
                  </button>
                  <button
                    onClick={() => {
                      setAiAnswer(null);
                      setActiveScreen('invoices');
                      router.push('/invoices');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:text-white text-[10px] font-semibold transition cursor-pointer"
                  >
                    View Invoices
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Navbar Controls */}
      <div className="flex items-center gap-3">
        {/* Quick Action Button */}
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="hidden sm:flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          + Import Invoices
        </button>

        {/* Notifications Icon */}
        <button
          title="Notifications"
          className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900/80 border border-slate-800 rounded-xl relative hover:bg-slate-800 transition cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
        </button>

        {/* Top-Right Profile Menu Trigger */}
        <div className="relative pl-1 border-l border-slate-800/80" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            aria-expanded={isProfileOpen}
            aria-haspopup="true"
            className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-xs text-slate-950 shadow-md shadow-emerald-950/50 shrink-0">
              {userDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left pr-1">
              <p className="text-xs font-semibold text-slate-200 leading-tight group-hover:text-emerald-400 transition-colors">
                {userDisplayName}
              </p>
              <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{userDisplayEmail}</p>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isProfileOpen ? 'rotate-180 text-emerald-400' : ''
              }`}
            />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl">
              {/* Profile Menu Header */}
              <div className="flex items-start gap-3 p-2.5 mb-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-sm text-slate-950 shadow-md shrink-0">
                  {userDisplayName.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden text-left space-y-0.5 min-w-0">
                  <p className="text-xs font-bold text-slate-100 truncate">{userDisplayName}</p>
                  <p className="text-[10px] text-slate-400 truncate font-mono">{userDisplayEmail}</p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-emerald-400 font-bold font-mono truncate">
                      {workspace.businessName}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-bold border border-emerald-500/30 shrink-0">
                      Early Access &bull; ₹999/mo
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-800/80 my-2" />

              {/* Menu Sections */}
              <div className="space-y-1 text-xs">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveScreen('profile');
                    router.push('/profile');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 transition cursor-pointer"
                >
                  <User className="w-4 h-4 text-emerald-400" />
                  <span>My Profile</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveScreen('workspace');
                    router.push('/workspace');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 transition cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-[#8B7CFF]" />
                  <span>Workspace</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveScreen('settings');
                    router.push('/settings');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 transition cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Settings</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveScreen('integrations');
                    router.push('/integrations');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 transition cursor-pointer"
                >
                  <Link2 className="w-4 h-4 text-emerald-400" />
                  <span>Integrations</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveScreen('billing');
                    router.push('/billing');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 transition cursor-pointer"
                >
                  <CreditCard className="w-4 h-4 text-[#FFB84D]" />
                  <span>Billing & Plan</span>
                </button>
              </div>

              <div className="h-px bg-slate-800/80 my-2" />

              <div className="space-y-1 text-xs">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveScreen('help');
                    router.push('/help');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 transition cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span>Help & Support</span>
                </button>
              </div>

              <div className="h-px bg-slate-800/80 my-2" />

              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-semibold">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
