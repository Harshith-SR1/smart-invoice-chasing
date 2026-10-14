import { createClient } from '../lib/supabase/client';
import { Customer, Invoice, InvoiceEvent, PaymentPromise, Workspace, AutomationRules, AiDecision } from '../types';
import { initialCustomers, initialInvoices, initialPaymentPromises, initialWorkspace, defaultAutomationRules } from '../lib/mockData';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (val?: string | null): boolean => Boolean(val && typeof val === 'string' && UUID_REGEX.test(val));

export class AccountService {
  private static instance: AccountService;
  private supabase = createClient();

  public static getInstance(): AccountService {
    if (!AccountService.instance) {
      AccountService.instance = new AccountService();
    }
    return AccountService.instance;
  }

  // Load User Workspace
  async fetchWorkspace(userId?: string): Promise<Workspace> {
    try {
      let query = this.supabase.from('workspaces').select('*');
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query.limit(1).maybeSingle();

      if (error || !data) {
        return initialWorkspace;
      }

      return {
        id: data.id,
        businessName: data.business_name || 'Apex Creative Media & Tech Solutions',
        businessType: data.business_type || 'Agency',
        country: data.country || 'India',
        currency: data.currency || 'INR (₹)',
        businessEmail: data.business_email || 'finance@apexcreative.io',
        createdAt: data.created_at || new Date().toISOString(),
      };
    } catch {
      return initialWorkspace;
    }
  }

