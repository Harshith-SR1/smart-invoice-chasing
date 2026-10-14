'use client';

import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AgingView } from '../../components/aging/AgingView';
import { Sidebar, Navbar } from '../../components/layout/Sidebar';
import { InvoiceDetailModal } from '../../components/invoices/InvoiceDetailModal';

export default function AgingPage() {
  const { setActiveScreen } = useApp();

  useEffect(() => {
    setActiveScreen('aging');
  }, [setActiveScreen]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col antialiased">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 overflow-y-auto">
            <AgingView />
          </main>
        </div>
      </div>

      <InvoiceDetailModal />
    </div>
  );
}
