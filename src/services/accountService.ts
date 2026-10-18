import { createClient } from '../lib/supabase/client';
import { Customer, Invoice, InvoiceEvent, PaymentPromise, Workspace, AutomationRules, AiDecision, PaymentClaimStatus } from '../types';
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
      let query = this.supabase.from('invoices').select('*, collection_events(*), payments(*)');
      if (workspaceId && workspaceId !== 'ws-default') {
        query = query.eq('workspace_id', workspaceId);
      }
      const { data, error } = await query.order('due_date', { ascending: true });

      const isRealWorkspace = Boolean(workspaceId && workspaceId !== 'ws-default');

      if (error || !data || data.length === 0) {
        return isRealWorkspace ? [] : initialInvoices;
      }

      return data.map((inv: any) => {
        const paymentsList = inv.payments || [];
        const activeClaim = paymentsList.find(
          (p: any) => p.status === 'pending_verification' && p.source === 'customer_claim'
        );
        const paymentClaimStatus: PaymentClaimStatus = activeClaim ? 'CLAIMED' : 'UNCLAIMED';
        const paymentClaimNote = activeClaim?.reference || undefined;
        const paymentClaimedAt = activeClaim?.payment_date || undefined;

        // Authoritative verified payment totals
        const verifiedPayments = paymentsList.filter((p: any) => p.status === 'confirmed');
        const verifiedPaidSum = verifiedPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        const invPaidAmount = inv.amount_paid !== undefined && inv.amount_paid !== null ? Number(inv.amount_paid) : (inv.status === 'paid' ? Number(inv.amount) : 0);
        const authoritativePaid = Math.max(invPaidAmount, verifiedPaidSum);

        const amt = Number(inv.amount);
        const outstanding = inv.outstanding_amount !== undefined && inv.outstanding_amount !== null
          ? Number(inv.outstanding_amount)
          : Math.max(0, amt - authoritativePaid);

        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          customerId: inv.customer_id || 'cust-1',
          customerName: inv.customer_name,
          customerEmail: inv.customer_email,
          amount: amt,
          outstandingAmount: outstanding,
          paidAmount: authoritativePaid,
          currency: inv.currency || 'INR',
          issueDate: inv.issue_date,
          dueDate: inv.due_date,
          paidDate: inv.paid_date,
          status: inv.status,
          paymentClaimStatus,
          paymentClaimNote,
          paymentClaimedAt,
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
          timeline: (inv.collection_events || [])
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((evt: any) => ({
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
        };
      });
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

  // Persist Payment Claim (Unverified Customer Payment Notice - CLM-001)
  async recordPaymentClaim(
    workspaceId: string,
    invoiceId: string,
    claimedAmount: number,
    note?: string
  ): Promise<{ success: boolean; data?: any; error?: string; isPreview?: boolean }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return {
        success: false,
        error: 'Preview mode: Database writes are disabled for unauthenticated preview workspaces.',
        isPreview: true,
      };
    }

    if (!invoiceId || !isUuid(invoiceId)) {
      return { success: false, error: 'A valid invoice UUID is required.' };
    }

    const amt = Number(claimedAmount);
    if (isNaN(amt) || amt <= 0) {
      return { success: false, error: 'Claimed payment amount must be a positive number greater than zero.' };
    }

    try {
      // 1. Confirm invoice belongs to authenticated workspace
      const { data: inv, error: invErr } = await this.supabase
        .from('invoices')
        .select('id, workspace_id, customer_id, customer_name, invoice_number, currency, amount, outstanding_amount, amount_paid')
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (invErr || !inv) {
        return {
          success: false,
          error: 'Invoice not found in the authenticated workspace or authorization denied.',
        };
      }

      // 2. Prevent duplicate pending claims on same invoice
      const { data: existingClaims } = await this.supabase
        .from('payments')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('invoice_id', invoiceId)
        .eq('source', 'customer_claim')
        .eq('status', 'pending_verification')
        .limit(1);

      if (existingClaims && existingClaims.length > 0) {
        return {
          success: false,
          error: `An unverified payment claim is already pending verification for invoice ${inv.invoice_number}.`,
        };
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const claimNote = (note || '').trim() || `Customer claimed payment of ${inv.currency || 'INR'} ${amt.toLocaleString()} released. Verification pending.`;

      // 3. Insert into public.payments as pending_verification (DOES NOT touch invoice balance)
      const { data: createdPayment, error: payErr } = await this.supabase
        .from('payments')
        .insert({
          workspace_id: workspaceId,
          invoice_id: invoiceId,
          customer_id: inv.customer_id,
          amount: amt,
          payment_date: todayStr,
          reference: claimNote,
          source: 'customer_claim',
          status: 'pending_verification',
        })
        .select()
        .single();

      if (payErr || !createdPayment) {
        return { success: false, error: payErr?.message || 'Failed to record payment claim.' };
      }

      // 4. Update invoice next_action without mutating financial balances
      await this.supabase
        .from('invoices')
        .update({
          next_action: 'Verify payment receipt against bank account',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId);

      // 5. Insert collection event
      await this.supabase.from('collection_events').insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        type: 'payment_claimed',
        title: 'Payment Claimed by Customer ⚠️',
        description: claimNote,
        badge: 'CLAIMED (UNVERIFIED)',
        actor: 'customer',
        metadata: {
          claimed_amount: amt,
          payment_id: createdPayment.id,
          status: 'pending_verification',
        },
      });

      return {
        success: true,
        data: {
          id: createdPayment.id,
          invoiceId,
          amount: amt,
          note: claimNote,
          claimedAt: todayStr,
          status: 'pending_verification',
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unexpected failure persisting payment claim.' };
    }
  }

  // Verify or Reject Customer Payment Claim (CLM-001, CLM-002)
  async verifyPaymentClaim(
    workspaceId: string,
    invoiceId: string,
    isVerified: boolean
  ): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string; isPreview?: boolean }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return {
        success: false,
        error: 'Preview mode: Database writes are disabled for unauthenticated preview workspaces.',
        isPreview: true,
      };
    }

    if (!invoiceId || !isUuid(invoiceId)) {
      return { success: false, error: 'A valid invoice UUID is required.' };
    }

    if (typeof isVerified !== 'boolean') {
      return {
        success: false,
        errorCode: 'invalid_parameter',
        error: 'Parameter isVerified must be an explicit boolean (true or false).',
      };
    }

    try {
      // 1. Attempt single-transaction PostgreSQL RPC (Migration 004)
      let isMissingRpc = false;
      try {
        const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('verify_payment_claim_atomic', {
          p_workspace_id: workspaceId,
          p_invoice_id: invoiceId,
          p_is_verified: isVerified,
        });

        if (!rpcErr) {
          // Verify response is well-formed
          if (typeof rpcRes === 'object' && rpcRes !== null && typeof (rpcRes as any).success === 'boolean') {
            // Return valid RPC response directly (both success: true and business rejection success: false)
            // NEVER trigger fallback writes when RPC executed and returned a valid response!
            return rpcRes as { success: boolean; data?: any; error?: string; errorCode?: string };
          }
          // Malformed response from database procedure - fail safely!
          return {
            success: false,
            errorCode: 'malformed_rpc_response',
            error: 'Malformed response received from payment verification procedure.',
          };
        }

        // RPC returned an error:
        // Strictly restrict fallback to confirmed missing-function error codes in pre-migration environments.
        if (rpcErr.code === 'PGRST202' || rpcErr.code === '42883') {
          const isProduction = process.env.NODE_ENV === 'production';
          const isExplicitDevFallbackAllowed =
            process.env.NEXT_PUBLIC_ALLOW_INSECURE_PAYMENT_FALLBACK === 'true' ||
            process.env.NODE_ENV === 'development';

          // In production, strictly fail closed if atomic RPC is missing!
          if (isProduction && !isExplicitDevFallbackAllowed) {
            return {
              success: false,
              errorCode: 'atomic_rpc_required',
              error:
                'Payment verification requires database migration 004 (verify_payment_claim_atomic). Insecure client-side fallback is disabled in production.',
            };
          }

          isMissingRpc = true;
          console.warn(
            `[DEV-ONLY PRE-MIGRATION FALLBACK] RPC verify_payment_claim_atomic not found (code: ${rpcErr.code}). Executing client-orchestrated verification.`
          );
        } else {
          // Surface permission errors (42501), constraint violations, database deadlocks, rate limits, etc.
          // NEVER fall back to client writes on genuine database or authorization errors!
          return {
            success: false,
            errorCode: rpcErr.code || 'rpc_execution_failed',
            error: rpcErr.message || 'Payment verification procedure execution failed.',
          };
        }
      } catch (err: any) {
        // Transport/network failure or client exception calling RPC - fail safely, do NOT fall back!
        return {
          success: false,
          errorCode: 'rpc_transport_error',
          error: err?.message || 'Payment verification service communication error.',
        };
      }

      if (!isMissingRpc) {
        return {
          success: false,
          errorCode: 'rpc_unavailable',
          error: 'Atomic payment verification is currently unavailable.',
        };
      }

      // 2. Client-orchestrated pre-migration fallback (strictly non-atomic, with conditional writes and compensating rollbacks):
      // Confirm invoice belongs to authenticated workspace
      const { data: inv, error: invErr } = await this.supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (invErr || !inv) {
        return { success: false, error: 'Invoice not found in the authenticated workspace.' };
      }

      // Cancelled or void invoices cannot accept payment confirmation
      if (isVerified && (inv.status === 'cancelled' || inv.status === 'void')) {
        return {
          success: false,
          errorCode: 'invoice_cancelled',
          error: `Invoice ${inv.invoice_number} is in "${inv.status}" status. Payment confirmation is not permitted on cancelled or void invoices.`,
        };
      }

      // 2. Fetch pending claim for this workspace and invoice
      const { data: pendingClaim, error: claimErr } = await this.supabase
        .from('payments')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('invoice_id', invoiceId)
        .eq('source', 'customer_claim')
        .eq('status', 'pending_verification')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (claimErr) {
        return { success: false, error: claimErr.message };
      }

      // Defect CLM-002: Reject verification/rejection when no pending claim exists!
      // Never substitute outstanding balance for a missing claim amount.
      if (!pendingClaim) {
        return {
          success: false,
          errorCode: 'no_pending_claim',
          error: 'No pending payment claim found for this invoice. Verification cannot proceed without an existing unverified claim.',
        };
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const claimAmount = Number(pendingClaim.amount);

      if (isVerified) {
        // Confirmation-only validation: Authoritative ledger calculation & consistency check
        const { data: confirmedPayments, error: confirmedErr } = await this.supabase
          .from('payments')
          .select('amount')
          .eq('workspace_id', workspaceId)
          .eq('invoice_id', invoiceId)
          .eq('status', 'confirmed');

        if (confirmedErr) {
          return { success: false, error: confirmedErr.message };
        }

        const priorConfirmedPaid = (confirmedPayments || []).reduce(
          (sum: number, p: any) => sum + Number(p.amount || 0),
          0
        );

        // Detect existing ledger overpayment at currency precision (cents/paisa)
        if (Math.round(priorConfirmedPaid * 100) > Math.round(Number(inv.amount) * 100)) {
          return {
            success: false,
            errorCode: 'ledger_overpayment_detected',
            error: `Confirmed payments (${inv.currency} ${priorConfirmedPaid}) exceed invoice total (${inv.currency} ${inv.amount}). Ledger is inconsistent; manual reconciliation required.`,
          };
        }

        const authoritativeOutstanding = Math.max(0, Number(inv.amount) - priorConfirmedPaid);

        // Consistency check: fail safely if invoice cached balance contradicts payment ledger
        if (
          inv.outstanding_amount !== null &&
          inv.outstanding_amount !== undefined &&
          Math.round(Number(inv.outstanding_amount) * 100) !== Math.round(authoritativeOutstanding * 100)
        ) {
          return {
            success: false,
            errorCode: 'ledger_balance_mismatch',
            error: `Invoice balance (outstanding: ${inv.outstanding_amount}) does not reconcile with confirmed payment ledger (expected: ${authoritativeOutstanding}). Manual ledger reconciliation required.`,
          };
        }

        if (
          inv.amount_paid !== null &&
          inv.amount_paid !== undefined &&
          Math.round(Number(inv.amount_paid) * 100) !== Math.round(priorConfirmedPaid * 100)
        ) {
          return {
            success: false,
            errorCode: 'ledger_balance_mismatch',
            error: `Invoice amount_paid (${inv.amount_paid}) does not reconcile with confirmed payment ledger (${priorConfirmedPaid}). Manual ledger reconciliation required.`,
          };
        }

        // Validate claim amount against authoritative balance
        if (isNaN(claimAmount) || claimAmount <= 0) {
          return {
            success: false,
            errorCode: 'invalid_claim_amount',
            error: 'Payment claim amount must be greater than zero.',
          };
        }

        // Block any claim that would cause total confirmed payments to exceed invoice total
        if (Math.round((priorConfirmedPaid + claimAmount) * 100) > Math.round(Number(inv.amount) * 100)) {
          return {
            success: false,
            errorCode: 'claim_exceeds_outstanding',
            error: `Claimed amount (${inv.currency} ${claimAmount.toLocaleString()}) exceeds the current outstanding balance (${inv.currency} ${authoritativeOutstanding.toLocaleString()}).`,
          };
        }
        // Concurrency protection: Atomic conditional update at database level.
        // Requires status = 'pending_verification'. If another concurrent call already verified or resolved it,
        // this update matches 0 rows and returns null.
        const { data: updatedClaim, error: updateClaimErr } = await this.supabase
          .from('payments')
          .update({
            status: 'confirmed',
          })
          .eq('id', pendingClaim.id)
          .eq('workspace_id', workspaceId)
          .eq('invoice_id', invoiceId)
          .eq('status', 'pending_verification')
          .select()
          .maybeSingle();

        if (updateClaimErr) {
          return { success: false, error: updateClaimErr.message };
        }

        if (!updatedClaim) {
          return {
            success: false,
            errorCode: 'claim_already_resolved',
            error: 'Payment claim has already been verified or resolved. Duplicate confirmation blocked.',
          };
        }

        // Authoritatively update invoice balance using priorConfirmedPaid + claimAmount
        const newPaid = priorConfirmedPaid + claimAmount;
        const newOutstanding = Math.max(0, Number(inv.amount) - newPaid);
        const newStatus = newOutstanding === 0 ? 'paid' : 'partially_paid';

        const { error: invUpdateErr } = await this.supabase
          .from('invoices')
          .update({
            amount_paid: newPaid,
            outstanding_amount: newOutstanding,
            status: newStatus,
            paid_date: newStatus === 'paid' ? todayStr : inv.paid_date,
            collection_health: newStatus === 'paid' ? 100 : (inv.collection_health ?? 50),
            health_category: newStatus === 'paid' ? 'low_risk' : (inv.health_category ?? 'medium_risk'),
            next_action: newStatus === 'paid' ? 'Payment confirmed. Chasing stopped.' : `Chase remaining ${inv.currency} ${newOutstanding.toLocaleString()}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)
          .eq('workspace_id', workspaceId);

        if (invUpdateErr) {
          // Compensating write rollback: revert payment to pending_verification to prevent contradictory state
          await this.supabase
            .from('payments')
            .update({ status: 'pending_verification' })
            .eq('id', pendingClaim.id);

          return {
            success: false,
            error: `Failed to update invoice balance: ${invUpdateErr.message}. Payment verification rolled back.`,
          };
        }

        // Record verification timeline event
        const { error: eventErr } = await this.supabase.from('collection_events').insert({
          workspace_id: workspaceId,
          invoice_id: invoiceId,
          type: 'payment_verified',
          title: 'Payment Claim Verified & Confirmed ✅',
          description: `Bank verified payment of ${inv.currency} ${claimAmount.toLocaleString()} credited.`,
          badge: newStatus === 'paid' ? 'SETTLED' : 'PARTIAL VERIFIED',
          actor: 'user',
        });

        if (eventErr) {
          // Non-fatal event logging failure - financial ledger is already atomic & consistent
          console.warn('Collection event logging failed for verified payment:', eventErr.message);
        }

        // Fulfill promises sequentially based on cumulative verified funds
        const { data: allPromises } = await this.supabase
          .from('payment_promises')
          .select('id, promised_amount, promised_date, detected_at, status')
          .eq('invoice_id', invoiceId)
          .eq('workspace_id', workspaceId);

        if (allPromises && allPromises.length > 0) {
          if (newStatus === 'paid') {
            for (const prom of allPromises.filter((p: any) => p.status === 'pending')) {
              await this.supabase
                .from('payment_promises')
                .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
                .eq('id', prom.id);
            }
          } else {
            // Partial payment: Fulfill pending promises sequentially based on cumulative unallocated verified funds
            const fulfilledConsumed = allPromises
              .filter((p: any) => p.status === 'fulfilled')
              .reduce((sum: number, p: any) => sum + Number(p.promised_amount || 0), 0);

            let availableFunds = Math.max(0, newPaid - fulfilledConsumed);

            const pendingSorted = allPromises
              .filter((p: any) => p.status === 'pending')
              .sort((a: any, b: any) => {
                const dateCmp = (a.promised_date || '').localeCompare(b.promised_date || '');
                if (dateCmp !== 0) return dateCmp;
                const detCmp = (a.detected_at || '').localeCompare(b.detected_at || '');
                if (detCmp !== 0) return detCmp;
                return (a.id || '').localeCompare(b.id || '');
              });

            for (const prom of pendingSorted) {
              const promAmt = Number(prom.promised_amount);
              if (availableFunds >= promAmt) {
                await this.supabase
                  .from('payment_promises')
                  .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
                  .eq('id', prom.id);
                availableFunds -= promAmt;
              } else {
                // Earliest commitment unsatisfied; stop sequential allocation
                break;
              }
            }
          }
        }

        return {
          success: true,
          data: {
            status: newStatus,
            amountPaid: newPaid,
            outstandingAmount: newOutstanding,
          },
        };
      } else {
        // Rejection: Atomically delete the pending unverified claim ONLY if it is still in pending_verification status
        const { data: deletedClaim, error: delErr } = await this.supabase
          .from('payments')
          .delete()
          .eq('id', pendingClaim.id)
          .eq('workspace_id', workspaceId)
          .eq('invoice_id', invoiceId)
          .eq('status', 'pending_verification')
          .select()
          .maybeSingle();

        if (delErr) {
          return { success: false, error: delErr.message };
        }

        if (!deletedClaim) {
          return {
            success: false,
            errorCode: 'claim_already_resolved',
            error: 'Payment claim has already been resolved. Duplicate rejection blocked.',
          };
        }

        await this.supabase
          .from('invoices')
          .update({
            next_action: 'Payment claim unconfirmed in bank. Follow-up resumed.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)
          .eq('workspace_id', workspaceId);

        await this.supabase.from('collection_events').insert({
          workspace_id: workspaceId,
          invoice_id: invoiceId,
          type: 'escalation_triggered',
          title: 'Payment Claim Rejected ❌',
          description: 'Payment claim could not be verified in bank ledger. Collection resumed.',
          badge: 'CLAIM REJECTED',
          actor: 'user',
        });

        return { success: true, data: { rejected: true } };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unexpected failure verifying payment claim.' };
    }
  }

  // Execute AI Decision with Full Lifecycle & Collection Event Persistence (DEC-001, DEC-002)
  async executeDecision(
    workspaceId: string,
    decisionId: string
  ): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string; isPreview?: boolean }> {
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

    try {
      // 1. Fetch decision record
      const { data: decision, error: decErr } = await this.supabase
        .from('ai_decisions')
        .select('*')
        .eq('id', decisionId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (decErr || !decision) {
        return { success: false, error: 'Decision record not found in workspace or access denied.' };
      }

      // 2. Prevent duplicate execution (client or stale status check)
      if (decision.status === 'executed') {
        return {
          success: false,
          errorCode: 'already_executed',
          error: 'Decision has already been executed. Repeated execution is blocked.',
        };
      }

      // 3. Immediately before executing, re-read persisted invoice data
      const { data: inv, error: invErr } = await this.supabase
        .from('invoices')
        .select('*')
        .eq('id', decision.invoice_id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (invErr || !inv) {
        return { success: false, error: 'Associated invoice record not found in workspace.' };
      }

      // Defect DEC-002: Re-read pending payment claims from persisted data immediately before execution
      const { data: pendingClaims, error: claimsErr } = await this.supabase
        .from('payments')
        .select('id, amount, reference')
        .eq('workspace_id', workspaceId)
        .eq('invoice_id', decision.invoice_id)
        .eq('source', 'customer_claim')
        .eq('status', 'pending_verification')
        .limit(1);

      if (claimsErr) {
        return { success: false, error: claimsErr.message };
      }

      const hasPendingClaim = Boolean(pendingClaims && pendingClaims.length > 0);
      const action = decision.recommended_action;
      const isCustomerContact = action === 'FOLLOW_UP' || action === 'NUDGE' || action === 'ESCALATE';

      // Defect DEC-002: Block customer-contact collection actions while unverified claim is pending review
      if (hasPendingClaim && isCustomerContact) {
        return {
          success: false,
          errorCode: 'payment_claim_pending',
          error: `Invoice ${inv.invoice_number} has an unverified payment claim awaiting verification. Customer-contact action "${action}" is blocked until claim is reviewed.`,
        };
      }

      // Defect DEC-002: Revalidate settled, disputed, held, or cancelled invoices
      const isPaid = inv.status === 'paid' || Number(inv.outstanding_amount ?? inv.amount) <= 0;
      const isDisputed = inv.status === 'disputed';
      const isHeld = inv.status === 'held' || inv.status === 'on_hold';
      const isCancelled = inv.status === 'cancelled' || inv.status === 'void';

      // Invariant: Settled invoices cannot execute automated chasing
      if (isPaid && action !== 'STOP') {
        return {
          success: false,
          errorCode: 'invoice_settled',
          error: `Invoice ${inv.invoice_number} is already fully paid. Automated action "${action}" cannot be executed on settled accounts.`,
        };
      }

      // Invariant: Disputed invoices cannot execute automatic contact
      if (isDisputed && isCustomerContact) {
        return {
          success: false,
          errorCode: 'invoice_disputed',
          error: `Invoice ${inv.invoice_number} is currently disputed. Automated reminders and outreach are blocked until dispute is resolved.`,
        };
      }

      // Invariant: Held invoices cannot execute automated outreach
      if (isHeld && isCustomerContact) {
        return {
          success: false,
          errorCode: 'invoice_on_hold',
          error: `Invoice ${inv.invoice_number} is currently on hold. Automated customer-contact actions are blocked.`,
        };
      }

      // Invariant: Cancelled invoices cannot execute collection actions
      if (isCancelled) {
        return {
          success: false,
          errorCode: 'invoice_cancelled',
          error: `Invoice ${inv.invoice_number} is cancelled/void. Collection actions cannot be executed.`,
        };
      }

      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];

      // 4. Atomic conditional update of decision status:
      // Guarantees only one concurrent execution can transition status from non-executed to executed
      const { data: updatedDec, error: updateDecErr } = await this.supabase
        .from('ai_decisions')
        .update({ status: 'executed' })
        .eq('id', decisionId)
        .eq('workspace_id', workspaceId)
        .neq('status', 'executed')
        .select()
        .maybeSingle();

      if (updateDecErr) {
        return { success: false, error: updateDecErr.message };
      }

      if (!updatedDec) {
        return {
          success: false,
          errorCode: 'already_executed',
          error: 'Decision has already been executed. Repeated execution is blocked.',
        };
      }

      // 5. Update invoice state based on action (strictly preserving financial balances)
      const invoiceUpdates: Record<string, any> = {
        updated_at: now,
      };

      let eventType = 'decision_executed';
      let eventTitle = `AI Action Executed: ${action}`;
      let eventDesc = decision.suggested_body || decision.summary;
      let eventBadge = `${action}`;

      if (action === 'STOP') {
        invoiceUpdates.next_action = 'Chasing stopped. Account settled.';
        eventBadge = 'STOPPED';
      } else if (action === 'ESCALATE') {
        invoiceUpdates.status = 'escalated';
        invoiceUpdates.next_action = 'Escalated to human review / direct phone call';
        eventType = 'escalation_triggered';
        eventTitle = 'AI Decision Executed: Escalated to Human Review';
        eventBadge = 'ESCALATED';
      } else if (action === 'FOLLOW_UP' || action === 'NUDGE') {
        invoiceUpdates.status = 'chasing';
        invoiceUpdates.reminders_sent = (inv.reminders_sent || 0) + 1;
        invoiceUpdates.last_contact_date = todayStr;
        invoiceUpdates.next_action = 'Awaiting customer response / payment promise';
        eventType = 'reminder_sent';
        eventTitle = decision.suggested_subject || `AI Follow-up Sent: ${inv.invoice_number}`;
        eventBadge = 'AI Chasing';
      } else if (action === 'WAIT') {
        invoiceUpdates.next_action = 'Waiting for committed payment date';
        eventBadge = 'WAITING';
      } else if (action === 'HUMAN') {
        invoiceUpdates.next_action = 'Flagged for human mediation';
        eventBadge = 'HUMAN REVIEW';
      }

      const { error: invUpdateErr } = await this.supabase
        .from('invoices')
        .update(invoiceUpdates)
        .eq('id', inv.id)
        .eq('workspace_id', workspaceId);

      if (invUpdateErr) {
        // Compensating rollback: Revert decision status back to original status
        await this.supabase
          .from('ai_decisions')
          .update({ status: decision.status })
          .eq('id', decisionId);

        return {
          success: false,
          error: `Failed to update invoice state: ${invUpdateErr.message}. Execution rolled back.`,
        };
      }

      // 6. Insert collection event into collection_events
      const { error: eventErr } = await this.supabase.from('collection_events').insert({
        workspace_id: workspaceId,
        invoice_id: inv.id,
        type: eventType,
        title: eventTitle,
        description: eventDesc,
        badge: eventBadge,
        actor: 'ai',
        metadata: {
          decision_id: decision.id,
          action,
          urgency: decision.urgency,
          executed_at: now,
        },
      });

      if (eventErr) {
        // Compensating rollback if audit event fails
        await this.supabase
          .from('ai_decisions')
          .update({ status: decision.status })
          .eq('id', decisionId);

        await this.supabase
          .from('invoices')
          .update({
            status: inv.status,
            reminders_sent: inv.reminders_sent,
            last_contact_date: inv.last_contact_date,
            next_action: inv.next_action,
            updated_at: inv.updated_at,
          })
          .eq('id', inv.id)
          .eq('workspace_id', workspaceId);

        return {
          success: false,
          error: `Failed to persist audit event: ${eventErr.message}. Execution rolled back.`,
        };
      }

      return {
        success: true,
        data: {
          decisionId,
          invoiceId: inv.id,
          action,
          invoiceUpdates,
          eventTitle,
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unexpected failure executing AI decision.' };
    }
  }
}

export const accountService = AccountService.getInstance();
