'use client';

import React from 'react';
import { Lock, ArrowUpRight, FileSpreadsheet, Mail, Building2, CreditCard, MessageSquare, ShieldCheck, Database, Code } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../layout/PageHeader';

export const IntegrationsView: React.FC = () => {
  const { showToast } = useApp();

  const integrations = [
    {
      id: 'csv',
      name: 'CSV / Excel Import',
      category: 'File Import',
      status: 'Connected',
      desc: 'Import customer invoices, due dates, contact emails, and receivable balances.',
      icon: <FileSpreadsheet className="w-6 h-6 text-emerald-400" />,
      isAvailable: true,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    {
      id: 'email',
      name: 'Email Service',
      category: 'Communication',
      status: 'Connected',
      desc: 'High-deliverability AI email sequence dispatcher and customer reply classifier.',
      icon: <Mail className="w-6 h-6 text-cyan-400" />,
      isAvailable: true,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    {
      id: 'accounting',
      name: 'Accounting System',
      category: 'ERP Sync',
      status: 'Planned',
      desc: 'Synchronize invoices, customer ledgers, and payment statuses automatically.',
      icon: <Building2 className="w-6 h-6 text-slate-400" />,
      isAvailable: false,
      badgeColor: 'bg-slate-900 text-slate-500 border-slate-800',
    },
    {
      id: 'payment_gateway',
      name: 'Payment Gateway',
      category: 'Checkout Links',
      status: 'Planned',
      desc: 'Generate 1-click payment links and receive automated payment confirmation webhooks.',
      icon: <CreditCard className="w-6 h-6 text-amber-400" />,
      isAvailable: false,
      badgeColor: 'bg-slate-900 text-slate-500 border-slate-800',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      category: 'Multi-Channel',
      status: 'Planned',
      desc: 'Send adaptive WhatsApp reminders and regional language collection messages.',
      icon: <MessageSquare className="w-6 h-6 text-emerald-500" />,
      isAvailable: false,
      badgeColor: 'bg-slate-900 text-slate-500 border-slate-800',
    },
    {
      id: 'verification',
      name: 'Payment Verification',
      category: 'Financial Audit',
      status: 'Planned',
      desc: 'Verify customer payment claims and UTR transaction numbers against banking records.',
      icon: <ShieldCheck className="w-6 h-6 text-[#8B7CFF]" />,
      isAvailable: false,
      badgeColor: 'bg-slate-900 text-slate-500 border-slate-800',
    },
    {
      id: 'crm',
      name: 'Customer Data / CRM',
      category: 'Customer Intelligence',
      status: 'Planned',
      desc: 'Provide customer relationship context, historical payment delays, and risk scoring.',
      icon: <Database className="w-6 h-6 text-teal-400" />,
      isAvailable: false,
      badgeColor: 'bg-slate-900 text-slate-500 border-slate-800',
    },
    {
      id: 'api_webhooks',
      name: 'API & Webhooks',
      category: 'Developer API',
      status: 'Planned',
      desc: 'Connect custom internal ERPs and receive real-time collection event payloads.',
      icon: <Code className="w-6 h-6 text-indigo-400" />,
      isAvailable: false,
      badgeColor: 'bg-slate-900 text-slate-500 border-slate-800',
    },
  ];

  const handleConnect = (name: string, isAvailable: boolean) => {
    if (isAvailable) {
      showToast(`${name} is connected & active in workspace.`, 'success');
    } else {
      showToast(`${name} integration capability planned for next rollout!`, 'info');
    }
  };

  return (
    <div className="space-y-4 p-6 max-w-7xl mx-auto font-sans">
      {/* Shared Page Context Header */}
      <PageHeader
        title="Integrations"
        subtitle="Connect the services that power invoice ingestion, communication, payments, and data."
      />

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {integrations.map((item) => (
          <div
            key={item.id}
            className="p-6 rounded-3xl bg-slate-950 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition shadow-xl"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-slate-900 rounded-2xl border border-slate-800">{item.icon}</div>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase border ${item.badgeColor}`}>
                  {item.status}
                </span>
              </div>

              <h3 className="font-bold text-white text-base">{item.name}</h3>
              <p className="text-[11px] text-emerald-400 font-mono mb-2 font-semibold">{item.category}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </div>

            <button
              onClick={() => handleConnect(item.name, item.isAvailable)}
              className={`mt-6 w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                item.isAvailable
                  ? 'bg-slate-900 text-emerald-400 border border-emerald-500/30 hover:bg-slate-800'
                  : 'bg-slate-900/60 text-slate-500 border border-slate-800/80 hover:text-slate-300'
              }`}
            >
              <span>{item.isAvailable ? 'Manage Integration' : 'Planned'}</span>
              {item.isAvailable ? <ArrowUpRight className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-slate-600" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
