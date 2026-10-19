'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import {
  ActiveScreen,
  AutomationRules,
  Customer,
  Invoice,
  PaymentPromise,
  RecoveryReportSummary,
  Workspace,
  AiDecision,
  InvoiceStatus,
} from '../types';
import {
  defaultAutomationRules,
  initialCustomers,
  initialInvoices,
  initialPaymentPromises,
  initialReportSummary,
  initialWorkspace,
} from '../lib/mockData';
import { createClient } from '../lib/supabase/client';
import { accountService, isUuid } from '../services/accountService';
import { evaluateInvoiceDecision, getWhyUnpaidDiagnosis, classifyInvoiceCategory } from '../lib/decisionEngine';

interface AppContextType {
  user: User | null;
  session: Session | null;
  signOut: () => Promise<void>;
  workspace: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  activeScreen: ActiveScreen;
  setActiveScreen: (screen: ActiveScreen) => void;
  invoices: Invoice[];
  customers: Customer[];
  promises: PaymentPromise[];
  decisions: AiDecision[];
  automationRules: AutomationRules;
  setAutomationRules: React.Dispatch<React.SetStateAction<AutomationRules>>;
  reportSummary: RecoveryReportSummary;
  selectedInvoice: Invoice | null;
  setSelectedInvoice: (invoice: Invoice | null) => void;
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;
  reviewMessageInvoice: Invoice | null;
  setReviewMessageInvoice: (invoice: Invoice | null) => void;
  activeCollectionFilter: string;
  setActiveCollectionFilter: (filter: string) => void;
  activeInvoiceFilter: string;
  setActiveInvoiceFilter: (filter: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isLoading: boolean;
  
  // Actions
  handleImportData: (newRecords: any[], fileName?: string, batchId?: string, duplicatePolicy?: 'update' | 'skip') => void;
  handleResumeAllCollections: () => void;
  handleResumeInvoiceCollection: (invoiceId: string) => void;
  handleMarkAsPaid: (invoiceId: string, paidAmount?: number) => void;
  handleRecordPayment: (invoiceId: string, paidAmount: number, isFull?: boolean) => void;
  handleClaimPayment: (invoiceId: string, claimedAmount: number, note?: string) => void;
  handleVerifyClaimedPayment: (invoiceId: string, isVerified: boolean) => void;
  handleApproveDecision: (decisionId: string) => void;
  handleExecuteDecision: (decisionId: string) => void;
  handleDismissDecision: (decisionId: string) => void;
  handleCreatePromise: (invoiceId: string, amount: number, promisedDate: string, quoteText: string) => void;
  handleEscalateInvoice: (invoiceId: string) => void;
  handleSendAiMessage: (invoiceId: string, updatedSubject?: string, updatedBody?: string) => void;
  handleUpdateAutomationRules: (newRules: Partial<AutomationRules>) => void;
  toastMessage: { text: string; type: 'success' | 'info' | 'error' } | null;
  showToast: (text: string, type?: 'success' | 'info' | 'error') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function buildRecoveryReportSummary(
  invoices: Invoice[],
  promises: PaymentPromise[],
  currency: string = 'INR',
  isRealWorkspace: boolean = false
): RecoveryReportSummary {
  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const yearNum = now.getFullYear();
  const isINR = currency.includes('INR') || currency === 'INR';
  const currencySymbol = isINR ? '₹' : '$';

  if (invoices.length === 0) {
    return {
      month: monthName,
      year: yearNum,
      totalRecovered: 0,
      totalOutstanding: 0,
      chasedInvoicesCount: 0,
      remindersSent: 0,
      repliesReceived: 0,
      promisesDetected: 0,
      promisesFulfilled: 0,
      escalatedCount: 0,
      unrecoveredAccounts: [],
      aiExecutiveSummary: isRealWorkspace
        ? 'No invoice records found in this workspace. Import invoices or connect your accounting integration to generate recovery intelligence.'
        : 'Demo Workspace: No invoices loaded.',
    };
  }

  // 1. Recovered Revenue: Strictly verified payments
  const totalRecovered = invoices.reduce((sum, inv) => {
    const paid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.status === 'paid' ? inv.amount : 0);
    return sum + paid;
  }, 0);

  // 2. Outstanding Balance: Authoritative balance across unpaid/partially paid invoices
  const totalOutstanding = invoices
    .filter((inv) => inv.status !== 'paid')
    .reduce((sum, inv) => {
      const out = inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount;
      return sum + out;
    }, 0);

  // 3. Reminders Dispatched: Authoritative count from communication records
  const remindersSent = invoices.reduce((sum, inv) => sum + (inv.remindersSent || 0), 0);

  // 4. Customer Replies
  const repliesReceived = invoices.reduce((sum, inv) => sum + (inv.customerRepliesCount || 0), 0);

  // 5. Promises Detected & Fulfilled
  const promisesDetected = promises.length;
  const promisesFulfilled = promises.filter(
    (p) => p.status === 'FULFILLED' || p.status === 'fulfilled'
  ).length;

  // 6. Chased Invoices Count
  const chasedInvoicesCount = invoices.filter(
    (inv) => (inv.remindersSent || 0) > 0 || inv.status === 'chasing' || inv.status === 'escalated' || inv.status === 'promised'
  ).length;

  // 7. Human Escalations: explicitly escalated or >= 5 reminders
  const escalatedCount = invoices.filter(
    (inv) => inv.status === 'escalated' || (inv.remindersSent || 0) >= 5
  ).length;

  // 8. Unrecovered Accounts: unpaid accounts with repeated follow-ups or escalation
  const unrecoveredAccounts = invoices
    .filter(
      (inv) => inv.status !== 'paid' && (inv.outstandingAmount || inv.amount) > 0 && ((inv.remindersSent || 0) >= 3 || inv.status === 'escalated' || inv.status === 'overdue')
    )
    .map((inv) => {
      const outstanding = inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount;
      let rec = 'Formal Notice & Phone Outreach';
      if (inv.status === 'escalated' || (inv.remindersSent || 0) >= 5) {
        rec = 'Direct Founder Call / Legal Escalation';
      } else if (inv.daysOverdue > 60) {
        rec = 'Consolidated Statement Demand';
      }

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        amount: outstanding,
        remindersCount: inv.remindersSent || 0,
        daysOverdue: inv.daysOverdue || 0,
        lastResponse: inv.lastCustomerReply || 'No customer response received yet',
        recommendation: rec,
      };
    });

