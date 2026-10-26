import { createClient } from '../lib/supabase/client';
import { Customer, Invoice, InvoiceStatus, InvoiceEvent, PaymentPromise, Workspace, AutomationRules, AiDecision, PaymentClaimStatus, ImportRowResult, ImportInvoicesBatchResult } from '../types';
import { initialCustomers, initialInvoices, initialPaymentPromises, initialWorkspace, defaultAutomationRules } from '../lib/mockData';
import { getPlanConfig } from '../lib/planLimits';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (val?: string | null): boolean => Boolean(val && typeof val === 'string' && UUID_REGEX.test(val));

export class AccountService {
  private static instance: AccountService;
  private static importLocks = new Map<string, Promise<void>>();
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
        const amt = Number(inv.amount);
        const invPaidAmount = inv.amount_paid !== undefined && inv.amount_paid !== null ? Number(inv.amount_paid) : (inv.status === 'paid' ? amt : 0);
        const authoritativePaid = Math.max(invPaidAmount, verifiedPaidSum);

        const isSettled = inv.status === 'paid' || (amt > 0 && authoritativePaid >= amt);
        const outstanding = isSettled
          ? 0
          : (inv.outstanding_amount !== undefined && inv.outstanding_amount !== null
              ? Number(inv.outstanding_amount)
              : Math.max(0, amt - authoritativePaid));
        const status = isSettled ? 'paid' : inv.status;

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
          status,
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
  async fetchDecisions(workspaceId?: string, options?: { supabaseClient?: any }): Promise<Array<{
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
    const sb = options?.supabaseClient || this.supabase;
    try {
      const { data, error } = await sb
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
  async syncDecisions(
    workspaceId: string,
    decisions: AiDecision[],
    options?: { supabaseClient?: any }
  ): Promise<{ success: boolean; syncedCount: number; error?: string; isPreview?: boolean }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return { success: true, syncedCount: 0, isPreview: true };
    }

    const sb = options?.supabaseClient || this.supabase;

    try {
      // 1. Session verification & workspace membership check
      const { data: authData, error: authErr } = await sb.auth.getUser();
      if (authErr || !authData?.user) {
        return { success: false, syncedCount: 0, error: 'Unauthorized: Authentication required.' };
      }

      const userId = authData.user.id;
      const { data: wsData, error: wsErr } = await sb
        .from('workspaces')
        .select('id, user_id')
        .eq('id', workspaceId)
        .maybeSingle();

      if (wsErr) {
        return { success: false, syncedCount: 0, error: wsErr.message };
      }

      const isOwner = wsData && wsData.user_id === userId;
      if (!isOwner) {
        const { data: memberData, error: memberErr } = await sb
          .from('workspace_members')
          .select('id, status')
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (memberErr) {
          return { success: false, syncedCount: 0, error: memberErr.message };
        }
        if (!memberData) {
          return { success: false, syncedCount: 0, error: 'Access denied: You are not an authorized member of this workspace.' };
        }
      }

      if (!decisions || decisions.length === 0) {
        return { success: true, syncedCount: 0 };
      }

      // 2. Fetch existing decisions for this workspace
      const { data: existing, error: fetchErr } = await sb
        .from('ai_decisions')
        .select('id, invoice_id, status, recommended_action')
        .eq('workspace_id', workspaceId);

      if (fetchErr) {
        return { success: false, syncedCount: 0, error: fetchErr.message };
      }

      const existingMap = new Map<string, any>();
      (existing || []).forEach((row: any) => existingMap.set(row.invoice_id, row));

      const toInsert: any[] = [];
      const toUpdate: Array<{ id: string; updates: any }> = [];

      for (const d of decisions) {
        if (!isUuid(d.invoiceId)) continue;

        const isStopped = d.action === 'STOP';
        const existingRecord = existingMap.get(d.invoiceId);

        let dbIntent = 'OTHER';
        if (d.action === 'WAIT') dbIntent = 'PROMISE_TO_PAY';
        else if (d.action === 'HUMAN') dbIntent = 'DISPUTE';
        else if (d.action === 'ESCALATE') dbIntent = 'NO_RESPONSE';
        else if (d.action === 'STOP') dbIntent = 'PAYMENT_CLAIMED';

        if (isStopped) {
          // If invoice is fully settled, cancelled, void or draft:
          // If an existing pending decision exists, update it to executed STOP so it ceases being actionable
          if (existingRecord && existingRecord.status === 'pending') {
            toUpdate.push({
              id: existingRecord.id,
              updates: {
                recommended_action: 'STOP',
                summary: d.reason || 'Automated chasing stopped.',
                status: 'executed',
              },
            });
          }
          // Do not insert new pending actionable collection records for stopped invoices
          continue;
        }

        // Invoice is eligible for collection recommendation (WAIT, NUDGE, FOLLOW_UP, ESCALATE, HUMAN)
        if (existingRecord) {
          // If already in DB: only update if pending to keep the recommendation fresh without clobbering user approved/rejected/executed audit history
          if (existingRecord.status === 'pending') {
            toUpdate.push({
              id: existingRecord.id,
              updates: {
                intent: dbIntent,
                confidence: Math.min(0.99, Number((d.confidence / 100).toFixed(2))),
                summary: d.reason || 'AI recommendation',
                recommended_action: d.action,
                urgency: d.priority === 'HIGH' ? 'high' : d.priority === 'LOW' ? 'low' : 'medium',
                requires_human_review: d.action === 'HUMAN' || d.action === 'ESCALATE',
                suggested_subject: d.suggestedMessage?.subject || null,
                suggested_body: d.suggestedMessage?.body || null,
              },
            });
          }
        } else {
          // New eligible invoice -> insert pending decision
          toInsert.push({
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
          });
        }
      }

      let syncedCount = 0;

      if (toInsert.length > 0) {
        const { error: insertErr } = await sb.from('ai_decisions').insert(toInsert);
        if (insertErr) {
          return { success: false, syncedCount: 0, error: insertErr.message };
        }
        syncedCount += toInsert.length;
      }

      for (const item of toUpdate) {
        const { error: updateErr } = await sb
          .from('ai_decisions')
          .update(item.updates)
          .eq('id', item.id)
          .eq('workspace_id', workspaceId);
        if (!updateErr) {
          syncedCount++;
        }
      }

      return { success: true, syncedCount };
    } catch (err: any) {
      return { success: false, syncedCount: 0, error: err?.message || 'Failed to sync AI decisions.' };
    }
  }

