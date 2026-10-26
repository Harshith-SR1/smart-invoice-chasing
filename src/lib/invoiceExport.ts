import { Invoice, isCollectibleStatus } from '../types';

/**
 * Canonical Invoice Export Contract
 * Columns and their authoritative source fields:
 *
 * 1.  Invoice Number          -> inv.invoiceNumber
 * 2.  Customer Name           -> inv.customerName
 * 3.  Customer Email          -> inv.customerEmail
 * 4.  Issue Date              -> inv.issueDate || 'Unavailable'
 * 5.  Due Date                -> inv.dueDate || 'Unavailable'
 * 6.  Currency                -> inv.currency || 'INR'
 * 7.  Original Amount         -> (Number(inv.amount) || 0).toFixed(2)
 * 8.  Verified Paid Amount    -> Authoritative confirmed funds received (excludes claims/rejected)
 * 9.  Outstanding Balance     -> Authoritative max(0, amount - verifiedPaidAmount)
 * 10. Invoice Status          -> inv.status ('paid' | 'overdue' | 'disputed' | 'draft' | etc.)
 * 11. Collection State        -> Disputed/Paused, Settled, or Category ('PROMISERS', 'DISPUTERS', etc.)
 * 12. Payment Claim Status    -> inv.paymentClaimStatus ('UNCLAIMED' | 'CLAIMED' | 'VERIFIED' | 'REJECTED')
 * 13. Days Overdue            -> inv.status === 'paid' ? 0 : (inv.daysOverdue || 0)
 * 14. Active Promises Count   -> inv.paymentPromisesCount || 0
 * 15. Missed Promises Count   -> inv.missedPromisesCount || 0
 * 16. Last Contact Date       -> inv.lastContactDate || inv.issueDate || 'Unavailable'
 * 17. Next Action             -> inv.nextAction || 'Standard workflow'
 */

export const INVOICE_EXPORT_COLUMNS = [
  'Invoice Number',
  'Customer Name',
  'Customer Email',
  'Issue Date',
  'Due Date',
  'Currency',
  'Original Amount',
  'Verified Paid Amount',
  'Outstanding Balance',
  'Invoice Status',
  'Collection State',
  'Payment Claim Status',
  'Days Overdue',
  'Active Promises Count',
  'Missed Promises Count',
  'Last Contact Date',
  'Next Action',
] as const;

/**
 * Sanitises untrusted CSV values:
 * 1. Defends against spreadsheet formula injection (=, +, -, @, \t, \r).
 *    If untrusted text starts with a formula trigger, prepends a single quote (').
 * 2. Enforces standard RFC 4180 escaping: wraps values containing commas,
 *    newlines, or double-quotes in quotes and escapes internal quotes as `""`.
 */
export function sanitiseCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  let str = String(value);

  // Spreadsheet formula injection mitigation:
  // Characters that trigger formula execution in Excel/Sheets/Calc
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 quoting
  if (/[",\n\r]/.test(str) || str.startsWith("'")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export interface CanonicalInvoiceRow {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  originalAmount: number;
  verifiedPaidAmount: number;
  outstandingBalance: number;
  invoiceStatus: string;
  collectionState: string;
  paymentClaimStatus: string;
  daysOverdue: number;
  activePromisesCount: number;
  missedPromisesCount: number;
  lastContactDate: string;
  nextAction: string;
  inconsistencyWarning?: string;
}

/**
 * Computes canonical reconciled financial values for a single invoice.
 * Upholds financial invariants:
 * - Only confirmed payments determine verified paid amount.
 * - Claims (unverified/rejected) NEVER count toward paid amount or reduce outstanding.
 * - Outstanding balance is max(0, originalAmount - verifiedPaidAmount).
 * - Disputed invoices remain receivables but are flagged as collection paused.
 * - Stale 'paid' status with 0 confirmed payments is detected and surfaced.
 */
export function computeCanonicalInvoiceRow(
  inv: Invoice,
  fallbackCurrency: string = 'INR'
): CanonicalInvoiceRow {
  const originalAmount = Number((Number(inv.amount) || 0).toFixed(2));
  const currency = inv.currency || fallbackCurrency;

  // Calculate verified paid amount from payments array if present, else paidAmount
  let verifiedPaid = 0;
  let hasContradictoryPaidStatus = false;

  const anyInv = inv as any;
  if (Array.isArray(anyInv.payments) && anyInv.payments.length > 0) {
    const confirmedPayments = anyInv.payments.filter((p: any) => p.status === 'confirmed');
    const confirmedSum = confirmedPayments.reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0
    );
    verifiedPaid = Number(confirmedSum.toFixed(2));

    if (inv.status === 'paid' && verifiedPaid < originalAmount && originalAmount > 0) {
      hasContradictoryPaidStatus = true;
    }
  } else if (inv.paidAmount !== undefined && inv.paidAmount !== null) {
    verifiedPaid = Number(Number(inv.paidAmount).toFixed(2));
    if (inv.status === 'paid' && verifiedPaid === 0 && originalAmount > 0) {
      hasContradictoryPaidStatus = true;
    }
  } else if (inv.status === 'paid') {
    verifiedPaid = originalAmount;
  } else {
    verifiedPaid = 0;
  }

  // Authoritative outstanding balance
  let outstandingBalance = 0;
  if (inv.status === 'paid' && !hasContradictoryPaidStatus) {
    outstandingBalance = 0;
  } else if (inv.outstandingAmount !== undefined && inv.outstandingAmount !== null) {
    outstandingBalance = Number(Number(inv.outstandingAmount).toFixed(2));
  } else {
    outstandingBalance = Number(Math.max(0, originalAmount - verifiedPaid).toFixed(2));
  }

  // Collection and dispute state description
  let collectionState = 'ACTIVE PIPELINE';
  if (inv.status === 'disputed') {
    collectionState = 'DISPUTED (COLLECTION PAUSED)';
  } else if (inv.status === 'cancelled') {
    collectionState = 'CANCELLED';
  } else if (inv.status === 'void') {
    collectionState = 'VOID';
  } else if (inv.status === 'draft') {
    collectionState = 'DRAFT';
  } else if (inv.status === 'held' || inv.status === 'on_hold') {
    collectionState = 'HELD';
  } else if (inv.status === 'paid') {
    collectionState = 'SETTLED';
  } else if (inv.collectionCategory) {
    collectionState = inv.collectionCategory;
  }

  const daysOverdue = inv.status === 'paid' ? 0 : Math.max(0, inv.daysOverdue || 0);

  return {
    invoiceNumber: inv.invoiceNumber || 'INV-UNKNOWN',
    customerName: inv.customerName || 'Unknown Customer',
    customerEmail: inv.customerEmail || '',
    issueDate: inv.issueDate || 'Unavailable',
    dueDate: inv.dueDate || 'Unavailable',
    currency,
    originalAmount,
    verifiedPaidAmount: verifiedPaid,
    outstandingBalance,
    invoiceStatus: inv.status || 'unknown',
    collectionState,
    paymentClaimStatus: inv.paymentClaimStatus || 'UNCLAIMED',
    daysOverdue,
    activePromisesCount: inv.paymentPromisesCount || 0,
    missedPromisesCount: inv.missedPromisesCount || 0,
    lastContactDate: inv.lastContactDate || inv.issueDate || 'Unavailable',
    nextAction: inv.nextAction || 'Standard workflow',
    inconsistencyWarning: hasContradictoryPaidStatus
      ? `Stale status 'paid' contradicts confirmed ledger (paid: ${verifiedPaid}, amount: ${originalAmount})`
      : undefined,
  };
}