  // 9. AI Executive Summary derived strictly from evidence
  const aiExecutiveSummary = `In ${monthName} ${yearNum}, Smart Invoice Chasing tracked ${currencySymbol}${totalRecovered.toLocaleString()} in verified recovered revenue across ${promisesFulfilled} fulfilled payment commitment(s). ${escalatedCount} account(s) have been flagged for human escalation with ${currencySymbol}${totalOutstanding.toLocaleString()} currently outstanding across ${invoices.length} managed invoice(s).`;

  return {
    month: monthName,
    year: yearNum,
    totalRecovered,
    totalOutstanding,
    chasedInvoicesCount,
    remindersSent,
    repliesReceived,
    promisesDetected,
    promisesFulfilled,
    escalatedCount,
    unrecoveredAccounts,
    aiExecutiveSummary,
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('landing');
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [promises, setPromises] = useState<PaymentPromise[]>(initialPaymentPromises);
  const [automationRules, setAutomationRules] = useState<AutomationRules>(defaultAutomationRules);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const isRealWorkspace = Boolean(user && isUuid(workspace.id) && workspace.id !== 'ws-default');

  // Authoritative Derived Recovery Report Summary (REP-001)
  const reportSummary: RecoveryReportSummary = useMemo(() => {
    if (!isRealWorkspace && invoices === initialInvoices) {
      return initialReportSummary;
    }
    return buildRecoveryReportSummary(invoices, promises, workspace.currency, isRealWorkspace);
  }, [invoices, promises, workspace.currency, isRealWorkspace]);
  
  // Stored state for manual decision overrides (e.g. dismissed or approved)
  const [decisionOverrides, setDecisionOverrides] = useState<Record<string, { status: AiDecision['status']; executedAt?: string }>>({});
  const [persistedDbDecisions, setPersistedDbDecisions] = useState<Record<string, { id: string; status: string; executedAt?: string }>>({});

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [reviewMessageInvoice, setReviewMessageInvoice] = useState<Invoice | null>(null);

  const [activeCollectionFilter, setActiveCollectionFilter] = useState<string>('All');
  const [activeInvoiceFilter, setActiveInvoiceFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync Supabase Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Load backend data if available
  useEffect(() => {
    async function loadData() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const ws = await accountService.fetchWorkspace(user?.id);
        if (ws) setWorkspace(ws);

        const targetWsId = ws?.id || workspace.id;
        const invs = await accountService.fetchInvoices(targetWsId);
        if (invs) {
          setInvoices(invs);
        }

        const custs = await accountService.fetchCustomers(targetWsId);
        if (custs) setCustomers(custs);

        const prms = await accountService.fetchPromises(targetWsId);
        if (prms) {
          const todayStr = getLocalDateString();
          const evaluatedPromises = prms.map((p) => {
            if ((p.status === 'pending' || p.status === 'ACTIVE') && p.promisedDate < todayStr) {
              return { ...p, status: 'BROKEN' as const };
            }
            return p;
          });
          setPromises(evaluatedPromises);
        }

        const rules = await accountService.fetchAutomationRules(targetWsId);
        if (rules) setAutomationRules(rules);

        // Load persisted AI Decisions lifecycle overrides
        if (isUuid(targetWsId)) {
          const dbDecisions = await accountService.fetchDecisions(targetWsId);
          const overrides: Record<string, { status: AiDecision['status']; executedAt?: string }> = {};
          const dbDecisionMap: Record<string, { id: string; status: string; executedAt?: string }> = {};

          for (const d of dbDecisions) {
            const uiStatus: AiDecision['status'] =
              d.status === 'approved' ? 'APPROVED' :
              d.status === 'rejected' ? 'DISMISSED' :
              d.status === 'executed' ? 'EXECUTED' : 'PENDING';

            dbDecisionMap[d.invoiceId] = { id: d.id, status: d.status };
            dbDecisionMap[d.id] = { id: d.id, status: d.status };

            if (uiStatus !== 'PENDING') {
              overrides[d.id] = { status: uiStatus };
              overrides[d.invoiceId] = { status: uiStatus };
            }
          }
          setPersistedDbDecisions(dbDecisionMap);
          setDecisionOverrides((prev) => ({ ...prev, ...overrides }));

          // Ensure decisions exist in DB for active invoices
          if (invs && invs.length > 0) {
            const initialDecs = invs.map((inv) => {
              const cust = (custs || []).find((c) => c.id === inv.customerId);
              return evaluateInvoiceDecision(inv, cust, prms || []);
            });
            await accountService.syncDecisions(targetWsId, initialDecs);
          }
        }
      } catch (err) {
        console.warn('Backend load notice (using current state):', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  // Derived Decisions for all active invoices
  const decisions: AiDecision[] = useMemo(() => {
    const custMap = new Map<string, Customer>();
    customers.forEach((c) => custMap.set(c.id, c));

    return invoices.map((inv) => {
      const cust = custMap.get(inv.customerId);
      const dec = evaluateInvoiceDecision(inv, cust, promises);
      const dbRecord = persistedDbDecisions[inv.id];
      const stableId = dbRecord ? dbRecord.id : `dec-${inv.id}`;
      const override = decisionOverrides[stableId] || decisionOverrides[inv.id] || (dbRecord && dbRecord.status !== 'pending' ? {
        status: (dbRecord.status === 'approved' ? 'APPROVED' : dbRecord.status === 'rejected' ? 'DISMISSED' : dbRecord.status === 'executed' ? 'EXECUTED' : 'PENDING') as AiDecision['status']
      } : undefined);

      if (override) {
        return {
          ...dec,
          id: stableId,
          status: override.status,
          executedAt: override.executedAt || dec.executedAt,
        };
      }
      return {
        ...dec,
        id: stableId,
      };
    });
  }, [invoices, customers, promises, decisionOverrides, persistedDbDecisions]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setActiveScreen('landing');
    showToast('Signed out successfully.', 'info');
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const handleImportData = (
    newRecords: any[],
    fileName: string = 'imported_invoices.csv',
    batchId: string = `IMP-${Date.now()}`,
    duplicatePolicy: 'update' | 'skip' = 'update'
  ) => {
    const todayStr = getLocalDateString();
    const now = new Date();
    const currencySymbol = workspace.currency?.includes('INR') || workspace.currency === 'INR' ? '₹' : '$';

    // Map existing invoices by invoice number
    const existingMap = new Map<string, Invoice>();
    invoices.forEach((inv) => existingMap.set(inv.invoiceNumber.toLowerCase().trim(), inv));

    const processedInvoices: Invoice[] = [];

    newRecords.forEach((item, idx) => {
      const num = String(item.invoiceNumber || '').trim();
      if (!num) return;

      const custName = String(item.customerName || 'Unknown Customer').trim();
      const custEmail = item.customerEmail || `${custName.toLowerCase().replace(/[^a-z0-9]/g, '')}@billing.com`;
      const amt = Number(item.amount) || 0;
      const due = item.dueDate || todayStr;
      const issue = item.issueDate || todayStr;

      let isPaid = item.status === 'paid';
      let paidAmt = Number(item.paidAmount) || (isPaid ? amt : 0);
      let outstanding = item.outstandingAmount !== undefined ? Number(item.outstandingAmount) : amt - paidAmt;

      if (outstanding <= 0 && amt > 0) {
        isPaid = true;
        outstanding = 0;
        paidAmt = amt;
      }

      const diffDays = Math.ceil((now.getTime() - new Date(due).getTime()) / (1000 * 60 * 60 * 24));
      const daysOverdue = isPaid ? 0 : Math.max(0, diffDays);

      let status: InvoiceStatus = 'overdue';
      if (isPaid) {
        status = 'paid';
      } else if (paidAmt > 0 && outstanding > 0) {
        status = 'partially_paid';
      } else if (item.status === 'disputed') {
        status = 'disputed';
      } else if (item.status === 'promised') {
        status = 'promised';
      } else if (daysOverdue > 0) {
        status = 'overdue';
      } else {
        status = 'chasing';
      }

      let collectionHealth = 85;
      let healthCategory: 'high_risk' | 'medium_risk' | 'low_risk' = 'low_risk';
      const healthReasons: string[] = [];

      if (isPaid) {
        collectionHealth = 100;
        healthCategory = 'low_risk';
        healthReasons.push('Paid in full');
      } else if (daysOverdue > 60) {
        collectionHealth = 20;
        healthCategory = 'high_risk';
        healthReasons.push(`${daysOverdue} days overdue`);
        healthReasons.push('Exceeded standard aging threshold');
      } else if (daysOverdue > 30) {
        collectionHealth = 45;
        healthCategory = 'medium_risk';
        healthReasons.push(`${daysOverdue} days past due`);
      } else if (daysOverdue > 0) {
        collectionHealth = 70;
        healthCategory = 'medium_risk';
        healthReasons.push(`${daysOverdue} days overdue`);
      } else {
        collectionHealth = 95;
        healthCategory = 'low_risk';
        healthReasons.push(`Due on ${due}`);
      }

      const invoiceId = existingMap.get(num.toLowerCase())?.id || `inv-imp-${Date.now()}-${idx}`;
      const customerId = `cust-${custName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

      const newInvoice: Invoice = {
        id: invoiceId,
        invoiceNumber: num,
        customerId,
        customerName: custName,
        customerEmail: custEmail,
        amount: amt,
        paidAmount: paidAmt,
        outstandingAmount: outstanding,
        currency: workspace.currency.includes('INR') || workspace.currency === 'INR' ? 'INR' : 'USD',
        issueDate: issue,
        dueDate: due,
        paidDate: isPaid ? (item.paidDate || todayStr) : undefined,
        status,
        daysOverdue,
        collectionHealth,
        healthCategory,
        healthReasons,
        collectionCategory: status === 'disputed' ? 'DISPUTERS' : status === 'promised' ? 'PROMISERS' : 'ACTIVE',
        remindersSent: item.remindersSent || 0,
        customerRepliesCount: item.customerRepliesCount || 0,
        paymentPromisesCount: item.paymentPromisesCount || 0,
        missedPromisesCount: item.missedPromisesCount || 0,
        lastContactDate: item.lastContactDate || issue,
        nextAction: isPaid ? 'Payment verified. No chasing needed.' : daysOverdue > 0 ? `Follow up on overdue balance` : `Scheduled due date reminder on ${due}`,
        whyUnpaidReason: {
          likelyReason: isPaid ? 'Settled in full' : status === 'partially_paid' ? `Partial payment received (${currencySymbol}${paidAmt.toLocaleString()})` : daysOverdue > 0 ? `Overdue by ${daysOverdue} days since ${due}` : `Within terms, due on ${due}`,
          evidence: `Imported from ${fileName} (Source Row: ${item.sourceRowNumber || idx + 2})`,
          confidence: 90,
          recommendedAction: isPaid ? 'Close collection' : `Target outstanding balance of ${currencySymbol}${outstanding.toLocaleString()}`,
        },
        aiRecommendation: {
          actionType: isPaid ? 'wait_for_promise' : daysOverdue > 30 ? 'escalate' : 'followup',
          title: isPaid ? 'Settled' : `Follow-up for ${num}`,
          description: `Imported record for ${custName} (${currencySymbol}${outstanding.toLocaleString()} outstanding).`,
          suggestedMessage: {
            subject: `Payment Follow-up: Invoice ${num}`,
            body: `Hi ${custName.split(' ')[0]},\n\nFollowing up on invoice ${num} for ${currencySymbol}${outstanding.toLocaleString()} due on ${due}.\n\nBest regards,\n${workspace.businessName}`,
            rationale: `Direct follow-up based on exact imported file record.`,
          },
        },
        timeline: [
          {
            id: `evt-imp-${Date.now()}-${idx}`,
            invoiceId,
            timestamp: new Date().toISOString(),
            type: 'invoice_created',
            title: `Invoice Imported (${fileName})`,
            description: `Imported from ${fileName} (Row #${item.sourceRowNumber || idx + 2}, Batch: ${batchId})`,
            actor: 'user',
          },
        ],
      };

      processedInvoices.push(newInvoice);
    });

    // Merge with existing state based on duplicate policy
    setInvoices((prev) => {
      const combined: Invoice[] = [];
      const numMap = new Set<string>();

      // Put newly imported first
      processedInvoices.forEach((inv) => {
        combined.push(inv);
        numMap.add(inv.invoiceNumber.toLowerCase().trim());
      });

      // Keep previous that weren't overwritten
      prev.forEach((inv) => {
        if (!numMap.has(inv.invoiceNumber.toLowerCase().trim())) {
          combined.push(inv);
        } else if (duplicatePolicy === 'skip') {
          // If skip, keep original
          const idx = combined.findIndex((c) => c.invoiceNumber.toLowerCase().trim() === inv.invoiceNumber.toLowerCase().trim());
          if (idx !== -1) combined[idx] = inv;
        }
      });

      // Re-derive Customers dynamically from active invoices
      const customerMap = new Map<string, {
        id: string;
        name: string;
        company: string;
        email: string;
        invoiced: number;
        paid: number;
        outstanding: number;
        overdueCount: number;
        totalDelay: number;
        overdueItemsCount: number;
      }>();

      combined.forEach((inv) => {
        const key = inv.customerName.trim();
        const existing = customerMap.get(key) || {
          id: inv.customerId,
          name: inv.customerName,
          company: inv.customerName,
          email: inv.customerEmail,
          invoiced: 0,
          paid: 0,
          outstanding: 0,
          overdueCount: 0,
          totalDelay: 0,
          overdueItemsCount: 0,
        };

        existing.invoiced += inv.amount;
        existing.paid += inv.paidAmount || (inv.status === 'paid' ? inv.amount : 0);
        existing.outstanding += inv.outstandingAmount !== undefined ? inv.outstandingAmount : (inv.status === 'paid' ? 0 : inv.amount);
        if (inv.daysOverdue > 0 && inv.status !== 'paid') {
          existing.overdueCount += 1;
          existing.totalDelay += inv.daysOverdue;
          existing.overdueItemsCount += 1;
        }

        customerMap.set(key, existing);
      });

      const updatedCustomers: Customer[] = Array.from(customerMap.values()).map((c) => {
        const avgDelay = c.overdueItemsCount > 0 ? Math.round(c.totalDelay / c.overdueItemsCount) : 0;
        return {
          id: c.id,
          name: c.name,
          company: c.company,
          email: c.email,
          totalInvoiced: c.invoiced,
          totalPaid: c.paid,
          outstanding: c.outstanding,
          avgPaymentDelayDays: avgDelay,
          overdueInvoicesCount: c.overdueCount,
          remindersSentCount: 0,
          paymentPromisesCount: 0,
          missedPromisesCount: 0,
          status: avgDelay > 30 ? 'high_risk' : 'active',
          firstInvoicedDate: todayStr,
          paymentPersonality: avgDelay <= 7 ? 'Prompt payer' : avgDelay > 25 ? 'Chronic delay account' : 'Standard payer',
          typicalBlocker: avgDelay > 15 ? 'Internal approval delay' : undefined,
          preferredChannel: 'Email',
          promiseReliability: 100,
        };
      });

      setCustomers(updatedCustomers);

      // Invoices and customers state updated; reportSummary automatically re-derives via useMemo

      accountService.importInvoices(workspace.id, combined);
      accountService.upsertCustomers(workspace.id, updatedCustomers);
      return combined;
    });

    showToast(`Successfully imported ${processedInvoices.length} verified invoice records!`, 'success');
  };

  const handleResumeAllCollections = () => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.status === 'overdue') {
          return {
            ...inv,
            status: 'chasing',
            remindersSent: inv.remindersSent + 1,
            nextAction: 'Automated follow-up in progress',
            timeline: [
              {
                id: `evt-${Date.now()}-${Math.random()}`,
                invoiceId: inv.id,
                timestamp: new Date().toISOString(),
                type: 'reminder_sent',
                title: 'AI Chasing Activated',
                description: 'Resumed collection conversation via AI follow-up engine.',
                badge: 'Automated',
                actor: 'ai',
              },
              ...inv.timeline,
            ],
          };
        }
        return inv;
      })
    );
    showToast('Activated AI Chasing for all recommended overdue collections!', 'success');
  };

  const handleResumeInvoiceCollection = (invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            status: 'chasing',
            remindersSent: inv.remindersSent + 1,
            nextAction: 'Automated follow-up in progress',
            timeline: [
              {
                id: `evt-${Date.now()}`,
                invoiceId: inv.id,
                timestamp: new Date().toISOString(),
                type: 'reminder_sent',
                title: 'AI Collection Resumed',
                description: 'Personalized follow-up message queued and sent.',
                actor: 'ai',
              },
              ...inv.timeline,
            ],
          };
        }
        return inv;
      })
    );
    showToast('Collection resumed for invoice!', 'success');
  };

  // Full / Partial Payment Recording
  const handleRecordPayment = (invoiceId: string, paymentAmt: number, isFull: boolean = false) => {
    let recordedAmt = 0;
    let newOutstanding = 0;
    let isFullySettled = false;
    let targetCustId = '';

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          targetCustId = inv.customerId;
          const prevPaid = inv.paidAmount || 0;
          recordedAmt = isFull ? (inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount - prevPaid) : paymentAmt;
          const totalPaid = prevPaid + recordedAmt;
          newOutstanding = Math.max(0, inv.amount - totalPaid);
          isFullySettled = newOutstanding <= 0;

          const updatedTimeline = [
            {
              id: `evt-pmt-${Date.now()}`,
              invoiceId: inv.id,
              timestamp: new Date().toISOString(),
              type: (isFullySettled ? 'payment_received' : 'partial_payment_received') as any,
              title: isFullySettled ? 'Payment Confirmed & Verified ✅' : `Partial Payment of ${inv.currency} ${recordedAmt.toLocaleString()} Received`,
              description: isFullySettled
                ? `Full invoice balance of ${inv.currency} ${inv.amount.toLocaleString()} settled. Chasing stopped.`
                : `Received ${inv.currency} ${recordedAmt.toLocaleString()}. Remaining balance: ${inv.currency} ${newOutstanding.toLocaleString()}.`,
              badge: isFullySettled ? 'PAID IN FULL' : `PARTIAL (${inv.currency} ${recordedAmt.toLocaleString()})`,
              actor: 'user' as const,
            },
            ...inv.timeline,
          ];

          return {
            ...inv,
            paidAmount: totalPaid,
            outstandingAmount: newOutstanding,
            status: isFullySettled ? 'paid' : 'partially_paid',
            paidDate: isFullySettled ? new Date().toISOString().split('T')[0] : inv.paidDate,
            paymentClaimStatus: 'VERIFIED',
            collectionHealth: isFullySettled ? 100 : 70,
            healthCategory: isFullySettled ? 'low_risk' : 'medium_risk',
            nextAction: isFullySettled ? 'Payment verified. Collection closed.' : `Chase remaining ${inv.currency} ${newOutstanding.toLocaleString()}`,
            timeline: updatedTimeline,
          };
        }
        return inv;
      })
    );

    // Update Customer Totals
    if (targetCustId && recordedAmt > 0) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === targetCustId) {
            return {
              ...c,
              totalPaid: c.totalPaid + recordedAmt,
              outstanding: Math.max(0, c.outstanding - recordedAmt),
              overdueInvoicesCount: isFullySettled ? Math.max(0, c.overdueInvoicesCount - 1) : c.overdueInvoicesCount,
            };
          }
          return c;
        })
      );
    }

    // Fulfill active promises related to this invoice ONLY if payment satisfies promised amount or settles invoice
    let newlyFulfilledPromisesCount = 0;
    setPromises((prev) =>
      prev.map((p) => {
        if (p.invoiceId === invoiceId && (p.status === 'ACTIVE' || p.status === 'pending')) {
          if (isFullySettled || recordedAmt >= p.amount) {
            newlyFulfilledPromisesCount++;
            return {
              ...p,
              status: 'FULFILLED',
            };
          }
        }
        return p;
      })
    );

    // Financial Report Summary is automatically derived via useMemo from invoices and promises (REP-001)

    showToast(
      isFullySettled
        ? `Payment verified in full! Collection stopped.`
        : `Partial payment of ${workspace.currency.split(' ')[0]} ${recordedAmt.toLocaleString()} recorded. Remaining balance: ${workspace.currency.split(' ')[0]} ${newOutstanding.toLocaleString()}.`,
      'success'
    );
  };

  const handleMarkAsPaid = (invoiceId: string, paidAmount?: number) => {
    handleRecordPayment(invoiceId, paidAmount || 0, !paidAmount);
  };

  // Payment Claim by Customer (Unverified) (CLM-001)
  const handleClaimPayment = async (invoiceId: string, claimedAmount: number, note?: string) => {
    if (claimedAmount <= 0) {
      showToast('Claimed amount must be greater than zero.', 'error');
      return;
    }

    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;

    const outstanding = inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount;
    if (claimedAmount > outstanding) {
      showToast(`Claimed amount cannot exceed outstanding balance of ${inv.currency} ${outstanding.toLocaleString()}`, 'error');
      return;
    }

    const claimNote = note || `Customer reported payment transfer of ${inv.currency} ${claimedAmount.toLocaleString()}`;

    // 1. Authenticated Persistence
    if (isUuid(workspace.id) && workspace.id !== 'ws-default') {
      const res = await accountService.recordPaymentClaim(workspace.id, invoiceId, claimedAmount, claimNote);
      if (!res.success) {
        showToast(res.error || 'Failed to persist customer payment claim.', 'error');
        return;
      }
    }

    // 2. State update: Leaves financial balances completely untouched!
    setInvoices((prev) =>
      prev.map((i) => {
        if (i.id === invoiceId) {
          return {
            ...i,
            paymentClaimStatus: 'CLAIMED',
            paymentClaimNote: claimNote,
            paymentClaimedAt: new Date().toISOString().split('T')[0],
            nextAction: 'Verify payment receipt against bank account',
            timeline: [
              {
                id: `evt-claim-${Date.now()}`,
                invoiceId: i.id,
                timestamp: new Date().toISOString(),
                type: 'payment_claimed',
                title: 'Payment Claimed by Customer ⚠️',
                description: claimNote,
                badge: 'PAYMENT CLAIMED (UNVERIFIED)',
                actor: 'customer',
              },
              ...i.timeline,
            ],
          };
        }
        return i;
      })
    );

    showToast('Customer payment claim logged. Flagged for verification.', 'info');
  };

  // Verification or Rejection of Claimed Payment (CLM-001, CLM-002)
  const handleVerifyClaimedPayment = async (invoiceId: string, isVerified: boolean) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;

    // Defect CLM-002: Reject verification when no pending claim exists!
    if (inv.paymentClaimStatus !== 'CLAIMED') {
      showToast('No pending payment claim found for this invoice. Verification cannot proceed without an active claim.', 'error');
      return;
    }

    if (isUuid(workspace.id) && workspace.id !== 'ws-default') {
      const res = await accountService.verifyPaymentClaim(workspace.id, invoiceId, isVerified);
      if (!res.success) {
        showToast(res.error || 'Failed to verify payment claim in database.', 'error');
        return;
      }
      if (isVerified && res.data) {
        const claimAmount =
          res.data.claimAmount !== undefined ? res.data.claimAmount : res.data.amountPaid - (inv.paidAmount || 0);
        handleRecordPayment(
          invoiceId,
          claimAmount > 0 ? claimAmount : inv.outstandingAmount || inv.amount,
          res.data.status === 'paid'
        );
        return;
      }
    }

    if (isVerified) {
      handleRecordPayment(invoiceId, 0, true);
    } else {
      setInvoices((prev) =>
        prev.map((i) => {
          if (i.id === invoiceId) {
            return {
              ...i,
              paymentClaimStatus: 'REJECTED',
              nextAction: 'Payment claim unconfirmed in bank. Follow-up resumed.',
              timeline: [
                {
                  id: `evt-rej-${Date.now()}`,
                  invoiceId: i.id,
                  timestamp: new Date().toISOString(),
                  type: 'escalation_triggered',
                  title: 'Payment Claim Rejected ❌',
                  description: 'Payment claim could not be verified in bank ledger. Collection resumed.',
                  badge: 'CLAIM REJECTED',
                  actor: 'user',
                },
                ...i.timeline,
              ],
            };
          }
          return i;
        })
      );
      showToast('Payment claim unverified. Collection resumed.', 'error');
    }
  };

  // AI Decision Lifecycle Handlers (DEC-001, DEC-002)
  const handleApproveDecision = async (decisionId: string) => {
    const targetDec = decisions.find((d) => d.id === decisionId || d.invoiceId === decisionId);
    if (!targetDec) return;

    if (targetDec.status === 'APPROVED') {
      showToast('Decision is already approved.', 'info');
      return;
    }

    // 1. Preview / Demo Mode
    if (workspace.id === 'ws-default' || !isUuid(workspace.id)) {
      setDecisionOverrides((prev) => ({
        ...prev,
        [decisionId]: { status: 'APPROVED' },
        [targetDec.id]: { status: 'APPROVED' },
        [targetDec.invoiceId]: { status: 'APPROVED' },
      }));
      showToast('Preview mode: Decision approved locally (sign in to persist to database).', 'info');
      return;
    }

    // 2. Authenticated Persistence
    const res = await accountService.saveDecisionStatus(workspace.id, decisionId, 'APPROVED');
    if (!res.success) {
      showToast(res.error || 'Failed to persist decision approval to database.', 'error');
      return;
    }

    setDecisionOverrides((prev) => ({
      ...prev,
      [decisionId]: { status: 'APPROVED' },
      [targetDec.id]: { status: 'APPROVED' },
      [targetDec.invoiceId]: { status: 'APPROVED' },
    }));
    showToast('AI Decision approved and persisted to database!', 'success');
  };

  const handleExecuteDecision = async (decisionId: string) => {
    const targetDec = decisions.find((d) => d.id === decisionId || d.invoiceId === decisionId);
    if (!targetDec) return;

    if (targetDec.status === 'EXECUTED') {
      showToast('Decision has already been executed.', 'info');
      return;
    }

    const targetInvoice = invoices.find((i) => i.id === targetDec.invoiceId);
    if (!targetInvoice) return;

    const isPaid = targetInvoice.status === 'paid' || (targetInvoice.outstandingAmount !== undefined ? targetInvoice.outstandingAmount <= 0 : false);
    const isDisputed = targetInvoice.status === 'disputed';
    const isHeld = (targetInvoice.status as string) === 'held' || (targetInvoice.status as string) === 'on_hold';
    const hasClaimPending = targetInvoice.paymentClaimStatus === 'CLAIMED';
    const isCustomerContact = targetDec.action === 'FOLLOW_UP' || targetDec.action === 'NUDGE' || targetDec.action === 'ESCALATE';

    // Invariant: Unverified payment claim blocks customer contact decisions (DEC-002)
    if (hasClaimPending && isCustomerContact) {
      showToast(`Invoice ${targetInvoice.invoiceNumber} has an unverified payment claim awaiting verification. Customer-contact action "${targetDec.action}" is blocked.`, 'error');
      return;
    }

    // Invariant: Settled invoices cannot execute automated chasing
    if (isPaid && targetDec.action !== 'STOP') {
      showToast(`Invoice ${targetInvoice.invoiceNumber} is already settled. Chasing action cannot be executed.`, 'error');
      return;
    }

    // Invariant: Disputed invoices cannot execute automatic contact
    if (isDisputed && isCustomerContact) {
      showToast(`Invoice ${targetInvoice.invoiceNumber} is disputed. Reminders are blocked until dispute is resolved.`, 'error');
      return;
    }

    // Invariant: Held invoices cannot execute automated outreach
    if (isHeld && isCustomerContact) {
      showToast(`Invoice ${targetInvoice.invoiceNumber} is currently on hold. Customer-contact actions are blocked.`, 'error');
      return;
    }

    // 1. Preview / Demo Mode
    if (workspace.id === 'ws-default' || !isUuid(workspace.id)) {
      const nowStr = new Date().toISOString();
      const todayStr = nowStr.split('T')[0];

      let newStatus = targetInvoice.status;
      let newNextAction = targetInvoice.nextAction;
      let eventTitle = `AI Action Executed: ${targetDec.action}`;
      let eventBadge = `${targetDec.action}`;

      if (targetDec.action === 'STOP') {
        newNextAction = 'Chasing stopped. Account settled.';
        eventBadge = 'STOPPED';
      } else if (targetDec.action === 'ESCALATE') {
        newStatus = 'escalated';
        newNextAction = 'Escalated to human review / direct phone call';
        eventTitle = 'AI Decision Executed: Escalated to Human Review';
        eventBadge = 'ESCALATED';
      } else if (targetDec.action === 'FOLLOW_UP' || targetDec.action === 'NUDGE') {
        newStatus = 'chasing';
        newNextAction = 'Awaiting customer response / payment promise';
        eventBadge = 'AI Chasing';
      }

      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id === targetDec.invoiceId) {
            return {
              ...inv,
              status: newStatus,
              remindersSent: inv.remindersSent + (targetDec.action === 'FOLLOW_UP' || targetDec.action === 'NUDGE' ? 1 : 0),
              lastContactDate: todayStr,
              nextAction: newNextAction,
              timeline: [
                {
                  id: `evt-dec-exec-${Date.now()}`,
                  invoiceId: inv.id,
                  timestamp: nowStr,
                  type: 'decision_executed',
                  title: eventTitle,
                  description: targetDec.suggestedMessage?.body || targetDec.reason,
                  badge: eventBadge,
                  actor: 'ai',
                },
                ...inv.timeline,
              ],
            };
          }
          return inv;
        })
      );

      setDecisionOverrides((prev) => ({
        ...prev,
        [decisionId]: { status: 'EXECUTED', executedAt: todayStr },
        [targetDec.id]: { status: 'EXECUTED', executedAt: todayStr },
        [targetDec.invoiceId]: { status: 'EXECUTED', executedAt: todayStr },
      }));

      showToast(`Preview mode: Decision executed locally (${targetDec.action}).`, 'success');
      return;
    }

    // 2. Authenticated Persistence
    const dbRecord = persistedDbDecisions[targetDec.invoiceId] || persistedDbDecisions[decisionId];
    const realDbDecisionId = (dbRecord && isUuid(dbRecord.id)) ? dbRecord.id : (isUuid(decisionId) ? decisionId : targetDec.id);

    const res = await accountService.executeDecision(workspace.id, realDbDecisionId);
    if (!res.success) {
      showToast(res.error || 'Failed to execute decision in database.', 'error');
      return;
    }

    const updates = res.data?.invoiceUpdates || {};
    const nowStr = new Date().toISOString();
    const todayStr = nowStr.split('T')[0];

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === targetDec.invoiceId) {
          return {
            ...inv,
            status: updates.status || inv.status,
            remindersSent: updates.reminders_sent !== undefined ? updates.reminders_sent : inv.remindersSent,
            lastContactDate: updates.last_contact_date || inv.lastContactDate,
            nextAction: updates.next_action || inv.nextAction,
            timeline: [
              {
                id: `evt-exec-${Date.now()}`,
                invoiceId: inv.id,
                timestamp: nowStr,
                type: 'decision_executed',
                title: res.data?.eventTitle || `AI Action Executed: ${targetDec.action}`,
                description: targetDec.suggestedMessage?.body || targetDec.reason,
                badge: `${targetDec.action}`,
                actor: 'ai',
              },
              ...inv.timeline,
            ],
          };
        }
        return inv;
      })
    );

    setDecisionOverrides((prev) => ({
      ...prev,
      [decisionId]: { status: 'EXECUTED', executedAt: todayStr },
      [targetDec.id]: { status: 'EXECUTED', executedAt: todayStr },
      [targetDec.invoiceId]: { status: 'EXECUTED', executedAt: todayStr },
    }));

    showToast(`AI Decision executed and persisted to database! (${targetDec.action})`, 'success');
  };

  const handleDismissDecision = async (decisionId: string) => {
    const targetDec = decisions.find((d) => d.id === decisionId || d.invoiceId === decisionId);
    if (!targetDec) return;

    if (targetDec.status === 'DISMISSED') {
      showToast('Decision is already dismissed.', 'info');
      return;
    }

    // 1. Preview / Demo Mode
    if (workspace.id === 'ws-default' || !isUuid(workspace.id)) {
      setDecisionOverrides((prev) => ({
        ...prev,
        [decisionId]: { status: 'DISMISSED' },
        [targetDec.id]: { status: 'DISMISSED' },
        [targetDec.invoiceId]: { status: 'DISMISSED' },
      }));
      showToast('Preview mode: Decision dismissed locally (sign in to persist to database).', 'info');
      return;
    }

    // 2. Authenticated Persistence
    const res = await accountService.saveDecisionStatus(workspace.id, decisionId, 'DISMISSED');
    if (!res.success) {
      showToast(res.error || 'Failed to persist decision dismissal to database.', 'error');
      return;
    }

    setDecisionOverrides((prev) => ({
      ...prev,
      [decisionId]: { status: 'DISMISSED' },
      [targetDec.id]: { status: 'DISMISSED' },
      [targetDec.invoiceId]: { status: 'DISMISSED' },
    }));
    showToast('AI Decision dismissed and persisted to database.', 'info');
  };

  // Create Promise
  const [isSubmittingPromise, setIsSubmittingPromise] = useState(false);

  const handleCreatePromise = async (
    invoiceId: string,
    amount: number,
    promisedDate: string,
    quoteText: string
  ) => {
    if (isSubmittingPromise) return;

    const targetInv = invoices.find((i) => i.id === invoiceId);
    if (!targetInv) return;

    // Duplicate submission check
    const duplicate = promises.find(
      (p) =>
        p.invoiceId === invoiceId &&
        p.promisedDate === promisedDate &&
        (p.status === 'ACTIVE' || p.status === 'pending')
    );
    if (duplicate) {
      showToast('An active payment promise for this invoice on this date already exists.', 'error');
      return;
    }

    setIsSubmittingPromise(true);

    try {
      // 1. Preview / Demo Mode
      if (workspace.id === 'ws-default' || !isUuid(workspace.id)) {
        const newPromise: PaymentPromise = {
          id: `prom-${Date.now()}`,
          invoiceId: targetInv.id,
          invoiceNumber: targetInv.invoiceNumber,
          customerId: targetInv.customerId,
          customerName: targetInv.customerName,
          amount,
          currency: targetInv.currency,
          promisedDate,
          detectedAt: new Date().toISOString(),
          quoteText,
          status: 'ACTIVE',
          promiseType: amount < targetInv.amount ? 'PARTIAL' : 'FULL',
          confidence: 90,
        };

        setPromises((prev) => [newPromise, ...prev]);

        setInvoices((prev) =>
          prev.map((inv) => {
            if (inv.id === invoiceId) {
              return {
                ...inv,
                status: 'promised',
                promisedPaymentDate: promisedDate,
                paymentPromisesCount: inv.paymentPromisesCount + 1,
                collectionCategory: 'PROMISERS',
                nextAction: `Wait for committed payment on ${promisedDate}`,
                timeline: [
                  {
                    id: `evt-prom-${Date.now()}`,
                    invoiceId: inv.id,
                    timestamp: new Date().toISOString(),
                    type: 'promise_detected',
                    title: 'Payment Promise Recorded',
                    description: `Customer committed ${inv.currency} ${amount.toLocaleString()} by ${promisedDate}. Quote: "${quoteText}"`,
                    badge: `Promised: ${promisedDate}`,
                    actor: 'ai',
                  },
                  ...inv.timeline,
                ],
              };
            }
            return inv;
          })
        );

        showToast(`Preview mode: Payment promise recorded locally for ${promisedDate} (sign in to persist).`, 'info');
        return;
      }

      // 2. Authenticated Persistence
      const res = await accountService.createPromise(workspace.id, {
        invoiceId: targetInv.id,
        customerId: targetInv.customerId,
        amount,
        promisedDate,
        quoteText,
      });

      if (!res.success || !res.data) {
        showToast(res.error || 'Failed to save payment promise to database.', 'error');
        return;
      }

      // 3. UI state updates only after successful DB write
      setPromises((prev) => [res.data!, ...prev]);

      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id === invoiceId) {
            return {
              ...inv,
              status: 'promised',
              promisedPaymentDate: promisedDate,
              paymentPromisesCount: inv.paymentPromisesCount + 1,
              collectionCategory: 'PROMISERS',
              nextAction: `Wait for committed payment on ${promisedDate}`,
              timeline: [
                {
                  id: `evt-prom-${Date.now()}`,
                  invoiceId: inv.id,
                  timestamp: new Date().toISOString(),
                  type: 'promise_detected',
                  title: 'Payment Promise Recorded',
                  description: `Customer committed ${inv.currency} ${amount.toLocaleString()} by ${promisedDate}. Quote: "${quoteText}"`,
                  badge: `Promised: ${promisedDate}`,
                  actor: 'ai',
                },
                ...inv.timeline,
              ],
            };
          }
          return inv;
        })
      );

      showToast(`Payment promise recorded and saved to database for ${promisedDate}!`, 'success');
    } finally {
      setIsSubmittingPromise(false);
    }
  };

  const handleEscalateInvoice = (invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            status: 'escalated',
            nextAction: 'Human intervention / direct call required',
            timeline: [
              {
                id: `evt-esc-${Date.now()}`,
                invoiceId: inv.id,
                timestamp: new Date().toISOString(),
                type: 'escalation_triggered',
                title: 'Escalated to Human Attention 🚨',
                description: 'Flagged for direct phone call or executive intervention.',
                badge: 'Human Action Required',
                actor: 'user',
              },
              ...inv.timeline,
            ],
          };
        }
        return inv;
      })
    );
    showToast('Invoice escalated to Human Attention!', 'info');
  };

  const handleSendAiMessage = (invoiceId: string, updatedSubject?: string, updatedBody?: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            status: 'chasing',
            remindersSent: inv.remindersSent + 1,
            lastContactDate: new Date().toISOString().split('T')[0],
            nextAction: 'Awaiting customer response / payment promise',
            timeline: [
              {
                id: `evt-msg-${Date.now()}`,
                invoiceId: inv.id,
                timestamp: new Date().toISOString(),
                type: 'reminder_sent',
                title: updatedSubject || 'AI Follow-up Email Sent',
                description: updatedBody || inv.aiRecommendation.suggestedMessage.body,
                badge: 'Sent via Email',
                actor: 'ai',
              },
              ...inv.timeline,
            ],
          };
        }
        return inv;
      })
    );
    setReviewMessageInvoice(null);
    showToast('Follow-up message successfully dispatched to customer!', 'success');
  };

  const handleUpdateAutomationRules = (newRules: Partial<AutomationRules>) => {
    setAutomationRules((prev) => {
      const updated = { ...prev, ...newRules };
      accountService.saveAutomationRules(workspace.id, updated);
      return updated;
    });
    showToast('Automation & Follow-up rules updated!', 'success');
  };

  return (
    <AppContext.Provider
      value={{
        user,
        session,
        signOut,
        workspace,
        setWorkspace,
        activeScreen,
        setActiveScreen,
        invoices,
        customers,
        promises,
        decisions,
        automationRules,
        setAutomationRules,
        reportSummary,
        selectedInvoice,
        setSelectedInvoice,
        selectedCustomer,
        setSelectedCustomer,
        reviewMessageInvoice,
        setReviewMessageInvoice,
        activeCollectionFilter,
        setActiveCollectionFilter,
        activeInvoiceFilter,
        setActiveInvoiceFilter,
        searchQuery,
        setSearchQuery,
        isLoading,
        handleImportData,
        handleResumeAllCollections,
        handleResumeInvoiceCollection,
        handleMarkAsPaid,
        handleRecordPayment,
        handleClaimPayment,
        handleVerifyClaimedPayment,
        handleApproveDecision,
        handleExecuteDecision,
        handleDismissDecision,
        handleCreatePromise,
        handleEscalateInvoice,
        handleSendAiMessage,
        handleUpdateAutomationRules,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
