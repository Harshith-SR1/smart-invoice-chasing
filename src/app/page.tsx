'use client';

import React from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import { Sidebar, Navbar } from '../components/layout/Sidebar';
import { LandingPage } from '../components/landing/LandingPage';
import { SignInModal } from '../components/auth/SignInModal';
import { BusinessSetupModal } from '../components/onboarding/BusinessSetupModal';
import { ImportDataView } from '../components/onboarding/ImportDataView';
import { AiProcessingView } from '../components/onboarding/AiProcessingView';
import { AhaMomentView } from '../components/onboarding/AhaMomentView';
import { AiRecommendationsView } from '../components/onboarding/AiRecommendationsView';
import { AutomationSetupModal } from '../components/onboarding/AutomationSetupModal';
import { MainDashboard } from '../components/dashboard/MainDashboard';
import { CollectionsHub } from '../components/collections/CollectionsHub';
import { InvoiceListView } from '../components/invoices/InvoiceListView';
import { CustomerDirectoryView } from '../components/customers/CustomerDirectoryView';
import { RecoveryReportsView } from '../components/reports/RecoveryReportsView';
import { IntegrationsView } from '../components/integrations/IntegrationsView';
import { SettingsView } from '../components/settings/SettingsView';
import { AiDecisionsView } from '../components/decisions/AiDecisionsView';
import { ActivityFeedView } from '../components/activity/ActivityFeedView';
import { AgingView } from '../components/aging/AgingView';
import { PaymentRiskView } from '../components/risk/PaymentRiskView';
import { InvoiceDetailModal } from '../components/invoices/InvoiceDetailModal';
import { AiMessageReviewModal } from '../components/invoices/AiMessageReviewModal';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

function AppContent() {
  const { activeScreen, toastMessage } = useApp();

  const renderScreen = () => {
    switch (activeScreen) {
      case 'landing':
        return <LandingPage />;
      case 'signin':
        return <SignInModal />;
      case 'business_setup':
        return <BusinessSetupModal />;
      case 'import_data':
        return <ImportDataView />;
      case 'ai_processing':
        return <AiProcessingView />;
      case 'aha_moment':
        return <AhaMomentView />;
      case 'ai_recommendations':
        return <AiRecommendationsView />;
      case 'automation_setup':
        return <AutomationSetupModal />;
      case 'dashboard':
        return <MainDashboard />;
      case 'collections':
        return <CollectionsHub />;
      case 'invoices':
        return <InvoiceListView />;
      case 'customers':
        return <CustomerDirectoryView />;
      case 'ai-decisions':
        return <AiDecisionsView />;
      case 'activity':
        return <ActivityFeedView />;
      case 'aging':
        return <AgingView />;
      case 'risk':
        return <PaymentRiskView />;
      case 'reports':
        return <RecoveryReportsView />;
      case 'integrations':
        return <IntegrationsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <LandingPage />;
    }
  };

  const isFullPage =
    activeScreen === 'landing' ||
    activeScreen === 'signin' ||
    activeScreen === 'business_setup' ||
    activeScreen === 'import_data' ||
    activeScreen === 'ai_processing' ||
    activeScreen === 'aha_moment' ||
    activeScreen === 'ai_recommendations' ||
    activeScreen === 'automation_setup';

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col antialiased">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-xl ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                : toastMessage.type === 'info'
                ? 'bg-slate-900/90 text-slate-200 border-slate-700'
                : 'bg-rose-950/90 text-rose-300 border-rose-500/50'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Info className="w-4 h-4 text-emerald-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      {isFullPage ? (
        <main className="flex-1">{renderScreen()}</main>
      ) : (
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Navbar />
            <main className="flex-1 overflow-y-auto">{renderScreen()}</main>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <InvoiceDetailModal />
      <AiMessageReviewModal />
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