  // Save Operator Lifecycle Status Override for AI Decision
  async saveDecisionStatus(
    workspaceId: string,
    decisionId: string,
    status: 'PENDING' | 'APPROVED' | 'DISMISSED' | 'EXECUTED',
    options?: { supabaseClient?: any }
  ): Promise<{ success: boolean; data?: any; error?: string; isPreview?: boolean }> {
    if (!workspaceId || !isUuid(workspaceId) || workspaceId === 'ws-default') {
      return {
        success: false,
        error: 'Preview mode: changes are kept in local state only.',
        isPreview: true,
      };
    }

    if (!decisionId) {
      return { success: false, error: 'A valid decision ID or invoice ID is required.' };
    }

    const rawId = decisionId.startsWith('dec-') ? decisionId.slice(4) : decisionId;
    if (!isUuid(rawId)) {
      return { success: false, error: 'A valid UUID is required for decision persistence.' };
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

    const sb = options?.supabaseClient || this.supabase;

    try {
      // 1. Session verification & workspace membership check
      const { data: authData, error: authErr } = await sb.auth.getUser();
      if (authErr || !authData?.user) {
        return { success: false, error: 'Unauthorized: Authentication required.' };
      }

      const userId = authData.user.id;
      const { data: wsData, error: wsErr } = await sb
        .from('workspaces')
        .select('id, user_id')
        .eq('id', workspaceId)
        .maybeSingle();

      if (wsErr) {
        return { success: false, error: wsErr.message };
      }

      const isOwner = wsData && wsData.user_id === userId;
      if (!isOwner) {
        const { data: memberData, error: memberErr } = await sb
          .from('workspace_members')
          .select('id, status')
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (memberErr) {
          return { success: false, error: memberErr.message };
        }
        if (!memberData) {
          return { success: false, error: 'Access denied: You are not an authorized member of this workspace.' };
        }
      }

      // 2. Confirm decision exists in the authenticated workspace (matching either decision ID or invoice ID)
      const { data: existing, error: fetchErr } = await sb
        .from('ai_decisions')
        .select('id, workspace_id, invoice_id, status')
        .eq('workspace_id', workspaceId)
        .or(`id.eq.${rawId},invoice_id.eq.${rawId}`)
        .limit(1)
        .maybeSingle();

      if (fetchErr) {
        return { success: false, error: fetchErr.message };
      }
      if (!existing) {
        return { success: false, error: 'Decision record not found in workspace or access denied.' };
      }

      // Update status in public.ai_decisions
      const { data: updated, error: updateErr } = await sb
        .from('ai_decisions')
        .update({ status: dbStatus })
        .eq('id', existing.id)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      // Record Operator Audit Event in public.collection_events
      if (existing.invoice_id) {
        const eventType = status === 'APPROVED' ? 'decision_approved' : status === 'DISMISSED' ? 'decision_dismissed' : 'decision_executed';
        const eventTitle = status === 'APPROVED'
          ? 'AI Decision Approved by Operator'
          : status === 'DISMISSED'
          ? 'AI Decision Dismissed by Operator'
          : 'AI Decision Status Updated';

        try {
          await sb.from('collection_events').insert({
            workspace_id: workspaceId,
            invoice_id: existing.invoice_id,
            type: eventType,
            title: eventTitle,
            description: `Operator ${status === 'APPROVED' ? 'approved' : 'dismissed'} collection recommendation.`,
            badge: status,
            actor: 'user',
            metadata: {
              decision_id: existing.id,
              action: status,
              operator_id: userId,
              previous_status: existing.status,
            },
          });
        } catch {
          // Non-critical audit log fallback
        }
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
  async saveAutomationRules(
    workspaceId: string,
    rules: Partial<AutomationRules>
  ): Promise<{ success: boolean; error?: string; isPreview?: boolean }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return { success: false, error: 'Preview mode: changes are kept in local state only.', isPreview: true };
    }
    try {
      const { error } = await this.supabase.from('ai_settings').upsert({
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
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to save automation rules.' };
    }
  }

  // Persist Imported Invoices Batch with workspace isolation, row validation, and financial safety
  async importInvoicesBatch(
    workspaceId: string,
    invoices: Array<any>,
    options: {
      fileName?: string;
      batchId?: string;
      duplicatePolicy?: 'update' | 'skip';
      supabaseClient?: any;
    } = {}
  ): Promise<ImportInvoicesBatchResult> {
    const sb = options.supabaseClient || this.supabase;
    const duplicatePolicy = options.duplicatePolicy || 'update';

    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return {
        success: false,
        totalRows: invoices.length,
        importedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        rejectedCount: invoices.length,
        errors: ['Preview mode: Database writes are disabled for unauthenticated preview workspaces.'],
        rowResults: invoices.map((inv, idx) => ({
          rowNumber: idx + 1,
          invoiceNumber: String(inv.invoiceNumber || `ROW-${idx + 1}`),
          status: 'rejected' as const,
          error: 'Preview workspace cannot persist records to database.',
        })),
        isPreview: true,
      };
    }

    // Workspace-level serialized execution to prevent concurrent import quota bypass
    const previousLock = AccountService.importLocks.get(workspaceId) || Promise.resolve();
    let releaseLock: () => void = () => {};
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    AccountService.importLocks.set(workspaceId, currentLock);

    await previousLock;
    try {
      return await this.executeImportInvoicesBatch(workspaceId, invoices, options, sb, duplicatePolicy);
    } finally {
      releaseLock();
      if (AccountService.importLocks.get(workspaceId) === currentLock) {
        AccountService.importLocks.delete(workspaceId);
      }
    }
  }

  private async executeImportInvoicesBatch(
    workspaceId: string,
    invoices: Array<any>,
    options: {
      fileName?: string;
      batchId?: string;
      duplicatePolicy?: 'update' | 'skip';
      supabaseClient?: any;
    },
    sb: any,
    duplicatePolicy: 'update' | 'skip'
  ): Promise<ImportInvoicesBatchResult> {

    // 1. Session and Workspace Verification
    let isAuthorized = false;
    try {
      const { data: { user }, error: authErr } = await sb.auth.getUser();
      if (authErr || !user) {
        return {
          success: false,
          totalRows: invoices.length,
          importedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          rejectedCount: invoices.length,
          errors: ['Authentication required: Please sign in to import invoices.'],
          rowResults: invoices.map((inv, idx) => ({
            rowNumber: idx + 1,
            invoiceNumber: String(inv.invoiceNumber || `ROW-${idx + 1}`),
            status: 'rejected' as const,
            error: 'User not authenticated.',
          })),
        };
      }

      // Check if user is workspace owner or active member
      const { data: ws } = await sb
        .from('workspaces')
        .select('id, user_id')
        .eq('id', workspaceId)
        .maybeSingle();

      if (ws && ws.user_id === user.id) {
        isAuthorized = true;
      } else {
        const { data: member } = await sb
          .from('workspace_members')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (member) isAuthorized = true;
      }
    } catch {
      isAuthorized = false;
    }

    if (!isAuthorized) {
      return {
        success: false,
        totalRows: invoices.length,
        importedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        rejectedCount: invoices.length,
        errors: ['Workspace authorization denied: You do not have permission to import into this workspace.'],
        rowResults: invoices.map((inv, idx) => ({
          rowNumber: idx + 1,
          invoiceNumber: String(inv.invoiceNumber || `ROW-${idx + 1}`),
          status: 'rejected' as const,
          error: 'Workspace authorization denied.',
        })),
      };
    }

    // 2. Validate Row Data
    const rowResults: ImportRowResult[] = [];
    const validRows: Array<{
      index: number;
      invoiceNumber: string;
      customerName: string;
      customerEmail: string;
      amount: number;
      paidAmount: number;
      outstandingAmount: number;
      issueDate: string;
      dueDate: string;
      status?: InvoiceStatus;
      currency: string;
      paidDate?: string;
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const seenInBatch = new Set<string>();

    invoices.forEach((item: any, idx: number) => {
      const rowNum = idx + 1;
      const num = String(item.invoiceNumber || '').trim();
      const custName = String(item.customerName || '').trim();
      const rawAmt = Number(item.amount);
      const rawDue = item.dueDate ? String(item.dueDate).trim() : '';

      if (!num) {
        rowResults.push({
          rowNumber: rowNum,
          invoiceNumber: `ROW-${rowNum}`,
          status: 'rejected',
          error: 'Missing required invoice number',
        });
        return;
      }

      if (!custName) {
        rowResults.push({
          rowNumber: rowNum,
          invoiceNumber: num,
          status: 'rejected',
          error: 'Missing required customer name',
        });
        return;
      }

      if (isNaN(rawAmt) || !isFinite(rawAmt) || rawAmt <= 0) {
        rowResults.push({
          rowNumber: rowNum,
          invoiceNumber: num,
          customerName: custName,
          status: 'rejected',
          error: `Invalid invoice amount (${item.amount}). Amount must be greater than zero.`,
        });
        return;
      }

      if (!rawDue || !/^\d{4}-\d{2}-\d{2}/.test(rawDue)) {
        rowResults.push({
          rowNumber: rowNum,
          invoiceNumber: num,
          customerName: custName,
          amount: rawAmt,
          status: 'rejected',
          error: `Invalid or missing due date (${item.dueDate}). Expected YYYY-MM-DD.`,
        });
        return;
      }

      const numKey = num.toLowerCase();
      if (seenInBatch.has(numKey)) {
        rowResults.push({
          rowNumber: rowNum,
          invoiceNumber: num,
          customerName: custName,
          amount: rawAmt,
          status: 'rejected',
          error: `Duplicate invoice number within same import batch (${num})`,
        });
        return;
      }
      seenInBatch.add(numKey);

      const custEmail = item.customerEmail
        ? String(item.customerEmail).trim().toLowerCase()
        : `${custName.toLowerCase().replace(/[^a-z0-9]/g, '')}@billing.com`;

      const amt = Math.round(rawAmt * 100) / 100;
      const due = rawDue.split('T')[0];
      const issue = item.issueDate && /^\d{4}-\d{2}-\d{2}/.test(String(item.issueDate))
        ? String(item.issueDate).trim().split('T')[0]
        : todayStr;

      const currency = item.currency || 'INR';
      const paidAmount = item.paidAmount !== undefined ? Math.max(0, Number(item.paidAmount) || 0) : 0;
      const outstandingAmount = item.outstandingAmount !== undefined ? Math.max(0, Number(item.outstandingAmount)) : Math.max(0, amt - paidAmount);

      validRows.push({
        index: idx,
        invoiceNumber: num,
        customerName: custName,
        customerEmail: custEmail,
        amount: amt,
        paidAmount,
        outstandingAmount,
        issueDate: issue,
        dueDate: due,
        status: item.status,
        currency,
        paidDate: item.paidDate,
      });
    });

    if (validRows.length === 0) {
      return {
        success: false,
        totalRows: invoices.length,
        importedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        rejectedCount: rowResults.length,
        errors: ['No valid rows to import.'],
        rowResults,
      };
    }

    // 3. Query existing invoices to prevent duplicate conflicts and protect verified payments
    const validNumbers = validRows.map((r) => r.invoiceNumber);
    const existingMap = new Map<string, any>();

    const { data: existingData, error: existErr } = await sb
      .from('invoices')
      .select('id, workspace_id, invoice_number, customer_id, customer_name, customer_email, amount, amount_paid, outstanding_amount, status, due_date, issue_date, reminders_sent, customer_replies_count, payment_promises_count, payments(*)')
      .eq('workspace_id', workspaceId)
      .in('invoice_number', validNumbers);

    if (existErr) {
      return {
        success: false,
        totalRows: invoices.length,
        importedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        rejectedCount: invoices.length,
        errors: [`Database check for existing records failed: ${existErr.message}`],
        rowResults: invoices.map((inv, idx) => ({
          rowNumber: idx + 1,
          invoiceNumber: String(inv.invoiceNumber || `ROW-${idx + 1}`),
          status: 'rejected' as const,
          error: existErr.message,
        })),
      };
    }

    if (existingData) {
      existingData.forEach((row: any) => {
        existingMap.set(String(row.invoice_number).toLowerCase().trim(), row);
      });
    }

    // 4. Server-Side Plan Limit & Active Quota Pre-Check
    // Genuine new rows that are not yet in the workspace
    const genuinelyNewRows = validRows.filter((r) => !existingMap.has(r.invoiceNumber.toLowerCase()));
    const newActiveCount = genuinelyNewRows.filter((r) => r.status !== 'paid' && r.outstandingAmount > 0).length;

    if (newActiveCount > 0) {
      const { data: sub, error: subErr } = await sb
        .from('subscriptions')
        .select('plan_id, status')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (subErr || !sub || !sub.plan_id) {
        return {
          success: false,
          totalRows: invoices.length,
          importedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          rejectedCount: invoices.length,
          errors: [
            subErr
              ? `Database check for subscription plan failed: ${subErr.message}`
              : 'Workspace subscription plan not found. Unable to verify invoice plan limits. Please configure your workspace billing plan.',
          ],
          rowResults: invoices.map((inv, idx) => ({
            rowNumber: idx + 1,
            invoiceNumber: String(inv.invoiceNumber || `ROW-${idx + 1}`),
            status: 'rejected' as const,
            error: 'Unable to verify workspace subscription plan.',
          })),
        };
      }

      const planConfig = getPlanConfig(sub.plan_id);
      if (!planConfig) {
        return {
          success: false,
          totalRows: invoices.length,
          importedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          rejectedCount: invoices.length,
          errors: [`Invalid or unrecognized subscription plan (${sub.plan_id}). Unable to verify plan limits.`],
          rowResults: invoices.map((inv, idx) => ({
            rowNumber: idx + 1,
            invoiceNumber: String(inv.invoiceNumber || `ROW-${idx + 1}`),
            status: 'rejected' as const,
            error: `Unrecognized plan: ${sub.plan_id}`,
          })),
        };
      }

      if (sub.status === 'canceled') {
        return {
          success: false,
          totalRows: invoices.length,
          importedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          rejectedCount: invoices.length,
          errors: ['Workspace subscription is canceled. New invoice creation is disabled.'],
          rowResults: invoices.map((inv, idx) => ({
            rowNumber: idx + 1,
            invoiceNumber: String(inv.invoiceNumber || `ROW-${idx + 1}`),
            status: 'rejected' as const,
            error: 'Subscription is canceled.',
          })),
        };
      }

      const { data: currentInvoices, error: countErr } = await sb
        .from('invoices')
        .select('id, status')
        .eq('workspace_id', workspaceId);

      if (countErr) {
        return {
          success: false,
          totalRows: invoices.length,
          importedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          rejectedCount: invoices.length,
          errors: [`Failed to verify active invoice quota: ${countErr.message}`],
          rowResults: invoices.map((inv, idx) => ({
            rowNumber: idx + 1,
            invoiceNumber: String(inv.invoiceNumber || `ROW-${idx + 1}`),
            status: 'rejected' as const,
            error: countErr.message,
          })),
        };
      }

      const currentActiveCount = (currentInvoices || []).filter((inv: any) => inv.status !== 'paid').length;
      const projectedActive = currentActiveCount + newActiveCount;

      if (projectedActive > planConfig.maxActiveInvoices) {
        return {
          success: false,
          totalRows: invoices.length,
          importedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          rejectedCount: invoices.length,
          errors: [
            `Plan limit exceeded: Your ${planConfig.name} plan allows up to ${planConfig.maxActiveInvoices} active invoices. Workspace currently has ${currentActiveCount} active invoice(s). Importing ${newActiveCount} new invoice(s) would exceed your limit (${projectedActive}/${planConfig.maxActiveInvoices}). Please upgrade your plan or settle existing invoices.`,
          ],
          rowResults: invoices.map((inv, idx) => ({
            rowNumber: idx + 1,
            invoiceNumber: String(inv.invoiceNumber || `ROW-${idx + 1}`),
            status: 'rejected' as const,
            error: `Plan limit exceeded (${planConfig.name}: max ${planConfig.maxActiveInvoices} active invoices).`,
          })),
          planLimitExceeded: {
            planId: planConfig.id,
            planName: planConfig.name,
            planLimit: planConfig.maxActiveInvoices,
            currentUsage: currentActiveCount,
            attemptedNew: newActiveCount,
          },
        };
      }
    }

    // 5. Upsert Customers to obtain authoritative UUIDs for customer_id FK
    const customerMap = new Map<string, { name: string; email: string; company: string }>();
    validRows.forEach((r) => {
      const key = r.customerEmail;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: r.customerName,
          company: r.customerName,
          email: r.customerEmail,
        });
      }
    });

    const customerRowsToUpsert = Array.from(customerMap.values()).map((c) => ({
      workspace_id: workspaceId,
      name: c.name,
      company: c.company,
      email: c.email,
    }));

    const customerIdByEmail = new Map<string, string>();
    if (customerRowsToUpsert.length > 0) {
      const { data: custData, error: custErr } = await sb
        .from('customers')
        .upsert(customerRowsToUpsert, { onConflict: 'workspace_id,email' })
        .select('id, email');

      if (!custErr && custData) {
        custData.forEach((c: any) => {
          customerIdByEmail.set(c.email.toLowerCase(), c.id);
        });
      }
    }

    // 6. Categorize rows into Inserts and Updates with Financial Safety
    const toInsert: any[] = [];
    const toUpdate: Array<{ id: string; fields: any; rowResult: ImportRowResult }> = [];

    let skippedCount = 0;

    for (const row of validRows) {
      const existing = existingMap.get(row.invoiceNumber.toLowerCase());

      if (existing) {
        if (duplicatePolicy === 'skip') {
          skippedCount++;
          rowResults.push({
            rowNumber: row.index + 1,
            invoiceNumber: row.invoiceNumber,
            customerName: row.customerName,
            amount: row.amount,
            status: 'skipped',
            reason: `Invoice ${row.invoiceNumber} already exists in workspace (duplicate policy: skip)`,
          });
          continue;
        }

        // duplicatePolicy === 'update'
        // FINANCIAL TRUTH PRESERVATION:
        // Confirmed payments on record must NEVER be erased or reduced by a spreadsheet re-import.
        const confirmedPayments = (existing.payments || []).filter((p: any) => p.status === 'confirmed');
        const confirmedPaidSum = confirmedPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        const priorAuthoritativePaid = Math.max(Number(existing.amount_paid || 0), confirmedPaidSum);

        const isSettled = existing.status === 'paid' || (Number(existing.amount) > 0 && priorAuthoritativePaid >= Number(existing.amount));

        let finalPaid = priorAuthoritativePaid;
        let finalOutstanding = 0;
        let finalStatus = existing.status;

        if (isSettled) {
          finalStatus = 'paid';
          finalOutstanding = 0;
          finalPaid = Math.max(priorAuthoritativePaid, row.amount);
        } else {
          const importedPaid = row.paidAmount || 0;
          finalPaid = Math.max(priorAuthoritativePaid, importedPaid);
          finalOutstanding = Math.max(0, row.amount - finalPaid);
          if (finalOutstanding === 0 && row.amount > 0) {
            finalStatus = 'paid';
          } else if (finalPaid > 0) {
            finalStatus = 'partially_paid';
          } else {
            finalStatus = existing.status;
          }
        }

        const custId = customerIdByEmail.get(row.customerEmail) || existing.customer_id || null;

        const updateFields: any = {
          customer_name: row.customerName,
          customer_email: row.customerEmail,
          amount: row.amount,
          amount_paid: finalPaid,
          outstanding_amount: finalOutstanding,
          status: finalStatus,
          due_date: row.dueDate,
          issue_date: row.issueDate,
          currency: row.currency,
          updated_at: new Date().toISOString(),
        };
        if (custId) updateFields.customer_id = custId;

        toUpdate.push({
          id: existing.id,
          fields: updateFields,
          rowResult: {
            rowNumber: row.index + 1,
            invoiceNumber: row.invoiceNumber,
            customerName: row.customerName,
            amount: row.amount,
            status: 'updated',
            reason: 'Updated existing invoice metadata while preserving verified payment history',
          },
        });
      } else {
        // Brand new invoice insertion
        const isPaid = row.status === 'paid' || row.outstandingAmount <= 0;
        const initialPaid = isPaid ? row.amount : row.paidAmount;
        const initialOutstanding = isPaid ? 0 : Math.max(0, row.amount - initialPaid);

        let initialStatus: InvoiceStatus = 'overdue';
        const diffDays = Math.ceil((now.getTime() - new Date(row.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        const daysOverdue = isPaid ? 0 : Math.max(0, diffDays);

        if (isPaid) {
          initialStatus = 'paid';
        } else if (initialPaid > 0 && initialOutstanding > 0) {
          initialStatus = 'partially_paid';
        } else if (row.status === 'disputed') {
          initialStatus = 'disputed';
        } else if (row.status === 'promised') {
          initialStatus = 'promised';
        } else if (daysOverdue > 0) {
          initialStatus = 'overdue';
        } else {
          initialStatus = 'chasing';
        }

        const custId = customerIdByEmail.get(row.customerEmail) || null;

        toInsert.push({
          workspace_id: workspaceId,
          customer_id: custId,
          invoice_number: row.invoiceNumber,
          customer_name: row.customerName,
          customer_email: row.customerEmail,
          amount: row.amount,
          amount_paid: initialPaid,
          outstanding_amount: initialOutstanding,
          currency: row.currency,
          issue_date: row.issueDate,
          due_date: row.dueDate,
          paid_date: isPaid ? (row.paidDate || todayStr) : null,
          status: initialStatus,
          days_overdue: daysOverdue,
          collection_health: isPaid ? 100 : daysOverdue > 60 ? 20 : daysOverdue > 30 ? 45 : daysOverdue > 0 ? 70 : 95,
          health_category: isPaid ? 'low_risk' : daysOverdue > 60 ? 'high_risk' : daysOverdue > 0 ? 'medium_risk' : 'low_risk',
          health_reasons: isPaid ? ['Paid in full'] : daysOverdue > 0 ? [`${daysOverdue} days overdue`] : [`Due on ${row.dueDate}`],
          next_action: isPaid ? 'Payment verified. No chasing needed.' : daysOverdue > 0 ? 'Follow up on overdue balance' : `Scheduled due date reminder on ${row.dueDate}`,
          ai_recommendation: {
            actionType: isPaid ? 'wait_for_promise' : daysOverdue > 30 ? 'escalate' : 'followup',
            title: isPaid ? 'Settled' : `Follow-up for ${row.invoiceNumber}`,
            description: `Imported invoice for ${row.customerName} (${row.currency} ${initialOutstanding.toLocaleString()} outstanding).`,
            suggestedMessage: {
              subject: `Payment Follow-up: Invoice ${row.invoiceNumber}`,
              body: `Hi ${row.customerName.split(' ')[0]},\n\nFollowing up on invoice ${row.invoiceNumber} for ${row.currency} ${initialOutstanding.toLocaleString()} due on ${row.dueDate}.\n\nBest regards,`,
              rationale: 'Direct follow-up based on imported invoice record.',
            },
          },
          _rowNumber: row.index + 1,
        });
      }
    }

    // 6. Execute Writes to Supabase
    const errors: string[] = [];
    let insertedCount = 0;
    let updatedCount = 0;
    let failedCount = rowResults.filter((r) => r.status === 'rejected').length;

    if (toInsert.length > 0) {
      const insertPayload = toInsert.map(({ _rowNumber, ...fields }) => fields);
      const { data: insertedData, error: insErr } = await sb
        .from('invoices')
        .insert(insertPayload)
        .select('id, invoice_number');

      if (insErr) {
        errors.push(`Database error inserting invoices: ${insErr.message}`);
        toInsert.forEach((item) => {
          failedCount++;
          rowResults.push({
            rowNumber: item._rowNumber,
            invoiceNumber: item.invoice_number,
            customerName: item.customer_name,
            amount: item.amount,
            status: 'rejected',
            error: insErr.message,
          });
        });
      } else {
        insertedCount += toInsert.length;
        toInsert.forEach((item) => {
          rowResults.push({
            rowNumber: item._rowNumber,
            invoiceNumber: item.invoice_number,
            customerName: item.customer_name,
            amount: item.amount,
            status: 'inserted',
          });
        });

        // Add collection events for inserted invoices
        if (insertedData && insertedData.length > 0) {
          const events = insertedData.map((inv: any) => ({
            workspace_id: workspaceId,
            invoice_id: inv.id,
            type: 'invoice_created',
            title: `Invoice Imported (${options.fileName || 'file'})`,
            description: `Imported from ${options.fileName || 'file'} (Batch: ${options.batchId || 'default'})`,
            actor: 'user',
          }));
          try {
            await sb.from('collection_events').insert(events);
          } catch {
            // Non-critical event tracking fallback
          }
        }
      }
    }

    for (const updateOp of toUpdate) {
      const { error: updErr } = await sb
        .from('invoices')
        .update(updateOp.fields)
        .eq('id', updateOp.id)
        .eq('workspace_id', workspaceId);

      if (updErr) {
        errors.push(`Database error updating invoice ${updateOp.rowResult.invoiceNumber}: ${updErr.message}`);
        failedCount++;
        rowResults.push({
          ...updateOp.rowResult,
          status: 'rejected',
          error: updErr.message,
        });
      } else {
        updatedCount++;
        rowResults.push(updateOp.rowResult);
        try {
          await sb.from('collection_events').insert({
            workspace_id: workspaceId,
            invoice_id: updateOp.id,
            type: 'invoice_updated',
            title: `Invoice Updated via Import (${options.fileName || 'file'})`,
            description: `Invoice fields refreshed from ${options.fileName || 'import batch'}.`,
            badge: 'Import Update',
            actor: 'user',
            metadata: {
              batch_id: options.batchId,
              file_name: options.fileName,
            },
          });
        } catch {
          // Non-critical audit write fallback
        }
      }
    }

    return {
      success: errors.length === 0 && failedCount === 0,
      totalRows: invoices.length,
      importedCount: insertedCount + updatedCount,
      insertedCount,
      updatedCount,
      skippedCount,
      rejectedCount: failedCount,
      errors,
      rowResults,
    };
  }

  // Persist CSV Imported Invoices (Backward-compatible helper)
  async importInvoices(workspaceId: string, invoices: Invoice[]): Promise<void> {
    await this.importInvoicesBatch(workspaceId, invoices);
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

  // Update Workspace Business Identity & Settings
  async updateWorkspace(
    workspaceId: string,
    updates: Partial<Workspace> & {
      businessName?: string;
      businessType?: string;
      businessEmail?: string;
      country?: string;
      currency?: string;
      businessPhone?: string;
      website?: string;
      address?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      timezone?: string;
    }
  ): Promise<{ success: boolean; data?: any; error?: string; isPreview?: boolean }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return {
        success: false,
        error: 'Preview mode: changes are kept in local state only.',
        isPreview: true,
      };
    }

    try {
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.businessName !== undefined) dbUpdates.business_name = updates.businessName.trim();
      if (updates.businessType !== undefined) dbUpdates.business_type = updates.businessType.trim();
      if (updates.businessEmail !== undefined) dbUpdates.business_email = updates.businessEmail.trim();
      if (updates.country !== undefined) dbUpdates.country = updates.country.trim();
      if (updates.currency !== undefined) dbUpdates.currency = updates.currency.trim();
      if (updates.businessPhone !== undefined) dbUpdates.business_phone = updates.businessPhone.trim();
      if (updates.website !== undefined) dbUpdates.website = updates.website.trim();
      if (updates.address !== undefined) dbUpdates.address = updates.address.trim();
      if (updates.city !== undefined) dbUpdates.city = updates.city.trim();
      if (updates.state !== undefined) dbUpdates.state = updates.state.trim();
      if (updates.postalCode !== undefined) dbUpdates.postal_code = updates.postalCode.trim();
      if (updates.timezone !== undefined) dbUpdates.timezone = updates.timezone.trim();

      const { data, error } = await this.supabase
        .from('workspaces')
        .update(dbUpdates)
        .eq('id', workspaceId)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update workspace.' };
    }
  }

  // Update User Profile (Full Name, Phone, Avatar)
  async updateProfile(
    userId: string,
    updates: { fullName?: string; phone?: string; avatarUrl?: string }
  ): Promise<{ success: boolean; data?: any; error?: string; isPreview?: boolean }> {
    if (!isUuid(userId)) {
      return {
        success: false,
        error: 'A valid user UUID is required to update profile.',
      };
    }

    try {
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName.trim();
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone.trim();
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl.trim();

      const { data, error } = await this.supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Also update Supabase Auth user metadata
      if (updates.fullName || updates.phone) {
        await this.supabase.auth.updateUser({
          data: {
            full_name: updates.fullName?.trim(),
            phone: updates.phone?.trim(),
          },
        });
      }

      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update user profile.' };
    }
  }

  // Record Direct Manual Payment with Ledger Invariants (PMT-001)
  async recordDirectPayment(
    workspaceId: string,
    invoiceId: string,
    paidAmount: number,
    isFullSettlement: boolean = false
  ): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string; isPreview?: boolean }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return {
        success: false,
        error: 'Preview mode: changes are kept in local state only.',
        isPreview: true,
      };
    }