  // Fetch Invoices
  async fetchInvoices(workspaceId?: string): Promise<Invoice[]> {
    try {
      let query = this.supabase.from('invoices').select('*, collection_events(*)');
      if (workspaceId && workspaceId !== 'ws-default') {
        query = query.eq('workspace_id', workspaceId);
      }
      const { data, error } = await query.order('due_date', { ascending: true });

      const isRealWorkspace = Boolean(workspaceId && workspaceId !== 'ws-default');

      if (error || !data || data.length === 0) {
        return isRealWorkspace ? [] : initialInvoices;
      }

      return data.map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        customerId: inv.customer_id || 'cust-1',
        customerName: inv.customer_name,
        customerEmail: inv.customer_email,
        amount: Number(inv.amount),
        outstandingAmount: inv.outstanding_amount !== undefined && inv.outstanding_amount !== null ? Number(inv.outstanding_amount) : Number(inv.amount),
        paidAmount: inv.amount_paid !== undefined && inv.amount_paid !== null ? Number(inv.amount_paid) : (inv.status === 'paid' ? Number(inv.amount) : 0),
        currency: inv.currency || 'INR',
        issueDate: inv.issue_date,
        dueDate: inv.due_date,
        paidDate: inv.paid_date,
        status: inv.status,
        daysOverdue: inv.days_overdue || 0,
        collectionHealth: inv.collection_health || 50,
        healthCategory: inv.health_category || 'medium_risk',
        healthReasons: inv.health_reasons || [],
        remindersSent: inv.reminders_sent || 0,
        customerRepliesCount: inv.customer_replies_count || 0,
        paymentPromisesCount: inv.payment_promises_count || 0,
        missedPromisesCount: inv.missed_promises_count || 0,
        lastContactDate: inv.last_contact_date || inv.issue_date,
        lastCustomerReply: inv.last_customer_reply,
        promisedPaymentDate: inv.promised_payment_date,
        nextAction: inv.next_action || 'AI Chasing',
        aiRecommendation: inv.ai_recommendation || {
          actionType: 'followup',
          title: 'Automated AI Follow-up',
          description: 'Send payment reminder email',
          suggestedMessage: {
            subject: `Payment Follow-up: ${inv.invoice_number}`,
            body: `Dear ${inv.customer_name},\n\nPayment for invoice ${inv.invoice_number} is pending.`,
            rationale: 'Schedule reminder based on cadence settings.',
          },
        },
        timeline: (inv.collection_events || []).map((evt: any) => ({
          id: evt.id,
          invoiceId: evt.invoice_id,
          timestamp: evt.timestamp,
          type: evt.type,
          title: evt.title,
          description: evt.description,
          badge: evt.badge,
          actor: evt.actor,
          metadata: evt.metadata,
        })),
      }));
    } catch {
      return (workspaceId && workspaceId !== 'ws-default') ? [] : initialInvoices;
    }
  }

  // Fetch Customers
  async fetchCustomers(workspaceId?: string): Promise<Customer[]> {
    try {
      let query = this.supabase.from('customers').select('*');
      if (workspaceId && workspaceId !== 'ws-default') {
        query = query.eq('workspace_id', workspaceId);
      }
      const { data, error } = await query;
      const isRealWorkspace = Boolean(workspaceId && workspaceId !== 'ws-default');

      if (error || !data || data.length === 0) {
        return isRealWorkspace ? [] : initialCustomers;
      }

      return data.map((c: any) => ({
        id: c.id,
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone,
        totalInvoiced: Number(c.total_invoiced || 0),
        totalPaid: Number(c.total_paid || 0),
        outstanding: Number(c.outstanding || 0),
        avgPaymentDelayDays: c.avg_payment_delay_days || 0,
        overdueInvoicesCount: c.overdue_invoices_count || 0,
        remindersSentCount: c.reminders_sent_count || 0,
        paymentPromisesCount: c.payment_promises_count || 0,
        missedPromisesCount: c.missed_promises_count || 0,
        status: c.status || 'active',
        firstInvoicedDate: c.first_invoiced_date || '2026-01-01',
      }));
    } catch {
      return (workspaceId && workspaceId !== 'ws-default') ? [] : initialCustomers;
    }
  }

  // Fetch Payment Promises
  async fetchPromises(workspaceId?: string): Promise<PaymentPromise[]> {
    try {
      let query = this.supabase.from('payment_promises').select('*, invoices(invoice_number, customer_name)');
      if (workspaceId && workspaceId !== 'ws-default') {
        query = query.eq('workspace_id', workspaceId);
      }
      const { data, error } = await query;
      const isRealWorkspace = Boolean(workspaceId && workspaceId !== 'ws-default');

      if (error || !data || data.length === 0) {
        return isRealWorkspace ? [] : initialPaymentPromises;
      }

      return data.map((p: any) => ({
        id: p.id,
        invoiceId: p.invoice_id,
        invoiceNumber: p.invoices?.invoice_number || 'INV-101',
        customerId: p.customer_id,
        customerName: p.invoices?.customer_name || 'Customer',
        amount: Number(p.promised_amount),
        currency: 'INR',
        promisedDate: p.promised_date,
        detectedAt: p.detected_at,
        quoteText: p.quote_text,
        status: p.status === 'pending' ? 'ACTIVE' : p.status === 'fulfilled' ? 'FULFILLED' : p.status === 'missed' ? 'BROKEN' : p.status,
      }));
    } catch {
      return (workspaceId && workspaceId !== 'ws-default') ? [] : initialPaymentPromises;
    }
  }

  // Persist Payment Promise to Supabase
  async createPromise(
    workspaceId: string,
    promise: Partial<PaymentPromise>
  ): Promise<{ success: boolean; data?: PaymentPromise; error?: string; isPreview?: boolean }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return {
        success: false,
        error: 'Preview mode: Database writes are disabled for unauthenticated preview workspaces.',
        isPreview: true,
      };
    }

    if (!promise.invoiceId || !isUuid(promise.invoiceId)) {
      return { success: false, error: 'A valid invoice ID (UUID) is required.' };
    }

    const amt = Number(promise.amount);
    if (isNaN(amt) || amt <= 0) {
      return { success: false, error: 'Promised amount must be greater than zero.' };
    }

    if (!promise.promisedDate || typeof promise.promisedDate !== 'string') {
      return { success: false, error: 'A valid promised date is required.' };
    }

    const quoteText = (promise.quoteText || '').trim();
    if (!quoteText) {
      return { success: false, error: 'Customer quote text or conversation context is required.' };
    }

    try {
      // 1. Confirm invoice belongs to the authenticated workspace
      const { data: inv, error: invErr } = await this.supabase
        .from('invoices')
        .select('id, workspace_id, customer_id, customer_name, invoice_number, currency, amount, outstanding_amount, payment_promises_count')
        .eq('id', promise.invoiceId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (invErr || !inv) {
        return {
          success: false,
          error: 'Invoice not found in the current workspace or authorization denied.',
        };
      }

      // 2. Prevent duplicate active promises on same invoice and promised date
      const { data: duplicates } = await this.supabase
        .from('payment_promises')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('invoice_id', promise.invoiceId)
        .eq('promised_date', promise.promisedDate)
        .eq('status', 'pending')
        .limit(1);

      if (duplicates && duplicates.length > 0) {
        return {
          success: false,
          error: `An active payment promise for invoice ${inv.invoice_number} on ${promise.promisedDate} already exists.`,
        };
      }

      // 3. Insert into payment_promises table
      const { data: created, error: promErr } = await this.supabase
        .from('payment_promises')
        .insert({
          workspace_id: workspaceId,
          invoice_id: promise.invoiceId,
          customer_id: inv.customer_id || (isUuid(promise.customerId) ? promise.customerId : null),
          promised_amount: amt,
          promised_date: promise.promisedDate,
          quote_text: quoteText,
          status: 'pending',
        })
        .select('*, invoices(invoice_number, customer_name)')
        .single();

      if (promErr || !created) {
        return { success: false, error: promErr?.message || 'Failed to insert payment promise.' };
      }

      // 4. Update invoice status to 'promised'
      await this.supabase
        .from('invoices')
        .update({
          status: 'promised',
          promised_payment_date: promise.promisedDate,
          payment_promises_count: (inv.payment_promises_count || 0) + 1,
          next_action: `Wait for committed payment on ${promise.promisedDate}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', promise.invoiceId)
        .eq('workspace_id', workspaceId);

      // 5. Record collection timeline event
      await this.supabase.from('collection_events').insert({
        workspace_id: workspaceId,
        invoice_id: promise.invoiceId,
        type: 'promise_detected',
        title: 'Payment Promise Recorded',
        description: `Customer committed ${inv.currency || 'INR'} ${amt.toLocaleString()} by ${promise.promisedDate}. Quote: "${quoteText}"`,
        badge: `Promised: ${promise.promisedDate}`,
        actor: 'ai',
      });

      return {
        success: true,
        data: {
          id: created.id,
          invoiceId: created.invoice_id,
          invoiceNumber: created.invoices?.invoice_number || inv.invoice_number,
          customerId: created.customer_id || inv.customer_id,
          customerName: created.invoices?.customer_name || inv.customer_name,
          amount: Number(created.promised_amount),
          currency: inv.currency || 'INR',
          promisedDate: created.promised_date,
          detectedAt: created.detected_at,
          quoteText: created.quote_text,
          status: 'ACTIVE',
          promiseType: amt < Number(inv.amount) ? 'PARTIAL' : 'FULL',
          confidence: 90,
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unexpected failure persisting payment promise.' };
    }
  }

  // Fetch AI Decisions from Supabase
  async fetchDecisions(workspaceId?: string): Promise<Array<{
    id: string;
    workspaceId: string;
    invoiceId: string;
    intent: string;
    confidence: number;
    summary: string;
    recommendedAction: string;
    urgency: string;
    promisedDate?: string;
    requiresHumanReview: boolean;
    suggestedSubject?: string;
    suggestedBody?: string;
    status: 'pending' | 'approved' | 'rejected' | 'executed';
    createdAt: string;
  }>> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return [];
    }
    try {
      const { data, error } = await this.supabase
        .from('ai_decisions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((d: any) => ({
        id: d.id,
        workspaceId: d.workspace_id,
        invoiceId: d.invoice_id,
        intent: d.intent,
        confidence: Number(d.confidence || 0.95),
        summary: d.summary,
        recommendedAction: d.recommended_action,
        urgency: d.urgency,
        promisedDate: d.promised_date || undefined,
        requiresHumanReview: Boolean(d.requires_human_review),
        suggestedSubject: d.suggested_subject || undefined,
        suggestedBody: d.suggested_body || undefined,
        status: d.status,
        createdAt: d.created_at,
      }));
    } catch {
      return [];
    }
  }

  // Sync / Ensure AI Decisions exist in Supabase for active invoices
  async syncDecisions(workspaceId: string, decisions: AiDecision[]): Promise<void> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default' || !decisions || decisions.length === 0) {
      return;
    }

    try {
      const { data: existing } = await this.supabase
        .from('ai_decisions')
        .select('id, invoice_id')
        .eq('workspace_id', workspaceId);

      const existingInvoiceIds = new Set((existing || []).map((e: any) => e.invoice_id));

      const newRows = decisions
        .filter((d) => isUuid(d.invoiceId) && !existingInvoiceIds.has(d.invoiceId))
        .map((d) => {
          let dbIntent = 'OTHER';
          if (d.action === 'WAIT') dbIntent = 'PROMISE_TO_PAY';
          else if (d.action === 'HUMAN') dbIntent = 'DISPUTE';
          else if (d.action === 'ESCALATE') dbIntent = 'NO_RESPONSE';
          else if (d.action === 'STOP') dbIntent = 'PAYMENT_CLAIMED';

          return {
            workspace_id: workspaceId,
            invoice_id: d.invoiceId,
            intent: dbIntent,
            confidence: Math.min(0.99, Number((d.confidence / 100).toFixed(2))),
            summary: d.reason || 'AI recommendation',
            recommended_action: d.action,
            urgency: d.priority === 'HIGH' ? 'high' : d.priority === 'LOW' ? 'low' : 'medium',
            requires_human_review: d.action === 'HUMAN' || d.action === 'ESCALATE',
            suggested_subject: d.suggestedMessage?.subject || null,
            suggested_body: d.suggestedMessage?.body || null,
            status: 'pending',
          };
        });

      if (newRows.length > 0) {
        await this.supabase.from('ai_decisions').insert(newRows);
      }
    } catch {
      // Graceful fallback
    }
  }

  // Save Operator Lifecycle Status Override for AI Decision
  async saveDecisionStatus(
    workspaceId: string,
    decisionId: string,
    status: 'PENDING' | 'APPROVED' | 'DISMISSED' | 'EXECUTED'
  ): Promise<{ success: boolean; data?: any; error?: string; isPreview?: boolean }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return {
        success: false,
        error: 'Preview mode: changes are kept in local state only.',
        isPreview: true,
      };
    }

    if (!decisionId || !isUuid(decisionId)) {
      return { success: false, error: 'A valid decision UUID is required.' };
    }

    const dbStatusMap: Record<string, string> = {
      PENDING: 'pending',
      APPROVED: 'approved',
      DISMISSED: 'rejected',
      EXECUTED: 'executed',
    };
    const dbStatus = dbStatusMap[status];
    if (!dbStatus) {
      return { success: false, error: `Unsupported decision status "${status}".` };
    }

    try {
      // Confirm decision exists in the authenticated workspace
      const { data: existing, error: fetchErr } = await this.supabase
        .from('ai_decisions')
        .select('id, workspace_id, invoice_id, status')
        .eq('id', decisionId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (fetchErr) {
        return { success: false, error: fetchErr.message };
      }
      if (!existing) {
        return { success: false, error: 'Decision record not found in workspace or access denied.' };
      }

      // Update status in public.ai_decisions
      const { data: updated, error: updateErr } = await this.supabase
        .from('ai_decisions')
        .update({ status: dbStatus })
        .eq('id', decisionId)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      return { success: true, data: updated };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unexpected failure updating decision status.' };
    }
  }

  // Fetch Automation Rules
  async fetchAutomationRules(workspaceId?: string): Promise<AutomationRules> {
    try {
      let query = this.supabase.from('ai_settings').select('*');
      if (workspaceId && workspaceId !== 'ws-default') {
        query = query.eq('workspace_id', workspaceId);
      }
      const { data, error } = await query.limit(1).maybeSingle();

      if (error || !data) {
        return defaultAutomationRules;
      }

      return {
        enableAutoFollowup: data.enable_auto_followup ?? true,
        preDueDays: data.pre_due_days ?? 3,
        postDueScheduleDays: data.post_due_schedule_days || [3, 7, 14],
        maxReminders: data.max_reminders ?? 4,
        humanEscalationThresholdDays: data.human_escalation_threshold_days ?? 14,
        communicationTone: data.tone || 'firm',
        autoStopOnPromise: data.auto_stop_on_promise ?? true,
        sendingScheduleTime: '09:00 AM',
      };
    } catch {
      return defaultAutomationRules;
    }
  }

  // Save Automation Rules
  async saveAutomationRules(workspaceId: string, rules: Partial<AutomationRules>): Promise<void> {
    try {
      await this.supabase.from('ai_settings').upsert({
        workspace_id: workspaceId,
        enable_auto_followup: rules.enableAutoFollowup,
        pre_due_days: rules.preDueDays,
        post_due_schedule_days: rules.postDueScheduleDays,
        max_reminders: rules.maxReminders,
        human_escalation_threshold_days: rules.humanEscalationThresholdDays,
        tone: rules.communicationTone,
        auto_stop_on_promise: rules.autoStopOnPromise,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Graceful fallback to client state
    }
  }

  // Persist CSV Imported Invoices
  async importInvoices(workspaceId: string, invoices: Invoice[]): Promise<void> {
    try {
      const rows = invoices.map((inv) => ({
        workspace_id: workspaceId,
        invoice_number: inv.invoiceNumber,
        customer_name: inv.customerName,
        customer_email: inv.customerEmail,
        amount: inv.amount,
        outstanding_amount: inv.outstandingAmount !== undefined ? inv.outstandingAmount : (inv.status === 'paid' ? 0 : inv.amount),
        amount_paid: inv.paidAmount || (inv.status === 'paid' ? inv.amount : 0),
        paid_date: inv.paidDate || null,
        currency: inv.currency,
        issue_date: inv.issueDate,
        due_date: inv.dueDate,
        status: inv.status,
        days_overdue: inv.daysOverdue,
        collection_health: inv.collectionHealth,
        health_category: inv.healthCategory,
        health_reasons: inv.healthReasons,
        next_action: inv.nextAction,
        ai_recommendation: inv.aiRecommendation,
      }));

      await this.supabase.from('invoices').upsert(rows, { onConflict: 'workspace_id,invoice_number' });
    } catch {
      // Graceful fallback
    }
  }

  // Persist Customer Entities derived from Invoices
  async upsertCustomers(workspaceId: string, customers: Customer[]): Promise<void> {
    try {
      const rows = customers.map((c) => ({
        workspace_id: workspaceId,
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone || null,
        total_invoiced: c.totalInvoiced,
        total_paid: c.totalPaid,
        outstanding: c.outstanding,
        avg_payment_delay_days: c.avgPaymentDelayDays,
        overdue_invoices_count: c.overdueInvoicesCount,
        reminders_sent_count: c.remindersSentCount,
        payment_promises_count: c.paymentPromisesCount,
        missed_promises_count: c.missedPromisesCount,
        status: c.status || 'active',
        first_invoiced_date: c.firstInvoicedDate || new Date().toISOString().split('T')[0],
      }));

      await this.supabase.from('customers').upsert(rows, { onConflict: 'workspace_id,email' });
    } catch {
      // Graceful fallback
    }
  }

  // Mark Invoice Paid in DB
  async markInvoicePaid(invoiceId: string, paidAmount: number): Promise<void> {
    try {
      const { data: inv } = await this.supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (inv) {
        const newPaid = Number(inv.amount_paid || 0) + paidAmount;
        const newOutstanding = Math.max(0, Number(inv.amount) - newPaid);
        const newStatus = newOutstanding === 0 ? 'paid' : 'partially_paid';

        await this.supabase
          .from('invoices')
          .update({
            amount_paid: newPaid,
            outstanding_amount: newOutstanding,
            status: newStatus,
            paid_date: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null,
            collection_health: 100,
            health_category: 'low_risk',
            next_action: 'Payment confirmed. Chasing stopped.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);

        // Record Payment Entry
        await this.supabase.from('payments').insert({
          workspace_id: inv.workspace_id,
          invoice_id: invoiceId,
          customer_id: inv.customer_id,
          amount: paidAmount,
          source: 'manual_entry',
          status: 'confirmed',
        });

        // Record Collection Timeline Event
        await this.supabase.from('collection_events').insert({
          workspace_id: inv.workspace_id,
          invoice_id: invoiceId,
          type: 'payment_received',
          title: 'Payment Confirmed ✅',
          description: `Payment of ${inv.currency} ${paidAmount.toLocaleString()} confirmed. Automated follow-ups stopped.`,
          badge: 'PAID & RECOVERED',
          actor: 'user',
        });

        // Fulfill active payment promises if payment satisfies promised amount or settles invoice
        const { data: activePromises } = await this.supabase
          .from('payment_promises')
          .select('id, promised_amount')
          .eq('invoice_id', invoiceId)
          .eq('workspace_id', inv.workspace_id)
          .eq('status', 'pending');

        if (activePromises && activePromises.length > 0) {
          for (const prom of activePromises) {
            if (newStatus === 'paid' || paidAmount >= Number(prom.promised_amount)) {
              await this.supabase
                .from('payment_promises')
                .update({
                  status: 'fulfilled',
                  fulfilled_at: new Date().toISOString(),
                })
                .eq('id', prom.id);
            }
          }
        }
      }
    } catch {
      // Fallback handled by AppContext
    }
  }
}

export const accountService = AccountService.getInstance();
