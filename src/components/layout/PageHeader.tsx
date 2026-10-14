'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: 'emerald' | 'violet' | 'amber' | 'rose' | 'slate';
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  badgeColor = 'emerald',
  actions,
}) => {
  const { setActiveScreen } = useApp();

  const badgeStyle = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    violet: 'bg-[#8B7CFF]/15 text-[#8B7CFF] border-[#8B7CFF]/30',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    slate: 'bg-slate-800 text-slate-300 border-slate-700',
  }[badgeColor];

  return (
    <div className="pt-2 pb-4 mb-4 border-b border-slate-800/80 space-y-2">
      {/* Back to Dashboard Link */}
      <div>
        <Link
          href="/dashboard"
          onClick={() => setActiveScreen('dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Title & Subtitle + Optional Badge/Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight font-sans">
              {title}
            </h1>
            {badge && (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border uppercase tracking-wider ${badgeStyle}`}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-normal max-w-3xl">
            {subtitle}
          </p>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