    if (!invoiceId || !isUuid(invoiceId)) {
      return { success: false, error: 'A valid invoice UUID is required.' };
    }

    const amt = Number(paidAmount);
    if (isNaN(amt) || amt <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' };
    }

    try {
      // 1. Fetch canonical invoice
      const { data: inv, error: invErr } = await this.supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (invErr || !inv) {
        return { success: false, error: 'Invoice not found in the authenticated workspace.' };
      }

      if (inv.status === 'cancelled' || inv.status === 'void') {
        return {
          success: false,
          errorCode: 'invoice_cancelled',
          error: `Invoice ${inv.invoice_number} is cancelled/void. Payments cannot be accepted on cancelled invoices.`,
        };
      }

      // 2. Fetch confirmed payments from payments table
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

      // Total invoice amount in cents/paisa
      const invTotalCents = Math.round(Number(inv.amount) * 100);
      const priorPaidCents = Math.round(priorConfirmedPaid * 100);

      if (priorPaidCents >= invTotalCents) {
        return {
          success: false,
          errorCode: 'invoice_already_settled',
          error: `Invoice ${inv.invoice_number} is already fully paid.`,
        };
      }

      const paymentCents = Math.round(amt * 100);
      if (priorPaidCents + paymentCents > invTotalCents) {
        const remainingAllowed = (invTotalCents - priorPaidCents) / 100;
        return {
          success: false,
          errorCode: 'payment_exceeds_total',
          error: `Payment amount (${inv.currency} ${amt.toLocaleString()}) exceeds the remaining balance (${inv.currency} ${remainingAllowed.toLocaleString()}).`,
        };
      }

      const newPaid = (priorPaidCents + paymentCents) / 100;
      const newOutstanding = Math.max(0, (invTotalCents - (priorPaidCents + paymentCents)) / 100);
      const newStatus = newOutstanding === 0 ? 'paid' : 'partially_paid';
      const todayStr = new Date().toISOString().split('T')[0];
      const nowStr = new Date().toISOString();

      // 3. Insert confirmed payment row into payments
      const { data: createdPayment, error: payErr } = await this.supabase
        .from('payments')
        .insert({
          workspace_id: workspaceId,
          invoice_id: invoiceId,
          customer_id: inv.customer_id,
          amount: amt,
          payment_date: todayStr,
          reference: `Manual direct payment recorded by operator`,
          source: 'manual_entry',
          status: 'confirmed',
        })
        .select()
        .single();

      if (payErr || !createdPayment) {
        return { success: false, error: payErr?.message || 'Failed to record payment in database.' };
      }

      // 4. Update invoice balances
      const { error: invUpdateErr } = await this.supabase
        .from('invoices')
        .update({
          amount_paid: newPaid,
          outstanding_amount: newOutstanding,
          status: newStatus,
          paid_date: newStatus === 'paid' ? todayStr : inv.paid_date,
          collection_health: newStatus === 'paid' ? 100 : (inv.collection_health ?? 60),
          health_category: newStatus === 'paid' ? 'low_risk' : (inv.health_category ?? 'medium_risk'),
          next_action: newStatus === 'paid' ? 'Payment confirmed. Chasing stopped.' : `Chase remaining ${inv.currency} ${newOutstanding.toLocaleString()}`,
          updated_at: nowStr,
        })
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId);

