'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Play,
  RotateCcw,
  Upload,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  HelpCircle,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingUp,
  Check,
  Sliders,
  Maximize2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const LandingPage: React.FC = () => {
  const router = useRouter();
  const { setActiveScreen } = useApp();

  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const totalSlides = 7;
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  // Slide 01 State - Agent Activity Animation
  const [agentStep, setAgentStep] = useState<number>(0);
  const [processedAccounts, setProcessedAccounts] = useState<number>(1);

  // Slide 02 State - Invoice Story Timeline Step
  const [timelineStep, setTimelineStep] = useState<number>(0);

  // Slide 04 State - Decision Engine Selected Chip
  const [selectedBranch, setSelectedBranch] = useState<'promise' | 'approval' | 'dispute' | 'paid' | 'no_response'>('promise');

  // Slide 05 State - Live Work Queue Filters / Highlight
  const [activeQueueTab, setActiveQueueTab] = useState<'all' | 'working' | 'escalated' | 'completed'>('all');

  // Slide 06 State - Money Story Calculation Count
  const [moneyCount, setMoneyCount] = useState<number>(0);

  // Keyboard and Wheel Navigation Handlers
  const goToNextSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning, totalSlides]);

  const goToPrevSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextSlide();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevSlide();
      }
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY;
      const diffY = touchStartY - touchEndY;
      if (Math.abs(diffY) > 50) {
        if (diffY > 0) goToNextSlide();
        else goToPrevSlide();
      }
    };

    let wheelCooldown = false;
    const handleWheel = (e: WheelEvent) => {
      if (wheelCooldown) return;
      wheelCooldown = true;
      if (e.deltaY > 20) {
        goToNextSlide();
      } else if (e.deltaY < -20) {
        goToPrevSlide();
      }
      setTimeout(() => {
        wheelCooldown = false;
      }, 700);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [goToNextSlide, goToPrevSlide]);

  // Slide 01 Agent Step Loop
  useEffect(() => {
    if (currentSlide !== 0) return;
    const interval = setInterval(() => {
      setAgentStep((prev) => (prev + 1) % 5);
    }, 1800);
    return () => clearInterval(interval);
  }, [currentSlide]);

  useEffect(() => {
    if (agentStep === 4) {
      setProcessedAccounts((prev) => (prev >= 12 ? 1 : prev + 1));
    }
  }, [agentStep]);

  // Slide 02 Timeline Step Loop
  useEffect(() => {
    if (currentSlide !== 1) return;
    const interval = setInterval(() => {
      setTimelineStep((prev) => (prev + 1) % 6);
    }, 1600);
    return () => clearInterval(interval);
  }, [currentSlide]);

  // Decision Engine Map
  const decisionBranches = {
    promise: {
      chipLabel: '“I\'ll pay Friday.”',
      badge: 'PAYMENT PROMISE DETECTED',
      badgeClass: 'bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/30',
      action: 'Track Friday (12 Sep)',
      steps: [
        'AI classified: Explicit commitment to pay on 12 Sep',
        'Pause unnecessary reminders to preserve relationship',
        'Verify payment status on Friday 5:00 PM',
        'If unpaid after Friday → Automatically resume chasing',
      ],
      aiState: 'Pausing Chasing until 12 Sep',
    },
    approval: {
      chipLabel: '“Waiting for approval.”',
      badge: 'APPROVAL DELAY DETECTED',
      badgeClass: 'bg-[#8B7CFF]/15 text-[#8B7CFF] border-[#8B7CFF]/30',
      action: 'Schedule Mid-Week Approval Follow-Up',
      steps: [
        'AI classified: Internal AP workflow bottleneck',
        'Request manager / approver contact info from client',
        'Set soft check-in reminder for Wednesday morning',
        'Keep invoice priority active in work queue',
      ],
      aiState: 'Approver Inquiry Scheduled',
    },
    dispute: {
      chipLabel: '“Issue with the invoice.”',
      badge: 'INVOICE DISPUTE DETECTED',
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      action: 'Pause Chasing & Flag Human Review 🚨',
      steps: [
        'AI classified: Billing dispute or PO discrepancy',
        'Immediately pause automated chaser to prevent frustration',
        'Extract specific line item complaint from customer note',
        'Notify founder/finance lead with drafted response',
      ],
      aiState: 'Flagged for Human Intervention',
    },
    paid: {
      chipLabel: '“Payment sent.”',
      badge: 'PAYMENT CLAIM DETECTED',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      action: 'Verify Payment Receipt & Close',
      steps: [
        'AI classified: Remittance claim by accounts payable',
        'Request transaction reference / payment receipt',
        'Verify recorded transaction for incoming ₹85,000 credit',
        'Upon confirmation → Stop collection & mark Recovered',
      ],
      aiState: 'Verifying Remittance UTR',
    },
    no_response: {
      chipLabel: '“No response (7 days).”',
      badge: 'SILENT CUSTOMER ESCALATION',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      action: 'Escalate to Direct Phone Outreach',
      steps: [
        'AI classified: Email communication ignored',
        'Escalate from automated Email to direct phone call',
        'Adjust tone to urgent but firm executive summary',
        'Prepare phone script for owner review',
      ],
      aiState: 'Direct Escalation Active',
    },
  };

  const currentBranch = decisionBranches[selectedBranch];

  // Slide Animation Variants (Horizontal Slide & Fade)
  const slideVariants = {
    initial: { opacity: 0, x: 80, scale: 0.97 },
    animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.5 } },
    exit: { opacity: 0, x: -80, scale: 0.97, transition: { duration: 0.3 } },
  };

  return (
    <div className="h-screen w-screen bg-[#070B18] text-[#F5F7FF] overflow-hidden select-none relative font-sans">
      {/* Subtle Background Glow Backdrop */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[#4F7CFF]/8 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-[#8B7CFF]/6 rounded-full blur-[140px] pointer-events-none" />

      {/* MINIMAL TOP NAVIGATION */}
      <header className="fixed top-0 left-0 right-0 z-50 h-20 px-8 flex items-center justify-between border-b border-white/5 backdrop-blur-md bg-[#070B18]/70">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F7CFF] to-[#8B7CFF] flex items-center justify-center shadow-lg shadow-[#4F7CFF]/20 border border-white/10 group-hover:scale-105 transition-transform">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-white tracking-wider text-sm">SMART INVOICE</span>
            <span className="text-[#4F7CFF] font-semibold text-xs -mt-1 tracking-widest">CHASING</span>
          </div>
        </Link>

        {/* Center Progress Indicator */}
        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#111936]/80 border border-white/10 text-xs font-mono text-[#9AA5C2]">
          <span className="text-[#4F7CFF] font-bold">0{currentSlide + 1}</span>
          <span className="text-white/20">/</span>
          <span>07</span>
          <div className="flex items-center gap-1.5 ml-3">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentSlide === idx ? 'w-6 bg-[#4F7CFF]' : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* MAIN SLIDE CONTAINER (100VH) */}
      <main className="h-full w-full pt-20 pb-16 px-6 md:px-16 flex items-center justify-center relative z-10">
        <AnimatePresence mode="wait">
          {/* SLIDE 01: THE HOOK */}
          {currentSlide === 0 && (
            <motion.div
              key="slide-1"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
            >
              {/* Left Copy */}
              <div className="lg:col-span-6 space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#4F7CFF]/10 border border-[#4F7CFF]/25 text-[#4F7CFF] text-xs font-semibold tracking-wider uppercase">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Receivables Recovery Agent</span>
                </div>

                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                  DON'T CHASE INVOICES. <br />
                  <span className="bg-gradient-to-r from-[#4F7CFF] via-[#8B7CFF] to-[#FFB84D] bg-clip-text text-transparent">
                    LET AI CHASE THE MONEY.
                  </span>
                </h1>

                <p className="text-base md:text-lg text-[#9AA5C2] max-w-xl font-normal leading-relaxed">
                  Your AI collection agent remembers the conversations you've forgotten and keeps working autonomously until there's a payment outcome.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={() => {
                      router.push('/login');
                    }}
                    className="px-7 py-3.5 rounded-xl bg-[#4F7CFF] hover:bg-[#3d69eb] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#4F7CFF]/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 cursor-pointer"
                  >
                    <span>START RECOVERING</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={goToNextSlide}
                    className="px-6 py-3.5 rounded-xl bg-[#111936] hover:bg-[#19244d] border border-white/10 text-white font-medium text-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 text-[#4F7CFF] fill-[#4F7CFF]" />
                    <span>WATCH IT WORK</span>
                  </button>
                </div>
              </div>

              {/* Right Interactive AI Agent Workspace */}
              <div className="lg:col-span-6">
                <div className="bg-[#111936]/90 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#4F7CFF]/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#4F7CFF]/20 border border-[#4F7CFF]/40 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-[#4F7CFF]" />
                      </div>
                      <div>
                        <div className="text-xs font-mono text-white/50">✦ AI COLLECTION AGENT</div>
                        <div className="text-sm font-semibold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          WORKING AUTONOMOUSLY
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-mono text-[#9AA5C2]">BATCH ACTIVE</div>
                      <div className="text-xs font-mono text-[#FFB84D] font-bold">{processedAccounts} / 12 ACCOUNTS</div>
                    </div>
                  </div>

                  {/* Target Card */}
                  <div className="bg-[#070B18]/80 border border-white/5 rounded-xl p-4 mb-5 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-[#9AA5C2] font-mono uppercase">Target Account</div>
                      <div className="text-base font-bold text-white">Rahul Enterprises</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-[#FFB84D]">₹85,000</div>
                      <div className="text-xs font-mono text-rose-400">83 DAYS OVERDUE</div>
                    </div>
                  </div>

                  {/* Live Activity Logs */}
                  <div className="space-y-2 mb-5 font-mono text-xs">
                    <div className="text-[#9AA5C2] uppercase text-[10px] tracking-wider mb-2">Agent Activity</div>

                    <div className={`flex items-center gap-2 transition-all duration-300 ${agentStep >= 0 ? 'text-emerald-400 opacity-100' : 'text-white/20'}`}>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Reading previous invoice conversation history...</span>
                    </div>

                    <div className={`flex items-center gap-2 transition-all duration-300 ${agentStep >= 1 ? 'text-emerald-400 opacity-100' : 'text-white/20'}`}>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Found payment promise ("Will pay by 30th Jun")...</span>
                    </div>

                    <div className={`flex items-center gap-2 transition-all duration-300 ${agentStep >= 2 ? 'text-emerald-400 opacity-100' : 'text-white/20'}`}>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Verifying recorded payment — Promise date passed without credit</span>
                    </div>

                    <div className={`flex items-center gap-2 transition-all duration-300 ${agentStep >= 3 ? 'text-emerald-400 opacity-100' : 'text-white/20'}`}>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Reviewing last follow-up sentiment & urgency tier...</span>
                    </div>
                  </div>

                  {/* AI Decision Banner */}
                  <div className="bg-[#4F7CFF]/10 border border-[#4F7CFF]/30 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-[#4F7CFF] animate-bounce" />
                      <div>
                        <div className="text-[10px] font-mono text-[#4F7CFF] uppercase font-bold">AI DECISION</div>
                        <div className="text-sm font-semibold text-white">RESUME CONVERSATION NOW</div>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                      Generating email...
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* SLIDE 02: THE PROBLEM */}
          {currentSlide === 1 && (
            <motion.div
              key="slide-2"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-5xl text-center space-y-8"
            >
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[#FFB84D] text-xs font-mono">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>THE UNTRACKED RECEIVABLES LEAK</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                  SOMEWHERE IN YOUR INBOX, <br />
                  <span className="text-[#FFB84D]">MONEY IS WAITING.</span>
                </h2>
              </div>

              {/* Single Invoice Story Card */}
              <div className="bg-[#111936]/90 border border-white/10 rounded-2xl p-8 max-w-3xl mx-auto shadow-2xl backdrop-blur-xl relative">
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                  <div className="text-left">
                    <div className="text-xs font-mono text-[#4F7CFF] font-bold">INV-1042</div>
                    <div className="text-lg font-bold text-white">Rahul Enterprises</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-[#FFB84D]">₹85,000</div>
                    <div className="text-xs font-mono text-rose-400">43 DAYS PAST DUE</div>
                  </div>
                </div>

                {/* Animated Timeline */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-left">
                  <div className={`p-3 rounded-xl border transition-all ${timelineStep >= 0 ? 'bg-white/5 border-white/20 opacity-100' : 'opacity-30 border-white/5'}`}>
                    <div className="text-[10px] font-mono text-white/50">STEP 1</div>
                    <div className="text-xs font-bold text-white mt-1">Invoice Issued</div>
                    <div className="text-[10px] text-[#9AA5C2] mt-0.5">15 May</div>
                  </div>

                  <div className={`p-3 rounded-xl border transition-all ${timelineStep >= 1 ? 'bg-white/5 border-white/20 opacity-100' : 'opacity-30 border-white/5'}`}>
                    <div className="text-[10px] font-mono text-white/50">STEP 2</div>
                    <div className="text-xs font-bold text-white mt-1">Reminder Sent</div>
                    <div className="text-[10px] text-[#9AA5C2] mt-0.5">30 May</div>
                  </div>

                  <div className={`p-3 rounded-xl border transition-all ${timelineStep >= 2 ? 'bg-[#8B7CFF]/15 border-[#8B7CFF]/40 opacity-100' : 'opacity-30 border-white/5'}`}>
                    <div className="text-[10px] font-mono text-[#8B7CFF]">STEP 3</div>
                    <div className="text-xs font-bold text-white mt-1">Client Replied</div>
                    <div className="text-[10px] text-[#8B7CFF] mt-0.5">“Pay next week”</div>
                  </div>

                  <div className={`p-3 rounded-xl border transition-all ${timelineStep >= 3 ? 'bg-[#FFB84D]/15 border-[#FFB84D]/40 opacity-100' : 'opacity-30 border-white/5'}`}>
                    <div className="text-[10px] font-mono text-[#FFB84D]">STEP 4</div>
                    <div className="text-xs font-bold text-[#FFB84D] mt-1">Promise Missed</div>
                    <div className="text-[10px] text-white/60 mt-0.5">7 June</div>
                  </div>

                  <div className={`p-3 rounded-xl border transition-all ${timelineStep >= 4 ? 'bg-white/5 border-white/20 opacity-100' : 'opacity-30 border-white/5'}`}>
                    <div className="text-[10px] font-mono text-white/50">STEP 5</div>
                    <div className="text-xs font-bold text-white mt-1">No Response</div>
                    <div className="text-[10px] text-[#9AA5C2] mt-0.5">Silent Inbox</div>
                  </div>

                  <div className={`p-3 rounded-xl border transition-all ${timelineStep >= 5 ? 'bg-rose-500/20 border-rose-500/40 opacity-100' : 'opacity-30 border-white/5'}`}>
                    <div className="text-[10px] font-mono text-rose-400">STATUS</div>
                    <div className="text-xs font-extrabold text-rose-400 mt-1">43 Days Pass</div>
                    <div className="text-[10px] text-rose-300 mt-0.5">Unfinished</div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                  <p className="text-base text-[#9AA5C2] font-medium">
                    “Most teams don't lose the invoice. <span className="text-white font-bold">They lose track of the conversation.”</span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* SLIDE 03: MEMORY */}
          {currentSlide === 2 && (
            <motion.div
              key="slide-3"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-6xl space-y-8"
            >
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#8B7CFF] text-xs font-mono">
                  <Bot className="w-3.5 h-3.5" />
                  <span>PERSISTENT CONVERSATIONAL CONTEXT</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                  IT REMEMBERS <br />
                  <span className="text-[#8B7CFF]">WHAT YOU FORGOT.</span>
                </h2>
              </div>

              {/* Split Screen Animation */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                {/* Left: Customer Email Fragment */}
                <div className="md:col-span-5 bg-[#111936]/90 border border-white/10 rounded-2xl p-6 shadow-xl relative">
                  <div className="text-xs font-mono text-white/50 mb-3 uppercase tracking-wider flex items-center justify-between">
                    <span>Customer Email Reply</span>
                    <span className="text-[#9AA5C2]">23 Jun</span>
                  </div>
                  <div className="bg-[#070B18] p-4 rounded-xl border border-white/5 text-sm text-[#9AA5C2] italic">
                    “Hi Team, we're waiting for management approval on the Q2 audit. Should be completed and paid by Friday.”
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-white/60">
                    <span>From: Accounts @ Rahul Ent</span>
                    <span className="text-[#FFB84D] font-mono">₹1,20,000</span>
                  </div>
                </div>

                {/* Center Connection Arrow */}
                <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center text-[#8B7CFF]">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#8B7CFF] mb-1">EXTRACT</div>
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#8B7CFF] to-transparent relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#8B7CFF] animate-ping" />
                  </div>
                  <div className="text-[10px] font-mono text-white/40 mt-1">CONTEXT</div>
                </div>

                {/* Right: AI Memory Card */}
                <div className="md:col-span-5 bg-[#111936]/90 border border-[#8B7CFF]/30 rounded-2xl p-6 shadow-2xl relative">
                  <div className="text-xs font-mono text-[#8B7CFF] font-bold mb-3 uppercase tracking-wider flex items-center justify-between">
                    <span>✦ AI COLLECTION MEMORY</span>
                    <span className="w-2 h-2 rounded-full bg-[#8B7CFF] animate-pulse" />
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center bg-[#070B18] p-3 rounded-lg border border-white/5">
                      <span className="text-[#9AA5C2]">Payment Promise:</span>
                      <span className="text-[#FFB84D] font-bold">Friday (Target Date)</span>
                    </div>

                    <div className="flex justify-between items-center bg-[#070B18] p-3 rounded-lg border border-white/5">
                      <span className="text-[#9AA5C2]">Promise Status:</span>
                      <span className="text-rose-400 font-bold">MISSED (43 days past)</span>
                    </div>

                    <div className="flex justify-between items-center bg-[#070B18] p-3 rounded-lg border border-white/5">
                      <span className="text-[#9AA5C2]">Outstanding Balance:</span>
                      <span className="text-white font-bold">₹1,20,000</span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-[#4F7CFF]/15 border border-[#4F7CFF]/30 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-white">NEXT AUTOMATED ACTION:</span>
                    <span className="text-xs font-mono font-bold text-[#4F7CFF] flex items-center gap-1">
                      RESUME CONVERSATION →
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* SLIDE 04: DECISION ENGINE */}
          {currentSlide === 3 && (
            <motion.div
              key="slide-4"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-6xl space-y-6 text-center"
            >
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#4F7CFF]/10 border border-[#4F7CFF]/30 text-[#4F7CFF] text-xs font-mono">
                  <Zap className="w-3.5 h-3.5" />
                  <span>AUTONOMOUS REASONING MATRIX</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                  IT DOESN'T JUST REMIND. <br />
                  <span className="text-[#4F7CFF]">IT DECIDES WHAT HAPPENS NEXT.</span>
                </h2>
              </div>

              {/* Selectable Response Chips */}
              <div className="flex flex-wrap items-center justify-center gap-3 max-w-3xl mx-auto pt-2">
                {(Object.keys(decisionBranches) as Array<keyof typeof decisionBranches>).map((key) => {
                  const branch = decisionBranches[key];
                  const isSelected = selectedBranch === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedBranch(key)}
                      className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#4F7CFF] border-[#4F7CFF] text-white shadow-lg shadow-[#4F7CFF]/30 scale-105'
                          : 'bg-[#111936]/80 border-white/10 text-[#9AA5C2] hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {branch.chipLabel}
                    </button>
                  );
                })}
              </div>

              {/* AI Understanding & Reasoning Display */}
              <div className="bg-[#111936]/90 border border-white/10 rounded-2xl p-6 max-w-4xl mx-auto shadow-2xl text-left backdrop-blur-xl grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Left: Input Understanding */}
                <div className="md:col-span-5 space-y-4">
                  <div className="text-[10px] font-mono text-white/40 uppercase">AI UNDERSTANDING</div>

                  <div className={`inline-block px-3 py-1 rounded-lg border text-xs font-bold font-mono ${currentBranch.badgeClass}`}>
                    {currentBranch.badge}
                  </div>

                  <div>
                    <div className="text-xs text-[#9AA5C2]">Determined Action:</div>
                    <div className="text-lg font-bold text-white mt-1">{currentBranch.action}</div>
                  </div>

                  <div className="p-3 bg-[#070B18] rounded-xl border border-white/5 text-xs text-white/70">
                    <span className="text-[#4F7CFF] font-bold">Status:</span> {currentBranch.aiState}
                  </div>
                </div>

                {/* Right: Execution Steps */}
                <div className="md:col-span-7 bg-[#070B18] p-5 rounded-xl border border-white/5 space-y-3">
                  <div className="text-[10px] font-mono text-[#9AA5C2] uppercase">REASONING PIPELINE</div>
                  {currentBranch.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs">
                      <div className="w-5 h-5 rounded-full bg-[#4F7CFF]/20 text-[#4F7CFF] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        0{idx + 1}
                      </div>
                      <span className="text-white/80">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* SLIDE 05: THE AGENT WORKS */}
          {currentSlide === 4 && (
            <motion.div
              key="slide-5"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-6xl space-y-6 text-center"
            >
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                  <Bot className="w-3.5 h-3.5" />
                  <span>AUTONOMOUS BACKGROUND EXECUTION</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                  YOU STOP CHASING. <br />
                  <span className="text-emerald-400">IT KEEPS WORKING.</span>
                </h2>
              </div>

              {/* Live Chasing Work Queue */}
              <div className="bg-[#111936]/90 border border-white/10 rounded-2xl p-6 max-w-5xl mx-auto shadow-2xl backdrop-blur-xl text-left space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-sm font-bold text-white font-mono">✦ LIVE AGENT WORK QUEUE</span>
                  </div>
                  <span className="text-xs font-mono text-[#9AA5C2]">ACTIVE PIPELINE: 12 ACCOUNTS</span>
                </div>

                {/* Streamed Work Queue Items */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-4 bg-[#070B18] rounded-xl border border-white/5 flex flex-wrap items-center justify-between gap-4 hover:border-white/15 transition-all">
                    <div>
                      <div className="text-white font-bold text-sm">Rahul Enterprises</div>
                      <div className="text-[#9AA5C2] text-[11px]">Payment promise missed (Target 30 Jun)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#FFB84D] font-bold text-sm">₹85,000</div>
                      <div className="text-emerald-400 text-[11px] font-sans">→ Following up automatically</div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#070B18] rounded-xl border border-white/5 flex flex-wrap items-center justify-between gap-4 hover:border-white/15 transition-all">
                    <div>
                      <div className="text-white font-bold text-sm">ABC Pvt Ltd</div>
                      <div className="text-[#9AA5C2] text-[11px]">91 days past due • 2 broken promises</div>
                    </div>
                    <div className="text-right">
                      <div className="text-rose-400 font-bold text-sm">₹1,80,000</div>
                      <div className="text-rose-400 text-[11px] font-sans">→ Human escalation recommended 🚨</div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#070B18] rounded-xl border border-white/5 flex flex-wrap items-center justify-between gap-4 hover:border-white/15 transition-all">
                    <div>
                      <div className="text-white font-bold text-sm">XYZ Agency</div>
                      <div className="text-[#9AA5C2] text-[11px]">Customer email reply received 10m ago</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#8B7CFF] font-bold text-sm">₹92,000</div>
                      <div className="text-[#8B7CFF] text-[11px] font-sans">→ AI analyzing response sentiment</div>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-950/20 rounded-xl border border-emerald-500/20 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-white font-bold text-sm">Kumar Studios</div>
                      <div className="text-emerald-400/70 text-[11px]">Payment confirmed via transfer reference</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-bold text-sm">₹42,000</div>
                      <div className="text-emerald-400 text-[11px] font-bold font-sans">Collection complete ✓</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* SLIDE 06: MONEY */}
          {currentSlide === 5 && (
            <motion.div
              key="slide-6"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-6xl space-y-8 text-center"
            >
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>RECOVERY OUTCOME LEDGER</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                  EVERY RECOVERED RUPEE <br />
                  <span className="text-emerald-400">HAS A STORY.</span>
                </h2>
              </div>

              {/* Recovery Stories */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
                <div className="bg-[#111936]/90 border border-white/10 p-5 rounded-2xl">
                  <div className="text-xs font-mono text-[#9AA5C2]">STORY 01</div>
                  <div className="text-xl font-extrabold text-white mt-1">₹1,20,000</div>
                  <div className="text-xs text-[#9AA5C2] mt-2">Reminder #2 → Context Check</div>
                  <div className="mt-4 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-mono font-bold inline-block">
                    PAID IN FULL ✓
                  </div>
                </div>

                <div className="bg-[#111936]/90 border border-white/10 p-5 rounded-2xl">
                  <div className="text-xs font-mono text-[#9AA5C2]">STORY 02</div>
                  <div className="text-xl font-extrabold text-white mt-1">₹85,000</div>
                  <div className="text-xs text-[#9AA5C2] mt-2">Missed promise → Follow-up</div>
                  <div className="mt-4 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-mono font-bold inline-block">
                    PAID IN FULL ✓
                  </div>
                </div>

                <div className="bg-[#111936]/90 border border-white/10 p-5 rounded-2xl">
                  <div className="text-xs font-mono text-[#9AA5C2]">STORY 03</div>
                  <div className="text-xl font-extrabold text-white mt-1">₹2,10,000</div>
                  <div className="text-xs text-[#9AA5C2] mt-2">Human Escalation script</div>
                  <div className="mt-4 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-mono font-bold inline-block">
                    PAID IN FULL ✓
                  </div>
                </div>

                <div className="bg-[#111936]/90 border border-white/10 p-5 rounded-2xl">
                  <div className="text-xs font-mono text-[#9AA5C2]">STORY 04</div>
                  <div className="text-xl font-extrabold text-white mt-1">₹65,000</div>
                  <div className="text-xs text-[#9AA5C2] mt-2">Follow-up #3 → Payment link</div>
                  <div className="mt-4 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-mono font-bold inline-block">
                    PAID IN FULL ✓
                  </div>
                </div>
              </div>

              {/* Total Recovered Summary Banner */}
              <div className="bg-gradient-to-r from-[#111936] via-[#16224c] to-[#111936] border border-emerald-500/30 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-6 max-w-4xl mx-auto shadow-2xl">
                <div>
                  <div className="text-xs font-mono text-emerald-400 font-bold uppercase">TOTAL RECOVERED</div>
                  <div className="text-4xl font-extrabold text-white mt-1">₹4,80,000</div>
                </div>
                <div className="flex items-center gap-6 text-left">
                  <div>
                    <div className="text-xs text-[#9AA5C2]">Recovery Rate</div>
                    <div className="text-lg font-bold text-emerald-400">84.2%</div>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <div className="text-xs text-[#9AA5C2]">Attention Needed</div>
                    <div className="text-lg font-bold text-[#FFB84D]">₹2,80,000</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* SLIDE 07: THE STARTING POINT / FINAL CTA */}
          {currentSlide === 6 && (
            <motion.div
              key="slide-7"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-5xl space-y-8 text-center"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#4F7CFF]/15 border border-[#4F7CFF]/30 text-[#4F7CFF] text-xs font-mono">
                  <Upload className="w-3.5 h-3.5" />
                  <span>ZERO-FRICTION ONBOARDING</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
                  ALREADY HAVE <br />
                  <span className="bg-gradient-to-r from-[#4F7CFF] via-[#8B7CFF] to-[#FFB84D] bg-clip-text text-transparent">
                    MONTHS OF UNPAID INVOICES?
                  </span>
                </h2>
                <p className="text-lg text-[#9AA5C2]">Don't start from zero. Import your existing receivables in seconds.</p>
              </div>

              {/* Import & AI Analysis Animation Card */}
              <div className="bg-[#111936]/90 border border-white/10 rounded-2xl p-8 max-w-3xl mx-auto shadow-2xl space-y-6 backdrop-blur-xl">
                <div className="flex items-center justify-center gap-4 text-xs font-mono text-[#9AA5C2]">
                  <span className="flex items-center gap-1.5 text-white">
                    <FileSpreadsheet className="w-4 h-4 text-[#4F7CFF]" /> CSV / EXCEL
                  </span>
                  <span>→</span>
                  <span className="flex items-center gap-1.5 text-[#8B7CFF]">
                    <Bot className="w-4 h-4" /> AI ANALYSIS
                  </span>
                  <span>→</span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> RECOVERY READY
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left font-mono text-xs">
                  <div className="bg-[#070B18] p-3 rounded-xl border border-white/5">
                    <div className="text-[#9AA5C2]">Overdue Invoices</div>
                    <div className="text-lg font-bold text-white mt-1">43</div>
                  </div>
                  <div className="bg-[#070B18] p-3 rounded-xl border border-white/5">
                    <div className="text-[#9AA5C2]">Unfinished Follow-ups</div>
                    <div className="text-lg font-bold text-[#8B7CFF] mt-1">18</div>
                  </div>
                  <div className="bg-[#070B18] p-3 rounded-xl border border-white/5">
                    <div className="text-[#9AA5C2]">Missed Promises</div>
                    <div className="text-lg font-bold text-[#FFB84D] mt-1">11</div>
                  </div>
                  <div className="bg-[#070B18] p-3 rounded-xl border border-white/5">
                    <div className="text-[#9AA5C2]">Priority Receivables</div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">₹6.2L</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => {
                      router.push('/login');
                    }}
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8B7CFF] text-white font-bold text-sm tracking-wide shadow-xl shadow-[#4F7CFF]/30 hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <span>START RECOVERING NOW</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MINIMAL BOTTOM CONTROLS & PROGRESS */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 h-16 px-8 flex items-center justify-between border-t border-white/5 bg-[#070B18]/80 backdrop-blur-md">
        <div className="text-xs text-[#9AA5C2] font-mono flex items-center gap-3">
          <span className="hidden sm:inline">Use mouse wheel, arrows, or controls to navigate story</span>
          <span className="sm:hidden">Swipe to navigate story</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={goToPrevSlide}
            disabled={currentSlide === 0}
            className={`p-2 rounded-lg border border-white/10 transition-all ${
              currentSlide === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 text-white cursor-pointer'
            }`}
            title="Previous Slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono text-white/50 px-1">
            0{currentSlide + 1} / 07
          </span>

          <button
            onClick={goToNextSlide}
            disabled={currentSlide === totalSlides - 1}
            className={`p-2 rounded-lg border border-white/10 transition-all ${
              currentSlide === totalSlides - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 text-white cursor-pointer'
            }`}
            title="Next Slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};