/**
 * Generates an RFC 4180 compliant CSV string for the supplied invoices.
 * Includes UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility.
 */
export function generateInvoicesCsv(
  invoices: Invoice[],
  options?: { fallbackCurrency?: string }
): string {
  const rows: string[] = [];

  // Column Header Row
  rows.push(INVOICE_EXPORT_COLUMNS.map(sanitiseCsvField).join(','));

  // Data Rows
  for (const inv of invoices) {
    const row = computeCanonicalInvoiceRow(inv, options?.fallbackCurrency);
    const line = [
      sanitiseCsvField(row.invoiceNumber),
      sanitiseCsvField(row.customerName),
      sanitiseCsvField(row.customerEmail),
      sanitiseCsvField(row.issueDate),
      sanitiseCsvField(row.dueDate),
      sanitiseCsvField(row.currency),
      sanitiseCsvField(row.originalAmount.toFixed(2)),
      sanitiseCsvField(row.verifiedPaidAmount.toFixed(2)),
      sanitiseCsvField(row.outstandingBalance.toFixed(2)),
      sanitiseCsvField(row.invoiceStatus),
      sanitiseCsvField(row.collectionState),
      sanitiseCsvField(row.paymentClaimStatus),
      sanitiseCsvField(row.daysOverdue),
      sanitiseCsvField(row.activePromisesCount),
      sanitiseCsvField(row.missedPromisesCount),
      sanitiseCsvField(row.lastContactDate),
      sanitiseCsvField(row.nextAction),
    ].join(',');

    rows.push(line);
  }

  // Prepend UTF-8 Byte Order Mark (BOM)
  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Triggers client-side CSV download in browser environment.
 * Performs safe filename sanitization to eliminate path traversal or injection characters.
 */
export function exportInvoicesToCsv(
  invoices: Invoice[] | null | undefined,
  options?: {
    scopeName?: string;
    fallbackCurrency?: string;
    customFilename?: string;
  }
): { success: boolean; rowCount: number; filename: string; error?: string; isEmpty?: boolean } {
  // Visible failure if dataset is unavailable
  if (!invoices || !Array.isArray(invoices)) {
    return {
      success: false,
      rowCount: 0,
      filename: '',
      error: 'Cannot export invoices: dataset is unavailable or failed to load.',
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const rawScope = options?.scopeName ? options.scopeName.replace(/\s+/g, '_') : 'All';
  const defaultFilename = `Invoices_Export_${rawScope}_${today}.csv`;
  const targetFilename = options?.customFilename || defaultFilename;

  // Sanitize filename against unsafe characters
  const safeFilename = targetFilename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

  const csvContent = generateInvoicesCsv(invoices, { fallbackCurrency: options?.fallbackCurrency });

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', safeFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      return {
        success: false,
        rowCount: invoices.length,
        filename: safeFilename,
        error: `Browser download failed: ${err?.message || 'Unknown error'}`,
      };
    }
  }

  return {
    success: true,
    rowCount: invoices.length,
    filename: safeFilename,
    isEmpty: invoices.length === 0,
  };
}