      if (invUpdateErr) {
        // Rollback payment insert
        await this.supabase.from('payments').delete().eq('id', createdPayment.id);
        return { success: false, error: `Failed to update invoice balance: ${invUpdateErr.message}` };
      }

      // 5. Insert collection event
      await this.supabase.from('collection_events').insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        type: newStatus === 'paid' ? 'payment_received' : 'partial_payment_received',
        title: newStatus === 'paid' ? 'Payment Confirmed & Verified ✅' : `Partial Payment of ${inv.currency} ${amt.toLocaleString()} Received`,
        description: newStatus === 'paid'
          ? `Full invoice balance of ${inv.currency} ${inv.amount.toLocaleString()} settled. Chasing stopped.`
          : `Received ${inv.currency} ${amt.toLocaleString()}. Remaining balance: ${inv.currency} ${newOutstanding.toLocaleString()}.`,
        badge: newStatus === 'paid' ? 'PAID & RECOVERED' : `PARTIAL (${inv.currency} ${amt.toLocaleString()})`,
        actor: 'user',
        metadata: { payment_id: createdPayment.id, amount: amt },
      });

      // 6. Fulfill promises sequentially based on cumulative unallocated verified funds
      const { data: allPromises } = await this.supabase
        .from('payment_promises')
        .select('id, promised_amount, promised_date, detected_at, status')
        .eq('invoice_id', invoiceId)
        .eq('workspace_id', workspaceId);

      const fulfilledPromiseIds: string[] = [];

      if (allPromises && allPromises.length > 0) {
        if (newStatus === 'paid') {
          for (const prom of allPromises.filter((p: any) => p.status === 'pending')) {
            await this.supabase
              .from('payment_promises')
              .update({ status: 'fulfilled', fulfilled_at: nowStr })
              .eq('id', prom.id);
            fulfilledPromiseIds.push(prom.id);
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
                .update({ status: 'fulfilled', fulfilled_at: nowStr })
                .eq('id', prom.id);
              fulfilledPromiseIds.push(prom.id);
              availableFunds -= promAmt;
            } else {
              break;
            }
          }
        }

        for (const pId of fulfilledPromiseIds) {
          try {
            await this.supabase.from('collection_events').insert({
              workspace_id: workspaceId,
              invoice_id: invoiceId,
              type: 'promise_fulfilled',
              title: 'Payment Promise Fulfilled ✅',
              description: 'Payment commitment was satisfied by verified incoming funds.',
              badge: 'PROMISE FULFILLED',
              actor: 'system',
              metadata: { promise_id: pId, payment_id: createdPayment.id },
            });
          } catch {
            // Non-critical audit write fallback
          }
        }
      }

      return {
        success: true,
        data: {
          invoiceId,
          amountPaid: newPaid,
          outstandingAmount: newOutstanding,
          status: newStatus,
          paymentId: createdPayment.id,
          fulfilledPromiseIds,
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unexpected failure recording payment.' };
    }
  }

  // Resume Collection Chasing for a Single Invoice
  async resumeInvoiceCollection(
    workspaceId: string,
    invoiceId: string
  ): Promise<{ success: boolean; data?: any; error?: string; isPreview?: boolean }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return { success: false, error: 'Preview mode: changes are kept in local state only.', isPreview: true };
    }
    if (!invoiceId || !isUuid(invoiceId)) {
      return { success: false, error: 'A valid invoice UUID is required.' };
    }

    try {
      const { data: inv, error: invErr } = await this.supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (invErr || !inv) {
        return { success: false, error: 'Invoice not found in the workspace.' };
      }

      if (inv.status === 'paid' || Number(inv.outstanding_amount ?? inv.amount) <= 0) {
        return { success: false, error: 'Invoice is already paid. Cannot resume collection on settled invoice.' };
      }
      if (inv.status === 'cancelled' || inv.status === 'void') {
        return { success: false, error: 'Invoice is cancelled. Cannot resume collection.' };
      }
      if (inv.status === 'disputed') {
        return { success: false, error: 'Invoice is disputed. Resolve dispute before resuming automated chasing.' };
      }

      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];
      const newReminders = (inv.reminders_sent || 0) + 1;

      const { data: updated, error: updateErr } = await this.supabase
        .from('invoices')
        .update({
          status: 'chasing',
          reminders_sent: newReminders,
          last_contact_date: todayStr,
          next_action: 'Automated follow-up in progress',
          updated_at: now,
        })
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      await this.supabase.from('collection_events').insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        type: 'reminder_sent',
        title: 'AI Collection Resumed',
        description: 'Personalized follow-up message queued and sent via AI follow-up engine.',
        badge: 'AI Chasing',
        actor: 'ai',
      });

      return { success: true, data: updated };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to resume collection.' };
    }
  }

  // Bulk Resume Collections for Overdue Invoices
  async resumeAllOverdueCollections(
    workspaceId: string
  ): Promise<{ success: boolean; data?: { updatedCount: number }; error?: string; isPreview?: boolean }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return { success: false, error: 'Preview mode: changes are kept in local state only.', isPreview: true };
    }

    try {
      const { data: overdueInvoices, error: fetchErr } = await this.supabase
        .from('invoices')
        .select('id, invoice_number, reminders_sent')
        .eq('workspace_id', workspaceId)
        .eq('status', 'overdue');

      if (fetchErr) {
        return { success: false, error: fetchErr.message };
      }

      if (!overdueInvoices || overdueInvoices.length === 0) {
        return { success: true, data: { updatedCount: 0 } };
      }

      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];
      let count = 0;

      for (const inv of overdueInvoices) {
        const { error: updErr } = await this.supabase
          .from('invoices')
          .update({
            status: 'chasing',
            reminders_sent: (inv.reminders_sent || 0) + 1,
            last_contact_date: todayStr,
            next_action: 'Automated follow-up in progress',
            updated_at: now,
          })
          .eq('id', inv.id)
          .eq('workspace_id', workspaceId);

        if (!updErr) {
          count++;
          await this.supabase.from('collection_events').insert({
            workspace_id: workspaceId,
            invoice_id: inv.id,
            type: 'reminder_sent',
            title: 'AI Chasing Activated',
            description: 'Resumed collection conversation via AI follow-up engine.',
            badge: 'Automated',
            actor: 'ai',
          });
        }
      }

      return { success: true, data: { updatedCount: count } };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to resume overdue collections.' };
    }
  }

  // Backward compatible wrapper
  async markInvoicePaid(invoiceId: string, paidAmount: number): Promise<void> {
    try {
      const { data: inv } = await this.supabase
        .from('invoices')
        .select('workspace_id')
        .eq('id', invoiceId)
        .maybeSingle();

      if (inv && inv.workspace_id) {
        await this.recordDirectPayment(inv.workspace_id, invoiceId, paidAmount);
      }
    } catch {
      // Graceful fallback
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
    isVerified: boolean,
    options?: {
      verifiedAmount?: number;
      transactionReference?: string;
      rejectionReason?: string;
    }
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
      // If operator entered a verified amount or transaction reference, update pending claim record before confirmation
      if (isVerified && (options?.verifiedAmount !== undefined || options?.transactionReference)) {
        const claimUpdates: any = {};
        if (options.verifiedAmount !== undefined && options.verifiedAmount > 0) {
          claimUpdates.amount = options.verifiedAmount;
        }
        if (options.transactionReference) {
          claimUpdates.reference = options.transactionReference;
        }
        await this.supabase
          .from('payments')
          .update(claimUpdates)
          .eq('workspace_id', workspaceId)
          .eq('invoice_id', invoiceId)
          .eq('source', 'customer_claim')
          .eq('status', 'pending_verification');
      }

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
        // Strictly restrict fallback to confirmed missing-function error codes in development-only environments.
        // No public or production environment variable can enable non-atomic fallback in production.
        if (rpcErr.code === 'PGRST202' || rpcErr.code === '42883') {
          const isDevelopment = process.env.NODE_ENV === 'development';

          // In production and all non-development environments, strictly fail closed if atomic RPC is missing!
          if (!isDevelopment) {
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
      const claimAmount =
        options?.verifiedAmount !== undefined && options.verifiedAmount > 0
          ? Number(options.verifiedAmount)
          : Number(pendingClaim.amount);

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
        const claimUpdatePayload: any = {
          status: 'confirmed',
          amount: claimAmount,
        };
        if (options?.transactionReference) {
          claimUpdatePayload.reference = options.transactionReference;
        }

        const { data: updatedClaim, error: updateClaimErr } = await this.supabase
          .from('payments')
          .update(claimUpdatePayload)
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

        const fulfilledPromiseIds: string[] = [];

        if (allPromises && allPromises.length > 0) {
          if (newStatus === 'paid') {
            for (const prom of allPromises.filter((p: any) => p.status === 'pending')) {
              await this.supabase
                .from('payment_promises')
                .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
                .eq('id', prom.id);
              fulfilledPromiseIds.push(prom.id);
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
                fulfilledPromiseIds.push(prom.id);
                availableFunds -= promAmt;
              } else {
                // Earliest commitment unsatisfied; stop sequential allocation
                break;
              }
            }
          }

          for (const pId of fulfilledPromiseIds) {
            try {
              await this.supabase.from('collection_events').insert({
                workspace_id: workspaceId,
                invoice_id: invoiceId,
                type: 'promise_fulfilled',
                title: 'Payment Promise Fulfilled ✅',
                description: 'Payment commitment was satisfied by verified incoming funds.',
                badge: 'PROMISE FULFILLED',
                actor: 'system',
                metadata: { promise_id: pId, claim_id: pendingClaim.id },
              });
            } catch {
              // Non-critical audit write fallback
            }
          }
        }

        return {
          success: true,
          data: {
            status: newStatus,
            amountPaid: newPaid,
            outstandingAmount: newOutstanding,
            fulfilledPromiseIds,
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

        const rejectionNote =
          options?.rejectionReason || 'Payment claim unconfirmed in bank. Follow-up resumed.';

        await this.supabase
          .from('invoices')
          .update({
            next_action: rejectionNote,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)
          .eq('workspace_id', workspaceId);

        await this.supabase.from('collection_events').insert({
          workspace_id: workspaceId,
          invoice_id: invoiceId,
          type: 'escalation_triggered',
          title: 'Payment Claim Rejected ❌',
          description: rejectionNote,
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

  // Record Invoice Dispute with Audit Logging
  async recordDispute(
    workspaceId: string,
    invoiceId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return { success: false, error: 'Preview mode: changes are kept in local state only.' };
    }

    try {
      const { data: inv, error: fetchErr } = await this.supabase
        .from('invoices')
        .select('id, invoice_number, currency, amount')
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId)
        .single();

      if (fetchErr || !inv) {
        return { success: false, error: 'Invoice not found or access denied.' };
      }

      const disputeNote = reason || 'Customer queried or disputed invoice balance.';
      const { error: updErr } = await this.supabase
        .from('invoices')
        .update({
          status: 'disputed',
          next_action: 'Billing Dispute Mediation (Automated Reminders Paused)',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId);

      if (updErr) {
        return { success: false, error: updErr.message };
      }

      // Record audit event in collection_events
      await this.supabase.from('collection_events').insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        type: 'dispute_opened',
        title: 'Billing Dispute Raised ⚠️',
        description: disputeNote,
        badge: 'DISPUTE',
        actor: 'user',
        metadata: {
          reason: disputeNote,
          invoice_number: inv.invoice_number,
        },
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to record dispute.' };
    }
  }

  // Resolve Invoice Dispute with Audit Logging
  async resolveDispute(
    workspaceId: string,
    invoiceId: string,
    resolutionNote?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return { success: false, error: 'Preview mode: changes are kept in local state only.' };
    }

    try {
      const { data: inv, error: fetchErr } = await this.supabase
        .from('invoices')
        .select('id, invoice_number, currency, amount')
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId)
        .single();

      if (fetchErr || !inv) {
        return { success: false, error: 'Invoice not found or access denied.' };
      }

      const note = resolutionNote || 'Dispute resolved with customer. Collection resumed.';
      const { error: updErr } = await this.supabase
        .from('invoices')
        .update({
          status: 'chasing',
          next_action: 'Dispute resolved. Automated collection resumed.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId);

      if (updErr) {
        return { success: false, error: updErr.message };
      }

      // Record audit event in collection_events
      await this.supabase.from('collection_events').insert({
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        type: 'dispute_resolved',
        title: 'Billing Dispute Resolved ✅',
        description: note,
        badge: 'DISPUTE RESOLVED',
        actor: 'user',
        metadata: {
          resolution_note: note,
          invoice_number: inv.invoice_number,
        },
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to resolve dispute.' };
    }
  }

  // Fetch Workspace Collection Events directly (Bounded Audit Trail Query)
  async fetchCollectionEvents(
    workspaceId: string,
    options?: { limit?: number; offset?: number; type?: string }
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    if (!isUuid(workspaceId) || workspaceId === 'ws-default') {
      return { success: true, data: [] };
    }

    try {
      let query = this.supabase
        .from('collection_events')
        .select('id, workspace_id, invoice_id, timestamp, type, title, description, badge, actor, metadata')
        .eq('workspace_id', workspaceId)
        .order('timestamp', { ascending: false });

      if (options?.type && options.type !== 'all') {
        query = query.eq('type', options.type);
      }

      const limit = Math.min(200, Math.max(1, options?.limit || 100));
      query = query.limit(limit);

      if (options?.offset && options.offset > 0) {
        query = query.range(options.offset, options.offset + limit - 1);
      }

      const { data, error } = await query;
      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch audit events.' };
    }
  }
}

export const accountService = AccountService.getInstance();
