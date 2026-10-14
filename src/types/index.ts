export type InvoiceStatus =
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'chasing'
  | 'promised'
  | 'disputed'
  | 'escalated'
  | 'draft';

export type HealthCategory = 'high_risk' | 'medium_risk' | 'low_risk';

export type DecisionAction = 'WAIT' | 'NUDGE' | 'FOLLOW_UP' | 'ESCALATE' | 'HUMAN' | 'STOP';

export type DecisionStatus = 'PENDING' | 'APPROVED' | 'EXECUTED' | 'DISMISSED' | 'EXPIRED';

export type DecisionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type DecisionTone = 'Gentle' | 'Professional' | 'Firm' | 'Final Escalation';

export type CollectionCategory = 'PROMISERS' | 'DISPUTERS' | 'GHOSTERS' | 'ACTIVE';

export type PaymentClaimStatus = 'UNCLAIMED' | 'CLAIMED' | 'VERIFIED' | 'REJECTED';

export type EventType =
  | 'invoice_created'
  | 'reminder_sent'
  | 'customer_replied'
  | 'promise_detected'
  | 'promise_missed'
  | 'promise_fulfilled'
  | 'payment_claimed'
  | 'payment_verified'
  | 'payment_received'
  | 'partial_payment_received'
  | 'followup_scheduled'
  | 'escalation_triggered'
  | 'decision_generated'
  | 'decision_executed';

export interface InvoiceEvent {
  id: string;
  invoiceId: string;
  timestamp: string;
  type: EventType;
  title: string;
  description: string;
  badge?: string;
  actor?: 'system' | 'ai' | 'customer' | 'user';
  metadata?: Record<string, unknown>;
}

export interface WhyUnpaidDiagnosis {
  likelyReason: string;
  evidence: string;
  confidence: number;
  recommendedAction: string;
}

export interface AiDecision {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  outstandingAmount: number;
  currency: string;
  action: DecisionAction;
  reason: string;
  evidence: string;
  confidence: number;
  priority: DecisionPriority;
  recommendedTiming: string;
  recommendedChannel: 'Email' | 'WhatsApp' | 'Phone';
  recommendedTone: DecisionTone;
  suggestedMessage: {
    subject: string;
    body: string;
    rationale: string;
  };
  status: DecisionStatus;
  createdAt: string;
  expiresAt?: string;
  executedAt?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  paidAmount?: number;
  outstandingAmount?: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  status: InvoiceStatus;
  paymentClaimStatus?: PaymentClaimStatus;
  paymentClaimNote?: string;
  paymentClaimedAt?: string;
  daysOverdue: number;
  collectionHealth: number; // 0 to 100
  healthCategory: HealthCategory;
  healthReasons: string[];
  collectionCategory?: CollectionCategory;
  remindersSent: number;
  customerRepliesCount: number;
  paymentPromisesCount: number;
  missedPromisesCount: number;
  lastContactDate: string;
  lastCustomerReply?: string;
  lastReplyIntent?: string;
  promisedPaymentDate?: string;
  nextAction: string;
  whyUnpaidReason?: WhyUnpaidDiagnosis;
  aiRecommendation: {
    actionType: 'resume' | 'followup' | 'escalate' | 'wait_for_promise' | 'dispute_review';
    title: string;
    description: string;
    suggestedMessage: {
      subject: string;
      body: string;
      rationale: string;
    };
  };
  timeline: InvoiceEvent[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  avgPaymentDelayDays: number;
  overdueInvoicesCount: number;
  remindersSentCount: number;
  paymentPromisesCount: number;
  missedPromisesCount: number;
  status: 'active' | 'high_risk' | 'good_standing';
  firstInvoicedDate: string;
  paymentPersonality?: string;
  typicalBlocker?: string;
  preferredChannel?: 'Email' | 'WhatsApp' | 'Phone';
  promiseReliability?: number;
  relationshipImportance?: 'HIGH' | 'MEDIUM' | 'STANDARD';
}

export interface PaymentPromise {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  promisedDate: string;
  detectedAt: string;
  quoteText: string;
  status: 'ACTIVE' | 'FULFILLED' | 'BROKEN' | 'CANCELLED' | 'UNKNOWN' | 'pending' | 'fulfilled' | 'missed';
  promiseType?: 'FULL' | 'PARTIAL' | 'CONDITIONAL';
  confidence?: number;
  blockerReason?: string;
}

export interface AutomationRules {
  enableAutoFollowup: boolean;
  preDueDays: number;
  postDueScheduleDays: number[]; // e.g. [3, 7, 14]
  maxReminders: number;
  humanEscalationThresholdDays: number;
  communicationTone: 'friendly' | 'professional' | 'firm' | 'assertive';
  autoStopOnPromise: boolean;
  sendingScheduleTime: string;
}

export interface Workspace {
  id: string;
  businessName: string;
  businessType: string;
  country: string;
  currency: string;
  businessEmail: string;
  createdAt: string;
}

export interface RecoveryReportSummary {
  month: string;
  year: number;
  totalRecovered: number;
  totalOutstanding: number;
  chasedInvoicesCount: number;
  remindersSent: number;
  repliesReceived: number;
  promisesDetected: number;
  promisesFulfilled: number;
  escalatedCount: number;
  unrecoveredAccounts: {
    invoiceId: string;
    invoiceNumber: string;
    customerName: string;
    amount: number;
    remindersCount: number;
    daysOverdue: number;
    lastResponse: string;
    recommendation: string;
  }[];
  aiExecutiveSummary: string;
}

export type ActiveScreen =
  | 'landing'
  | 'signin'
  | 'business_setup'
  | 'import_data'
  | 'ai_processing'
  | 'aha_moment'
  | 'ai_recommendations'
  | 'automation_setup'
  | 'dashboard'
  | 'collections'
  | 'invoices'
  | 'customers'
  | 'reports'
  | 'integrations'
  | 'settings'
  | 'profile'
  | 'workspace'
  | 'billing'
  | 'help'
  | 'ai-decisions'
  | 'activity'
  | 'aging'
  | 'risk';

