'use client';

import React, { useEffect, Suspense } from 'react';
import { useApp } from '../../context/AppContext';
import { SettingsView } from '../../components/settings/SettingsView';
import { Sidebar, Navbar } from '../../components/layout/Sidebar';
import { InvoiceDetailModal } from '../../components/invoices/InvoiceDetailModal';
import { AiMessageReviewModal } from '../../components/invoices/AiMessageReviewModal';

export default function SettingsPage() {
  const { setActiveScreen } = useApp();

  useEffect(() => {
    setActiveScreen('settings');
  }, [setActiveScreen]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col antialiased">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 overflow-y-auto">
            <Suspense fallback={<div className="p-8 text-slate-400">Loading settings...</div>}>
              <SettingsView />
            </Suspense>
          </main>
        </div>
      </div>

      <InvoiceDetailModal />
      <AiMessageReviewModal />
    </div>
  );
}
