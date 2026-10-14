'use client';

import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Loader2, Sparkles, BrainCircuit } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AiProcessingView: React.FC = () => {
  const { setActiveScreen } = useApp();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    'Reading imported invoice records...',
    'Identifying overdue accounts & days past due...',
    'Analyzing historical payment behavior & payment delays...',
    'Finding unfinished collection conversations...',
    'Detecting payment promises & missed commitments...',
    'Identifying high-priority receivables...',
    'Preparing personalized AI collection recommendations...',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setActiveScreen('aha_moment');
          }, 800);
          return prev;
        }
      });
    }, 600);

    return () => clearInterval(interval);
  }, [setActiveScreen, steps.length]);

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 text-center">
        <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <BrainCircuit className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          AI Engine Analyzing Receivables
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Analyzing your business history</h2>
        <p className="text-xs text-slate-400 mb-8">
          The AI employee is processing your imported files and scanning for recoverable cash.
        </p>

        {/* Progress List */}
        <div className="space-y-3 text-left bg-slate-900/60 rounded-2xl border border-slate-800/80 p-5">
          {steps.map((stepText, idx) => {
            const isDone = idx < currentStep;
            const isCurrent = idx === currentStep;

            return (
              <div key={idx} className="flex items-center gap-3">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-800 shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    isDone
                      ? 'text-slate-300'
                      : isCurrent
                      ? 'text-emerald-300 font-bold'
                      : 'text-slate-600'
                  }`}
                >
                  {stepText}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
