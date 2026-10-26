'use client';

import React, { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bot,
  User,
  ShieldAlert,
  Search,
  Filter,
  FileText,
  Mail,
  ChevronDown,
  ChevronUp,
  Inbox,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../layout/PageHeader';
import { EventType } from '../../types';

export const ActivityFeedView: React.FC = () => {
  const { invoices, workspace, isLoading, loadError, setSelectedInvoice } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedActor, setSelectedActor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState<number>(50);

  const isINR = workspace.currency?.includes('INR') || workspace.currency === 'INR';
  const currencySymbol = isINR ? '₹' : '$';

  // Flatten and enrich authoritative timeline events across all loaded workspace invoices
  const allRawEvents = useMemo(() => {
    return invoices
      .flatMap((inv) =>
        (inv.timeline || []).map((evt) => ({
          ...evt,
          invoiceId: inv.id,
          customerName: inv.customerName,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount,
          currency: inv.currency || workspace.currency || 'INR',
          targetInvoice: inv,
        }))
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [invoices, workspace.currency]);

  // Compute category matching
  const matchesCategory = (type: EventType, cat: string) => {
    if (cat === 'all') return true;
    if (cat === 'payments') {
      return (
        type === 'payment_verified' ||
        type === 'payment_received' ||
        type === 'partial_payment_received'
      );
    }
    if (cat === 'claims') {
      return type === 'payment_claimed' || type === 'escalation_triggered';
    }
    if (cat === 'promises') {
      return (
        type === 'promise_detected' ||
        type === 'promise_fulfilled' ||
        type === 'promise_missed'
      );
    }
    if (cat === 'decisions') {
      return (
        type === 'decision_approved' ||
        type === 'decision_dismissed' ||
        type === 'decision_executed' ||
        type === 'decision_generated'
      );
    }
    if (cat === 'messages') {
      return (
        type === 'reminder_sent' ||
        type === 'reminder_delivered' ||
        type === 'reminder_failed' ||
        type === 'customer_replied'
      );
    }
    if (cat === 'disputes') {
      return type === 'dispute_opened' || type === 'dispute_resolved';
    }
    return true;
  };

  // Filtered timeline events
  const filteredEvents = useMemo(() => {
    return allRawEvents.filter((evt) => {
      // Category filter
      if (!matchesCategory(evt.type, selectedCategory)) return false;

      // Actor filter
      if (selectedActor !== 'all' && (evt.actor || 'system') !== selectedActor) return false;

      // Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = evt.invoiceNumber?.toLowerCase().includes(q);
        const custMatch = evt.customerName?.toLowerCase().includes(q);
        const titleMatch = evt.title?.toLowerCase().includes(q);
        const descMatch = evt.description?.toLowerCase().includes(q);
        const badgeMatch = evt.badge?.toLowerCase().includes(q);
        if (!numMatch && !custMatch && !titleMatch && !descMatch && !badgeMatch) return false;
      }

      return true;
    });
  }, [allRawEvents, selectedCategory, selectedActor, searchQuery]);

  // Macro Summary Counts
  const stats = useMemo(() => {
    let operatorCount = 0;
    let aiCount = 0;
    let customerCount = 0;
    allRawEvents.forEach((e) => {
      if (e.actor === 'user') operatorCount++;
      else if (e.actor === 'ai') aiCount++;
      else if (e.actor === 'customer') customerCount++;
    });
    return {
      total: allRawEvents.length,
      operatorCount,
      aiCount,
      customerCount,
    };
  }, [allRawEvents]);

  // Format Helper
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  // Render Category Icon
  const getEventIcon = (type: EventType) => {
    if (type === 'dispute_resolved') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
    if (type === 'dispute_opened') {
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    }
    if (type.includes('payment') || type === 'promise_fulfilled') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
    if (type === 'escalation_triggered' || type === 'reminder_failed') {
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    }
    if (type.includes('decision')) {
      return <Sparkles className="w-4 h-4 text-blue-400" />;
    }
    if (type.includes('reminder') || type.includes('replied')) {
      return <Mail className="w-4 h-4 text-teal-400" />;
    }
    if (type.includes('promise')) {
      return <Clock className="w-4 h-4 text-amber-400" />;
    }
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  // Distinct Event Badges
  const renderEventBadge = (evt: any) => {
    if (evt.type === 'dispute_opened') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
          <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
          {evt.badge || 'DISPUTE OPEN'}
        </span>
      );
    }
    if (evt.type === 'dispute_resolved') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
          {evt.badge || 'DISPUTE RESOLVED'}
        </span>
      );
    }
    if (evt.badge) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
          {evt.badge}
        </span>
      );
    }
    return null;
  };

  // Actor Badges
  const renderActorBadge = (actor?: string) => {
    switch (actor) {
      case 'user':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <User className="w-2.5 h-2.5" />
            OPERATOR
          </span>
        );
      case 'ai':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/10 text-violet-300 border border-violet-500/30 flex items-center gap-1">
            <Bot className="w-2.5 h-2.5" />
            AI AUTONOMOUS
          </span>
        );
      case 'customer':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <User className="w-2.5 h-2.5" />
            CUSTOMER
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
            SYSTEM
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto font-sans">
      {/* Shared Page Context Header */}
      <PageHeader
        title="Operator Activity Trail & Audit Log"
        subtitle="Authoritative log of financial actions, payment verifications, AI recommendations, customer replies, and system events."
      />

      {/* Honest Error State */}
      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <strong>Unable to sync complete database audit log:</strong> {loadError}
          </div>
        </div>
      )}

      {/* Macro Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Total Audit Events</span>
          <p className="text-2xl font-black font-mono text-white mt-1">{stats.total}</p>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Recorded in workspace</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/20">
          <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">Operator Actions</span>
          <p className="text-2xl font-black font-mono text-emerald-400 mt-1">{stats.operatorCount}</p>
          <span className="text-[10px] text-emerald-400/70 mt-0.5 block">Manual reviews & approvals</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-violet-500/20">
          <span className="text-[10px] font-mono uppercase text-violet-400 font-bold">AI Autonomous</span>
          <p className="text-2xl font-black font-mono text-violet-400 mt-1">{stats.aiCount}</p>
          <span className="text-[10px] text-violet-400/70 mt-0.5 block">Decisions & sent outreach</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/20">
          <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Customer Events</span>
          <p className="text-2xl font-black font-mono text-amber-400 mt-1">{stats.customerCount}</p>
          <span className="text-[10px] text-amber-400/70 mt-0.5 block">Claims & payment promises</span>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by invoice #, customer name, title, or evidence..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>

          {/* Actor Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Actor:
            </span>
            <select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Actors</option>
              <option value="user">Operator (User)</option>
              <option value="ai">AI Engine</option>
              <option value="customer">Customer</option>
              <option value="system">System / Webhook</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'payments', label: 'Payments & Recoveries' },
            { id: 'claims', label: 'Payment Claims' },
            { id: 'promises', label: 'Commitments & Promises' },
            { id: 'decisions', label: 'AI Decisions' },
            { id: 'messages', label: 'Outreach & Messaging' },
            { id: 'disputes', label: 'Disputes' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            Audit Log Entries
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Showing {Math.min(displayLimit, filteredEvents.length)} of {filteredEvents.length} events
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse" />
            ))}
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="space-y-3 font-mono text-xs">
            {filteredEvents.slice(0, displayLimit).map((evt) => {
              const isExpanded = expandedEventId === evt.id;
              const hasMetadata = evt.metadata && Object.keys(evt.metadata).length > 0;

              return (
                <div
                  key={evt.id}
                  className={
                    evt.type === 'dispute_opened'
                      ? 'p-4 bg-rose-950/20 rounded-2xl border border-rose-500/30 hover:border-rose-500/50 transition space-y-3'
                      : evt.type === 'dispute_resolved'
                      ? 'p-4 bg-emerald-950/20 rounded-2xl border border-emerald-500/30 hover:border-emerald-500/50 transition space-y-3'
                      : 'p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition space-y-3'
                  }
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={
                          evt.type === 'dispute_opened'
                            ? 'p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 shrink-0 mt-0.5'
                            : evt.type === 'dispute_resolved'
                            ? 'p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 shrink-0 mt-0.5'
                            : 'p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5'
                        }
                      >
                        {getEventIcon(evt.type)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white text-sm font-sans">{evt.customerName}</span>
                          {evt.invoiceNumber && (
                            <button
                              onClick={() => evt.targetInvoice && setSelectedInvoice(evt.targetInvoice)}
                              className="text-[11px] text-emerald-400 font-mono hover:underline cursor-pointer"
                              title="Inspect Invoice Details"
                            >
                              ({evt.invoiceNumber})
                            </button>
                          )}
                          {renderActorBadge(evt.actor)}
                          {renderEventBadge(evt)}
                        </div>

                        <div
                          className={`font-sans text-xs font-semibold ${
                            evt.type === 'dispute_opened'
                              ? 'text-rose-300'
                              : evt.type === 'dispute_resolved'
                              ? 'text-emerald-300'
                              : 'text-slate-200'
                          }`}
                        >
                          {evt.title}
                        </div>
                        <div className="font-sans text-xs text-slate-400 leading-relaxed">{evt.description}</div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                      <span className="text-white font-extrabold font-mono text-sm">
                        {evt.currency} {Number(evt.amount || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">{formatTime(evt.timestamp)}</span>
                    </div>
                  </div>

                  {/* Metadata / Audit Evidence Expandable Drawer */}
                  {hasMetadata && (
                    <div className="pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                        className="text-[10px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        <span>{isExpanded ? 'Hide Technical Metadata' : 'View Audit Evidence & Parameters'}</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-300 space-y-1">
                          {Object.entries(evt.metadata || {})
                            .filter(([key]) => !key.toLowerCase().includes('password') && !key.toLowerCase().includes('token'))
                            .map(([k, v]) => (
                              <div key={k} className="flex items-start gap-2">
                                <span className="text-slate-500 shrink-0">{k}:</span>
                                <span className="text-emerald-400 break-all">
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredEvents.length > displayLimit && (
              <div className="text-center pt-2">
                <button
                  onClick={() => setDisplayLimit((prev) => prev + 50)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  Load More Events ({filteredEvents.length - displayLimit} remaining)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-500 font-mono space-y-2">
            <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
            <p>
              {searchQuery || selectedCategory !== 'all' || selectedActor !== 'all'
                ? 'No activity events matching the current search filters.'
                : 'No activity events recorded yet in this workspace. Import invoices or verify payments to generate audit history.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
