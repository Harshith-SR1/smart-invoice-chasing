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
  const outstanding = invoice.outstandingAmount !== undefined ? invoice.outstandingAmount : invoice.amount;
  const currencySymbol = invoice.currency.includes('INR') || invoice.currency === 'INR' ? '₹' : '$';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

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
        body: `Hi ${invoice.customerName.split(' ')[0]},\n\nWe received your note that payment for invoice ${invoice.invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()}) was released. Our accounts team is checking our bank feed and will confirm once credited.\n\nBest regards,`,
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
        body: `Hi ${invoice.customerName.split(' ')[0]},\n\nThank you for reaching out regarding invoice ${invoice.invoiceNumber}. Our operations lead will connect with you today to address your query and ensure everything is aligned.\n\nBest regards,`,
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
        body: `Hi ${invoice.customerName.split(' ')[0]},\n\nFollowing up on our previous conversation regarding invoice ${invoice.invoiceNumber} for ${currencySymbol}${outstanding.toLocaleString()}.\n\nYou had indicated that payment would be completed by ${pDate}, but we have not yet received confirmation of receipt.\n\nPlease let us know if the payment was initiated, or provide an updated transaction reference today.\n\nBest regards,`,
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
        body: `Hi ${invoice.customerName.split(' ')[0]},\n\nGentle check-in regarding the planned payment for invoice ${invoice.invoiceNumber} committed for ${pDate}.\n\nThank you for your cooperation.`,
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
        body: `Hi ${invoice.customerName.split(' ')[0]},\n\nWe have attempted to reach you multiple times regarding overdue invoice ${invoice.invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()}) without a response.\n\nPlease contact our finance office today to arrange settlement or clarify any outstanding issues to prevent further escalation.\n\nBest regards,`,
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
          body: `Hi ${invoice.customerName.split(' ')[0]},\n\nThis is a friendly reminder that invoice ${invoice.invoiceNumber} for ${currencySymbol}${outstanding.toLocaleString()} is due on ${invoice.dueDate}.\n\nPlease let us know if you need any additional invoice copies or purchase order confirmations to facilitate processing.\n\nBest regards,`,
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
          body: `Hi ${invoice.customerName.split(' ')[0]},\n\nGentle note regarding invoice ${invoice.invoiceNumber} due on ${invoice.dueDate}.\n\nThank you for your business.`,
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
        body: `Hi ${invoice.customerName.split(' ')[0]},\n\nWe are following up regarding invoice ${invoice.invoiceNumber}, which is now ${invoice.daysOverdue} days past due.\n\nThe outstanding balance is ${currencySymbol}${outstanding.toLocaleString()}.\n\nPlease arrange for settlement at your earliest convenience or reply with your payment schedule.\n\nBest regards,`,
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
      body: `Hi ${invoice.customerName.split(' ')[0]},\n\nHope all is well. Just a quick reminder that invoice ${invoice.invoiceNumber} (${currencySymbol}${outstanding.toLocaleString()}) was due on ${invoice.dueDate}.\n\nPlease let us know when we can expect payment.\n\nThank you!`,
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
    .filter((inv) => inv.status !== 'paid' && (inv.outstandingAmount === undefined || inv.outstandingAmount > 0))
    .map((inv) => {
      const cust = custMap.get(inv.customerId);
      const decision = evaluateInvoiceDecision(inv, cust, promises);
      const outstanding = inv.outstandingAmount !== undefined ? inv.outstandingAmount : inv.amount;

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
