import {
  Invoice,
  Customer,
  PaymentPromise,
  AiDecision,
  DecisionAction,
  DecisionPriority,
  DecisionTone,
  WhyUnpaidDiagnosis,
  CollectionCategory,
  isCollectibleStatus,
  CustomerReliabilityAssessment,
  ReliabilityTier,
} from '../types';

/**
 * AI Collection Decision Engine
 * Deterministic, evidence-based collection decision making.
 * Evaluates active invoices and produces exactly ONE primary next-best action.
 */

export function evaluateInvoiceDecision(
  invoice: Invoice,
  customer?: Customer,
  promises: PaymentPromise[] = []
): AiDecision {
  const outstanding = invoice.outstandingAmount !== undefined ? invoice.outstandingAmount : Math.max(0, invoice.amount - (invoice.paidAmount || 0));
  const currencySymbol = invoice.currency?.includes('INR') || invoice.currency === 'INR' ? '₹' : '$';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  const custFirstName = (invoice.customerName || 'Customer').trim().split(' ')[0] || 'Customer';

  const relatedPromises = promises.filter((p) => p.invoiceId === invoice.id);
  const activePromise = relatedPromises.find((p) => (p.status === 'ACTIVE' || p.status === 'pending') && p.promisedDate >= todayStr);
  const brokenPromise = relatedPromises.find((p) => p.status === 'BROKEN' || p.status === 'missed' || ((p.status === 'ACTIVE' || p.status === 'pending') && p.promisedDate < todayStr));

  // 1. Fully Paid State -> STOP
  if (invoice.status === 'paid' || outstanding <= 0) {
    return {
      id: `dec-${invoice.id}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      amount: invoice.amount,
      outstandingAmount: 0,
      currency: invoice.currency,
      action: 'STOP',
      reason: 'Payment confirmed and verified. Automated chasing stopped.',
      evidence: `Full amount of ${currencySymbol}${invoice.amount.toLocaleString()} was verified on ${invoice.paidDate || todayStr}.`,
      confidence: 100,
      priority: 'LOW',
      recommendedTiming: 'Immediate',
      recommendedChannel: 'Email',
      recommendedTone: 'Gentle',
      suggestedMessage: {
        subject: `Payment Receipt: Invoice ${invoice.invoiceNumber}`,
        body: `Thank you for your payment of ${currencySymbol}${invoice.amount.toLocaleString()} for invoice ${invoice.invoiceNumber}. Your account is fully settled.`,
        rationale: 'Confirmation of payment receipt.',
      },
      status: 'EXECUTED',
      createdAt: todayStr,
      executedAt: todayStr,
    };
  }

  // 1b. Cancelled, Void, or Draft Invoice -> STOP
  if (invoice.status === 'cancelled' || invoice.status === 'void' || invoice.status === 'draft') {
    const isDraft = invoice.status === 'draft';
    return {
      id: `dec-${invoice.id}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      amount: invoice.amount,
      outstandingAmount: isDraft ? 0 : outstanding,
      currency: invoice.currency,
      action: 'STOP',
      reason: isDraft
        ? 'Invoice is in draft status. Automated collection activities are disabled until the invoice is issued.'
        : `Invoice is ${invoice.status}. All automated collection activities, reminders, and escalation workflows are permanently halted.`,
      evidence: isDraft
        ? 'Invoice status is DRAFT. No customer communication or chasing permitted.'
        : `Invoice status is officially marked as ${invoice.status.toUpperCase()}. No financial claim is active.`,
      confidence: 100,
      priority: 'LOW',
      recommendedTiming: 'Immediate',
      recommendedChannel: 'Email',
      recommendedTone: 'Professional',
      suggestedMessage: {
        subject: isDraft ? `Draft: Invoice ${invoice.invoiceNumber}` : `Notice: Invoice ${invoice.invoiceNumber} Cancelled`,
        body: isDraft
          ? `Invoice ${invoice.invoiceNumber} is currently in draft status.`
          : `Hi ${custFirstName},\n\nPlease note that invoice ${invoice.invoiceNumber} has been marked as ${invoice.status}. No payment is due for this record.\n\nBest regards,`,
        rationale: isDraft ? 'Draft invoice placeholder.' : 'Formal notice that invoice is void/cancelled.',
      },
      status: 'EXECUTED',
      createdAt: todayStr,
      executedAt: todayStr,
    };
  }

  // 1c. On-Hold / Suspended Invoice -> WAIT
  if (invoice.status === 'held' || invoice.status === 'on_hold') {
    return {
      id: `dec-${invoice.id}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      amount: invoice.amount,
      outstandingAmount: outstanding,
      currency: invoice.currency,
      action: 'WAIT',
      reason: 'Invoice is currently on administrative hold. Automated communications and reminders are paused pending internal review.',
      evidence: `Administrative hold flag active on invoice ${invoice.invoiceNumber}. Customer contact blocked.`,
      confidence: 95,
      priority: 'LOW',
      recommendedTiming: 'Upon hold release',
      recommendedChannel: 'Email',
      recommendedTone: 'Professional',
      suggestedMessage: {
        subject: `Administrative Notice: Invoice ${invoice.invoiceNumber}`,
        body: `Hi ${custFirstName},\n\nOur finance operations team has placed invoice ${invoice.invoiceNumber} on administrative review. Chasing is temporarily paused.\n\nBest regards,`,
        rationale: 'Informative notice during account hold period.',
      },
      status: 'PENDING',
      createdAt: todayStr,
    };
  }

  // 2. Customer Claims Payment Made (Unverified) -> HUMAN / VERIFY
  if (invoice.paymentClaimStatus === 'CLAIMED') {
    return {
      id: `dec-${invoice.id}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      amount: invoice.amount,
      outstandingAmount: outstanding,
      currency: invoice.currency,
      action: 'HUMAN',
      reason: 'Customer claims payment has been released. Bank verification required before updating accounts.',
      evidence: invoice.paymentClaimNote || `Customer stated payment was completed. Claimed on ${invoice.paymentClaimedAt || todayStr}.`,
      confidence: 88,
      priority: 'HIGH',
      recommendedTiming: 'Today',
      recommendedChannel: 'Phone',
      recommendedTone: 'Professional',
      suggestedMessage: {
        subject: `Payment Verification: Invoice ${invoice.invoiceNumber}`,
        body: `Hi ${custFirstName},\n\nWe received your note that payment for invoice ${invoice.invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()}) was released. Our accounts team is checking our bank feed and will confirm once credited.\n\nBest regards,`,
        rationale: 'Polite acknowledgment while awaiting verified banking receipt.',
      },
      status: 'PENDING',
      createdAt: todayStr,
    };
  }

  // 3. Billing Dispute Raised -> HUMAN
  if (invoice.status === 'disputed' || invoice.collectionCategory === 'DISPUTERS' || invoice.lastReplyIntent === 'DISPUTE') {
    return {
      id: `dec-${invoice.id}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      amount: invoice.amount,
      outstandingAmount: outstanding,
      currency: invoice.currency,
      action: 'HUMAN',
      reason: 'Customer raised a billing dispute or query regarding deliverables. Manual mediation required.',
      evidence: invoice.lastCustomerReply || 'Customer disputed invoice calculations or project scope.',
      confidence: 94,
      priority: 'HIGH',
      recommendedTiming: 'Immediate',
      recommendedChannel: 'Phone',
      recommendedTone: 'Professional',
      suggestedMessage: {
        subject: `Regarding your query on Invoice ${invoice.invoiceNumber}`,
        body: `Hi ${custFirstName},\n\nThank you for reaching out regarding invoice ${invoice.invoiceNumber}. Our operations lead will connect with you today to address your query and ensure everything is aligned.\n\nBest regards,`,
        rationale: 'De-escalates tension and initiates direct human resolution.',
      },
      status: 'PENDING',
      createdAt: todayStr,
    };
  }

  // 4. Broken Payment Promise -> FOLLOW_UP or ESCALATE
  if (brokenPromise || (invoice.promisedPaymentDate && invoice.promisedPaymentDate < todayStr && invoice.status === 'promised')) {
    const isRepeated = (customer?.missedPromisesCount || 0) >= 2 || (invoice.missedPromisesCount || 0) >= 2;
    const action: DecisionAction = isRepeated ? 'ESCALATE' : 'FOLLOW_UP';
    const priority: DecisionPriority = 'HIGH';
    const tone: DecisionTone = isRepeated ? 'Firm' : 'Professional';
    const pDate = brokenPromise?.promisedDate || invoice.promisedPaymentDate || 'recent date';
    const pAmt = brokenPromise?.amount || outstanding;

    return {
      id: `dec-${invoice.id}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      amount: invoice.amount,
      outstandingAmount: outstanding,
      currency: invoice.currency,
      action,
      reason: isRepeated
        ? `Customer broke ${customer?.missedPromisesCount || 2} payment commitments. High risk of continued default.`
        : `Customer committed to pay ${currencySymbol}${pAmt.toLocaleString()} by ${pDate}, but payment was not verified.`,
      evidence: `Promised on ${pDate} (${brokenPromise?.quoteText || 'Customer committed date'}). No payment recorded on or before due date.`,
      confidence: 92,
      priority,
      recommendedTiming: 'Today',
      recommendedChannel: customer?.preferredChannel || 'Email',
      recommendedTone: tone,
      suggestedMessage: {
        subject: `Follow-up on Missed Commitment: Invoice ${invoice.invoiceNumber}`,
        body: `Hi ${custFirstName},\n\nFollowing up on our previous conversation regarding invoice ${invoice.invoiceNumber} for ${currencySymbol}${outstanding.toLocaleString()}.\n\nYou had indicated that payment would be completed by ${pDate}, but we have not yet received confirmation of receipt.\n\nPlease let us know if the payment was initiated, or provide an updated transaction reference today.\n\nBest regards,`,
        rationale: 'Directly references customer commitment without generic reminder phrasing.',
      },
      status: 'PENDING',
      createdAt: todayStr,
    };
  }

  // 5. Active Payment Promise in Future -> WAIT
  if (activePromise || (invoice.promisedPaymentDate && invoice.promisedPaymentDate >= todayStr)) {
    const pDate = activePromise?.promisedDate || invoice.promisedPaymentDate || 'the committed date';
    const pAmt = activePromise?.amount || outstanding;
    return {
      id: `dec-${invoice.id}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      amount: invoice.amount,
      outstandingAmount: outstanding,
      currency: invoice.currency,
      action: 'WAIT',
      reason: `Customer committed to pay ${currencySymbol}${pAmt.toLocaleString()} by ${pDate}. Grace period active.`,
      evidence: `Active promise: "${activePromise?.quoteText || 'Committed payment by ' + pDate}" detected.`,
      confidence: 89,
      priority: 'LOW',
      recommendedTiming: `After ${pDate}`,
      recommendedChannel: customer?.preferredChannel || 'Email',
      recommendedTone: 'Gentle',
      suggestedMessage: {
        subject: `Payment Reminder: Invoice ${invoice.invoiceNumber}`,
        body: `Hi ${custFirstName},\n\nGentle check-in regarding the planned payment for invoice ${invoice.invoiceNumber} committed for ${pDate}.\n\nThank you for your cooperation.`,
        rationale: 'Courtesy message only if triggered after grace period.',
      },
      status: 'PENDING',
      createdAt: todayStr,
    };
  }

  // 6. Ghosting Customer (Multiple follow-ups, 0 replies) -> ESCALATE / HUMAN
  if (invoice.remindersSent >= 4 && invoice.customerRepliesCount === 0) {
    return {
      id: `dec-${invoice.id}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      amount: invoice.amount,
      outstandingAmount: outstanding,
      currency: invoice.currency,
      action: 'ESCALATE',
      reason: `Customer has not responded after ${invoice.remindersSent} outreach attempts over ${invoice.daysOverdue} days.`,
      evidence: `Zero customer replies received to email outreach since ${invoice.issueDate}.`,
      confidence: 91,
      priority: 'HIGH',
      recommendedTiming: 'Today',
      recommendedChannel: 'Phone',
      recommendedTone: 'Firm',
      suggestedMessage: {
        subject: `URGENT: Urgent Attention Required - Invoice ${invoice.invoiceNumber}`,
        body: `Hi ${custFirstName},\n\nWe have attempted to reach you multiple times regarding overdue invoice ${invoice.invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()}) without a response.\n\nPlease contact our finance office today to arrange settlement or clarify any outstanding issues to prevent further escalation.\n\nBest regards,`,
        rationale: 'Direct outreach for non-responsive accounts.',
      },
      status: 'PENDING',
      createdAt: todayStr,
    };
  }

  // 7. Pre-due or Due Today (daysOverdue <= 0)
  if (invoice.daysOverdue <= 0) {
    const isChronicLate = (customer?.avgPaymentDelayDays || 0) > 15;
    if (isChronicLate) {
      return {
        id: `dec-${invoice.id}`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        amount: invoice.amount,
        outstandingAmount: outstanding,
        currency: invoice.currency,
        action: 'NUDGE',
        reason: `Invoice due in ${Math.abs(invoice.daysOverdue)} days. Customer historically requires approval lead time (avg ${customer?.avgPaymentDelayDays} days delay).`,
        evidence: `Customer payment memory: ${customer?.paymentPersonality || 'Frequently delayed approvals'}.`,
        confidence: 84,
        priority: 'MEDIUM',
        recommendedTiming: 'Today',
        recommendedChannel: customer?.preferredChannel || 'Email',
        recommendedTone: 'Gentle',
        suggestedMessage: {
          subject: `Upcoming Due Date: Invoice ${invoice.invoiceNumber}`,
          body: `Hi ${custFirstName},\n\nThis is a friendly reminder that invoice ${invoice.invoiceNumber} for ${currencySymbol}${outstanding.toLocaleString()} is due on ${invoice.dueDate}.\n\nPlease let us know if you need any additional invoice copies or purchase order confirmations to facilitate processing.\n\nBest regards,`,
          rationale: 'Early nudge to account for known approval lags.',
        },
        status: 'PENDING',
        createdAt: todayStr,
      };
    } else {
      return {
        id: `dec-${invoice.id}`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        amount: invoice.amount,
        outstandingAmount: outstanding,
        currency: invoice.currency,
        action: 'WAIT',
        reason: `Invoice is not overdue (due on ${invoice.dueDate}). Customer maintains reliable payment history.`,
        evidence: `Customer has paid ${customer?.totalPaid ? currencySymbol + customer.totalPaid.toLocaleString() : 'consistently on time'} with low delay history.`,
        confidence: 90,
        priority: 'LOW',
        recommendedTiming: `On ${invoice.dueDate}`,
        recommendedChannel: 'Email',
        recommendedTone: 'Gentle',
        suggestedMessage: {
          subject: `Invoice ${invoice.invoiceNumber} Reminder`,
          body: `Hi ${custFirstName},\n\nGentle note regarding invoice ${invoice.invoiceNumber} due on ${invoice.dueDate}.\n\nThank you for your business.`,
          rationale: 'Scheduled due-date reminder.',
        },
        status: 'PENDING',
        createdAt: todayStr,
      };
    }
  }

  // 8. Overdue Invoices (> 0 days)
  const isHighValue = outstanding >= 100000;
  const isLongOverdue = invoice.daysOverdue >= 14;

  if (isLongOverdue || (isHighValue && invoice.daysOverdue >= 7)) {
    const action: DecisionAction = isLongOverdue && isHighValue ? 'ESCALATE' : 'FOLLOW_UP';
    const tone: DecisionTone = isLongOverdue ? 'Firm' : 'Professional';
    const priority: DecisionPriority = 'HIGH';

    return {
      id: `dec-${invoice.id}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      amount: invoice.amount,
      outstandingAmount: outstanding,
      currency: invoice.currency,
      action,
      reason: `Invoice is ${invoice.daysOverdue} days past due with ${currencySymbol}${outstanding.toLocaleString()} outstanding balance.`,
      evidence: `Due on ${invoice.dueDate}. ${invoice.remindersSent} previous communications sent.`,
      confidence: 88,
      priority,
      recommendedTiming: 'Today',
      recommendedChannel: customer?.preferredChannel || 'Email',
      recommendedTone: tone,
      suggestedMessage: {
        subject: `Overdue Payment Notice: Invoice ${invoice.invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()})`,
        body: `Hi ${custFirstName},\n\nWe are following up regarding invoice ${invoice.invoiceNumber}, which is now ${invoice.daysOverdue} days past due.\n\nThe outstanding balance is ${currencySymbol}${outstanding.toLocaleString()}.\n\nPlease arrange for settlement at your earliest convenience or reply with your payment schedule.\n\nBest regards,`,
        rationale: 'Standard overdue collection follow-up.',
      },
      status: 'PENDING',
      createdAt: todayStr,
    };
  }

  // 9. Early Overdue (1 - 6 days)
  return {
    id: `dec-${invoice.id}`,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    amount: invoice.amount,
    outstandingAmount: outstanding,
    currency: invoice.currency,
    action: 'NUDGE',
    reason: `Invoice is recently overdue by ${invoice.daysOverdue} days. Send polite follow-up.`,
    evidence: `Due date was ${invoice.dueDate}. Current outstanding is ${currencySymbol}${outstanding.toLocaleString()}.`,
    confidence: 85,
    priority: 'MEDIUM',
    recommendedTiming: 'Today',
    recommendedChannel: customer?.preferredChannel || 'Email',
    recommendedTone: 'Gentle',
    suggestedMessage: {
      subject: `Friendly Follow-up: Invoice ${invoice.invoiceNumber}`,
      body: `Hi ${custFirstName},\n\nHope all is well. Just a quick reminder that invoice ${invoice.invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()}) was due on ${invoice.dueDate}.\n\nPlease let us know when we can expect payment.\n\nThank you!`,
      rationale: 'Gentle initial overdue check-in.',
    },
    status: 'PENDING',
    createdAt: todayStr,
  };
}

/**
 * "Why Isn't This Invoice Paid?" Diagnostic Analyzer
 * Grounds explanation in actual customer replies, promises, claims, and timing.
 */
export function getWhyUnpaidDiagnosis(
  invoice: Invoice,
  customer?: Customer,
  promises: PaymentPromise[] = []
): WhyUnpaidDiagnosis {
  const currencySymbol = invoice.currency.includes('INR') || invoice.currency === 'INR' ? '₹' : '$';
  const relatedPromises = promises.filter((p) => p.invoiceId === invoice.id);
  const brokenPromise = relatedPromises.find((p) => p.status === 'BROKEN' || p.status === 'missed');
  const activePromise = relatedPromises.find((p) => p.status === 'ACTIVE' || p.status === 'pending');

  // Case 1: Payment Claimed
  if (invoice.paymentClaimStatus === 'CLAIMED') {
    return {
      likelyReason: 'Payment claimed by customer — pending payment verification',
      evidence: invoice.paymentClaimNote || 'Customer reported payment has been initiated via bank transfer.',
      confidence: 85,
      recommendedAction: 'Verify transaction receipt before closing collection.',
    };
  }

  // Case 2: Billing Dispute
  if (invoice.status === 'disputed' || invoice.collectionCategory === 'DISPUTERS' || invoice.lastReplyIntent === 'DISPUTE') {
    return {
      likelyReason: 'Invoice / deliverable dispute raised',
      evidence: invoice.lastCustomerReply || 'Customer requested clarification on scope or billing rates.',
      confidence: 93,
      recommendedAction: 'Coordinate between project manager and finance team to resolve query.',
    };
  }

  // Case 3: Broken Promise
  if (brokenPromise) {
    return {
      likelyReason: 'Payment commitment missed by customer',
      evidence: `Customer promised ${currencySymbol}${brokenPromise.amount.toLocaleString()} by ${brokenPromise.promisedDate}, but funds were not credited.`,
      confidence: 91,
      recommendedAction: 'Send targeted follow-up specifically referencing the missed commitment date.',
    };
  }

  // Case 4: Active Promise
  if (activePromise) {
    return {
      likelyReason: 'Payment scheduled under active customer commitment',
      evidence: `Customer indicated payment of ${currencySymbol}${activePromise.amount.toLocaleString()} on ${activePromise.promisedDate}.`,
      confidence: 88,
      recommendedAction: 'Hold automated reminders until commitment date expires.',
    };
  }

  // Case 5: Partial Payment Received
  if (invoice.status === 'partially_paid' || (invoice.paidAmount && invoice.paidAmount > 0)) {
    const outstanding = invoice.outstandingAmount || (invoice.amount - (invoice.paidAmount || 0));
    return {
      likelyReason: 'Partial payment received — remaining balance unpaid',
      evidence: `${currencySymbol}${(invoice.paidAmount || 0).toLocaleString()} received; ${currencySymbol}${outstanding.toLocaleString()} balance remaining.`,
      confidence: 96,
      recommendedAction: `Chase only remaining balance of ${currencySymbol}${outstanding.toLocaleString()}.`,
    };
  }

  // Case 6: Ghosting / No response
  if (invoice.remindersSent >= 3 && invoice.customerRepliesCount === 0) {
    return {
      likelyReason: 'Customer non-responsive to digital outreach',
      evidence: `${invoice.remindersSent} reminders sent with zero replies received.`,
      confidence: 89,
      recommendedAction: 'Switch communication channel (e.g., direct phone call or executive outreach).',
    };
  }

  // Case 7: Typical Internal Approval Delay
  if (customer?.typicalBlocker) {
    return {
      likelyReason: customer.typicalBlocker,
      evidence: `Customer payment profile shows average delay of ${customer.avgPaymentDelayDays} days for approval cycles.`,
      confidence: 82,
      recommendedAction: 'Request a specific committed date from the finance team.',
    };
  }

  // Default: Overdue without specific explanation
  if (invoice.daysOverdue > 0) {
    return {
      likelyReason: 'Routine payment delay / unconfirmed invoice receipt',
      evidence: `Invoice overdue by ${invoice.daysOverdue} days with ${invoice.remindersSent} reminder(s) dispatched.`,
      confidence: 76,
      recommendedAction: 'Send polite follow-up requesting payment status update.',
    };
  }

  return {
    likelyReason: 'Invoice within standard payment term',
    evidence: `Due on ${invoice.dueDate} (${Math.abs(invoice.daysOverdue)} days remaining).`,
    confidence: 90,
    recommendedAction: 'No immediate collection action required.',
  };
}

/**
 * "What Should I Chase Today?" Prioritization Engine
 * Scores and ranks invoices that require human or automated attention today.
 */
export function getWhatToChaseToday(
  invoices: Invoice[],
  customers: Customer[],
  promises: PaymentPromise[] = []
): Array<{
  invoice: Invoice;
  decision: AiDecision;
  priorityScore: number;
  urgencyLabel: 'HIGH PRIORITY' | 'MEDIUM PRIORITY' | 'LOW PRIORITY';
  reason: string;
}> {
  const custMap = new Map<string, Customer>();
  customers.forEach((c) => custMap.set(c.id, c));

  const items = invoices
    .filter((inv) => isCollectibleStatus(inv.status) && (inv.outstandingAmount === undefined || inv.outstandingAmount > 0))
    .map((inv) => {
      const cust = custMap.get(inv.customerId);
      const decision = evaluateInvoiceDecision(inv, cust, promises);
      const outstanding = inv.outstandingAmount !== undefined ? inv.outstandingAmount : Math.max(0, inv.amount - (inv.paidAmount || 0));

      // Calculate Priority Score (Deterministic)
      let score = 0;

      // 1. Broken promise penalty (+50 points)
      if (decision.action === 'ESCALATE' || decision.reason.includes('broke') || decision.reason.includes('missed')) {
        score += 50;
      }

      // 2. Unverified claim needing human verification (+45 points)
      if (inv.paymentClaimStatus === 'CLAIMED' || decision.action === 'HUMAN') {
        score += 45;
      }

      // 3. Outstanding Amount Impact
      if (outstanding >= 200000) score += 35;
      else if (outstanding >= 100000) score += 25;
      else if (outstanding >= 50000) score += 15;
      else score += 5;

      // 4. Overdue Severity
      if (inv.daysOverdue > 30) score += 30;
      else if (inv.daysOverdue > 14) score += 20;
      else if (inv.daysOverdue > 7) score += 10;
      else if (inv.daysOverdue > 0) score += 5;

      // 5. Ghosting penalty
      if (inv.remindersSent >= 3 && inv.customerRepliesCount === 0) {
        score += 20;
      }

      // 6. Active promise holds deduction
      if (decision.action === 'WAIT') {
        score -= 40;
      }

      let urgencyLabel: 'HIGH PRIORITY' | 'MEDIUM PRIORITY' | 'LOW PRIORITY' = 'LOW PRIORITY';
      if (score >= 50) urgencyLabel = 'HIGH PRIORITY';
      else if (score >= 25) urgencyLabel = 'MEDIUM PRIORITY';

      return {
        invoice: inv,
        decision,
        priorityScore: score,
        urgencyLabel,
        reason: decision.reason,
      };
    })
    .filter((item) => item.decision.action !== 'STOP')
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return items;
}

/**
 * Categorizes an invoice into Exception Groups
 */
export function classifyInvoiceCategory(
  invoice: Invoice,
  promises: PaymentPromise[] = []
): CollectionCategory {
  if (invoice.status === 'disputed' || invoice.lastReplyIntent === 'DISPUTE') {
    return 'DISPUTERS';
  }

  const relatedPromises = promises.filter((p) => p.invoiceId === invoice.id);
  const hasPromise = relatedPromises.some((p) => p.status === 'ACTIVE' || p.status === 'pending' || p.status === 'BROKEN' || p.status === 'missed');
  if (hasPromise || invoice.promisedPaymentDate || invoice.status === 'promised') {
    return 'PROMISERS';
  }

  if (invoice.remindersSent >= 3 && invoice.customerRepliesCount === 0 && invoice.daysOverdue > 7) {
    return 'GHOSTERS';
  }

  return 'ACTIVE';
}

/**
 * Reconciles payment promises against verified payment events.
 *
 * Rules:
 * 1. An invoice settled in full (outstanding <= 0 or isFullySettled) fulfills all remaining pending/active promises for that invoice.
 * 2. Partial payments allocate cumulative confirmed funds sequentially to pending promises ordered by promisedDate ASC, detectedAt ASC, id ASC.
 * 3. A promise is fulfilled only if unallocated cumulative funds cover the full promised amount.
 * 4. Promises belonging to other invoices, customers, or workspaces are completely untouched.
 */
export function reconcilePromisesWithPayment(
  promises: PaymentPromise[],
  invoiceId: string,
  newCumulativePaid: number,
  isFullySettled: boolean
): { updatedPromises: PaymentPromise[]; newlyFulfilledIds: string[] } {
  const newlyFulfilledIds: string[] = [];

  if (isFullySettled) {
    const updatedPromises = promises.map((p) => {
      if (p.invoiceId === invoiceId && (p.status === 'ACTIVE' || p.status === 'pending')) {
        newlyFulfilledIds.push(p.id);
        return {
          ...p,
          status: 'FULFILLED' as const,
        };
      }
      return p;
    });
    return { updatedPromises, newlyFulfilledIds };
  }

  // Calculate cumulative funds already consumed by fulfilled promises on this invoice
  const fulfilledConsumed = promises
    .filter((p) => p.invoiceId === invoiceId && (p.status === 'FULFILLED' || p.status === 'fulfilled'))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  let availableFunds = Math.max(0, newCumulativePaid - fulfilledConsumed);

  // Sequential evaluation of pending commitments
  const pendingForInvoice = promises
    .filter((p) => p.invoiceId === invoiceId && (p.status === 'ACTIVE' || p.status === 'pending'))
    .sort((a, b) => {
      const dateCmp = (a.promisedDate || '').localeCompare(b.promisedDate || '');
      if (dateCmp !== 0) return dateCmp;
      const detCmp = (a.detectedAt || '').localeCompare(b.detectedAt || '');
      if (detCmp !== 0) return detCmp;
      return (a.id || '').localeCompare(b.id || '');
    });

  const fulfillSet = new Set<string>();
  for (const prom of pendingForInvoice) {
    const promAmt = Number(prom.amount);
    if (availableFunds >= promAmt) {
      fulfillSet.add(prom.id);
      newlyFulfilledIds.push(prom.id);
      availableFunds -= promAmt;
    } else {
      // Unallocated funds cannot satisfy this commitment; stop sequential allocation
      break;
    }
  }

  const updatedPromises = promises.map((p) => {
    if (fulfillSet.has(p.id)) {
      return {
        ...p,
        status: 'FULFILLED' as const,
      };
    }
    return p;
  });

  return { updatedPromises, newlyFulfilledIds };
}

/**
 * Computes a grounded, deterministic Customer Payment Reliability Assessment.
 *
 * Rules:
 * 1. Only verified and confirmed transactions count (invoices with paid status or confirmed paidAmount > 0).
 * 2. Unverified claims (CLAIMED) and rejected claims do not count as paid or on-time.
 * 3. Open billing disputes are tracked transparently but not treated as customer unreliability.
 * 4. Promises within grace period (promisedDate >= today) are not marked missed.
 * 5. Requires at least 2 completed events (settled invoices or resolved promises) for a numerical score;
 *    otherwise returns neutral tier 'INSUFFICIENT_HISTORY' with score: null.
 * 6. Repeated evaluations on the same immutable data produce the exact same deterministic score and factors.
 * 7. Never mutates invoice balances, ledgers, or promise statuses.
 */
export function computeCustomerPaymentReliability(
  customer: Customer,
  invoices: Invoice[] = [],
  promises: PaymentPromise[] = [],
  todayStr?: string
): CustomerReliabilityAssessment {
  const now = todayStr || new Date().toISOString().split('T')[0];

  // 1. Filter and deduplicate invoices belonging strictly to this customer
  const custInvoicesMap = new Map<string, Invoice>();
  invoices.forEach((inv) => {
    const isCust =
      (inv.customerId && customer.id && inv.customerId === customer.id) ||
      (inv.customerName && customer.name && inv.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase());
    if (isCust && inv.status !== 'cancelled' && inv.status !== 'void' && inv.status !== 'draft') {
      custInvoicesMap.set(inv.id, inv);
    }
  });
  const custInvoices = Array.from(custInvoicesMap.values());

  // 2. Filter and deduplicate promises belonging strictly to this customer
  const custPromisesMap = new Map<string, PaymentPromise>();
  promises.forEach((p) => {
    const matchesId = Boolean(p.customerId && customer.id && p.customerId === customer.id);
    const matchesInv = custInvoicesMap.has(p.invoiceId);
    if (matchesId || matchesInv) {
      custPromisesMap.set(p.id, p);
    }
  });
  const custPromises = Array.from(custPromisesMap.values());

  // 3. Analyze Settled Invoices for Punctuality
  let settledInvoicesCount = 0;
  let onTimePaymentsCount = 0;
  let latePaymentsCount = 0;
  let totalLatenessDays = 0;
  let disputedInvoicesCount = 0;
  let totalOutstanding = 0;

  custInvoices.forEach((inv) => {
    const isDisputed = inv.status === 'disputed';
    if (isDisputed) disputedInvoicesCount++;

    const outstanding = inv.outstandingAmount !== undefined
      ? inv.outstandingAmount
      : Math.max(0, inv.amount - (inv.paidAmount || 0));

    if (isCollectibleStatus(inv.status)) {
      totalOutstanding += outstanding;
    }

    // Only confirmed paid or partially paid counts (unverified CLAIMED does NOT count)
    const isPaid = inv.status === 'paid';
    const hasConfirmedPaid = (inv.paidAmount || 0) > 0 && inv.paymentClaimStatus !== 'CLAIMED';

    if (isPaid || hasConfirmedPaid) {
      settledInvoicesCount++;
      const dueDate = inv.dueDate || '';
      const paidDate = inv.paidDate || '';

      let isLate = false;
      let delayDays = 0;

      if (paidDate && dueDate) {
        if (paidDate > dueDate) {
          isLate = true;
          delayDays = Math.max(1, Math.round((new Date(paidDate).getTime() - new Date(dueDate).getTime()) / 86400000));
        }
      } else if (inv.daysOverdue > 0 && !isPaid) {
        isLate = true;
        delayDays = inv.daysOverdue;
      }

      if (isLate) {
        latePaymentsCount++;
        totalLatenessDays += delayDays;
      } else {
        onTimePaymentsCount++;
      }
    }
  });

  const avgPaymentDelayDays = latePaymentsCount > 0
    ? Math.round(totalLatenessDays / latePaymentsCount)
    : 0;

  // 4. Analyze Promises
  let fulfilledPromisesCount = 0;
  let missedPromisesCount = 0;
  let activePromisesCount = 0;

  custPromises.forEach((p) => {
    const isFulfilled = p.status === 'FULFILLED' || p.status === 'fulfilled';
    const isMissed =
      p.status === 'BROKEN' ||
      p.status === 'missed' ||
      ((p.status === 'ACTIVE' || p.status === 'pending') && p.promisedDate < now);
    const isActive = (p.status === 'ACTIVE' || p.status === 'pending') && p.promisedDate >= now;

    if (isFulfilled) {
      fulfilledPromisesCount++;
    } else if (isMissed) {
      missedPromisesCount++;
    } else if (isActive) {
      activePromisesCount++;
    }
  });

  const totalObservations = settledInvoicesCount + fulfilledPromisesCount + missedPromisesCount;
  const primaryFactors: string[] = [];

  // 5. Check Insufficient History Threshold (< 2 observations)
  if (totalObservations < 2) {
    if (custInvoices.length === 0) {
      primaryFactors.push('No invoice or payment history recorded for this customer.');
    } else {
      primaryFactors.push(`Only ${totalObservations} completed transaction observation(s) on record.`);
      primaryFactors.push('Neutral score assigned: minimum 2 completed observations required.');
    }
    if (disputedInvoicesCount > 0) {
      primaryFactors.push(`${disputedInvoicesCount} billing dispute under review (neutral; excluded from penalty).`);
    }

    return {
      customerId: customer.id,
      customerName: customer.name,
      company: customer.company,
      score: null,
      tier: 'INSUFFICIENT_HISTORY',
      tierLabel: 'Insufficient History',
      tierColor: 'slate',
      totalObservations,
      settledInvoicesCount,
      onTimePaymentsCount,
      latePaymentsCount,
      avgPaymentDelayDays,
      fulfilledPromisesCount,
      missedPromisesCount,
      activePromisesCount,
      disputedInvoicesCount,
      totalOutstanding,
      primaryFactors,
      recommendedAction: 'Standard courteous invoicing and initial payment relationship building.',
    };
  }

  // 6. Compute Deterministic Scoring
  // Punctuality Subscore (0 to 100)
  let punctualityScore: number | null = null;
  if (settledInvoicesCount > 0) {
    const onTimeRate = onTimePaymentsCount / settledInvoicesCount;
    const latenessFactor = Math.max(0, 1 - (avgPaymentDelayDays / 60));
    punctualityScore = Math.round((onTimeRate * 70) + (latenessFactor * 30));
    primaryFactors.push(
      `${onTimePaymentsCount} of ${settledInvoicesCount} verified invoices settled on time (${Math.round(onTimeRate * 100)}%)`
    );
    if (latePaymentsCount > 0) {
      primaryFactors.push(`Average settlement delay when late: ${avgPaymentDelayDays} days`);
    }
  }

  // Promise Subscore (0 to 100)
  let promiseScore: number | null = null;
  const totalCompletedPromises = fulfilledPromisesCount + missedPromisesCount;
  if (totalCompletedPromises > 0) {
    const promiseFulfillmentRate = fulfilledPromisesCount / totalCompletedPromises;
    promiseScore = Math.round(promiseFulfillmentRate * 100);
    primaryFactors.push(
      `${fulfilledPromisesCount} of ${totalCompletedPromises} payment commitments fulfilled (${Math.round(promiseFulfillmentRate * 100)}%)`
    );
    if (missedPromisesCount > 0) {
      primaryFactors.push(`⚠ ${missedPromisesCount} missed payment commitment deadline(s) on record`);
    }
  } else {
    primaryFactors.push('No payment commitments requested or required to date');
  }

  // Composite Calculation
  let finalScore: number;
  if (punctualityScore !== null && promiseScore !== null) {
    finalScore = Math.round((punctualityScore * 0.6) + (promiseScore * 0.4));
  } else if (punctualityScore !== null) {
    finalScore = punctualityScore;
  } else if (promiseScore !== null) {
    finalScore = promiseScore;
  } else {
    finalScore = 50;
  }

  finalScore = Math.max(0, Math.min(100, finalScore));

  if (disputedInvoicesCount > 0) {
    primaryFactors.push(
      `${disputedInvoicesCount} active billing dispute under review (neutral; not penalized in reliability score)`
    );
  }

  // Determine Qualitative Tier
  let tier: ReliabilityTier;
  let tierLabel: string;
  let tierColor: 'emerald' | 'amber' | 'rose' | 'slate';
  let recommendedAction: string;

  if (finalScore >= 80) {
    tier = 'RELIABLE';
    tierLabel = 'High Reliability';
    tierColor = 'emerald';
    recommendedAction = 'Eligible for extended commercial terms and automated courteous follow-up.';
  } else if (finalScore >= 50) {
    tier = 'MODERATE';
    tierLabel = 'Moderate Reliability';
    tierColor = 'amber';
    recommendedAction = 'Structured reminders required; confirm invoice receipt 3 days before due date.';
  } else {
    tier = 'ELEVATED';
    tierLabel = 'Elevated Default Risk';
    tierColor = 'rose';
    recommendedAction = 'High attention: secure firm commitment dates, require milestone deposits, escalate to phone.';
  }

  return {
    customerId: customer.id,
    customerName: customer.name,
    company: customer.company,
    score: finalScore,
    tier,
    tierLabel,
    tierColor,
    totalObservations,
    settledInvoicesCount,
    onTimePaymentsCount,
    latePaymentsCount,
    avgPaymentDelayDays,
    fulfilledPromisesCount,
    missedPromisesCount,
    activePromisesCount,
    disputedInvoicesCount,
    totalOutstanding,
    primaryFactors,
    recommendedAction,
  };
}

/**
 * Computes portfolio-wide customer reliability map.
 */
export function computePortfolioCustomerReliability(
  customers: Customer[] = [],
  invoices: Invoice[] = [],
  promises: PaymentPromise[] = [],
  todayStr?: string
): Map<string, CustomerReliabilityAssessment> {
  const result = new Map<string, CustomerReliabilityAssessment>();
  for (const c of customers) {
    const assessment = computeCustomerPaymentReliability(c, invoices, promises, todayStr);
    result.set(c.id, assessment);
  }
  return result;
}
