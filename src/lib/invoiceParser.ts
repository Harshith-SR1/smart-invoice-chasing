import * as XLSX from 'xlsx';
import { Invoice, InvoiceStatus } from '../types';

export interface ColumnMapping {
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string;
  amount: string;
  dueDate: string;
  issueDate?: string;
  status?: string;
  paidAmount?: string;
  outstandingAmount?: string;
}

export interface ParsedImportRow {
  rowNumber: number;
  raw: Record<string, any>;
  parsed?: {
    invoiceNumber: string;
    customerName: string;
    customerEmail?: string;
    amount: number;
    paidAmount?: number;
    outstandingAmount: number;
    issueDate: string;
    dueDate: string;
    status: InvoiceStatus;
    sourceFileName: string;
    sourceFileType: string;
    sourceRowNumber: number;
    importBatchId: string;
  };
  errors: string[];
  isDuplicate?: boolean;
}

export interface ParseResult {
  fileName: string;
  fileType: string;
  batchId: string;
  headers: string[];
  mapping: ColumnMapping;
  rows: ParsedImportRow[];
  validCount: number;
  errorCount: number;
  totalInvoiceAmount: number;
  totalOutstandingAmount: number;
  paidCount: number;
  unpaidCount: number;
}

const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  invoiceNumber: [
    'invoice number',
    'invoice_number',
    'invoice no',
    'invoice_no',
    'invoice id',
    'invoicenumber',
    'invoiceno',
    'invoice',
    'bill number',
    'bill_no',
    'inv #',
    'inv_no',
    'doc_number',
    'number',
  ],
  customerName: [
    'customer name',
    'customer_name',
    'customername',
    'customer',
    'client name',
    'client_name',
    'client',
    'company',
    'company name',
    'buyer',
    'account',
    'account name',
  ],
  customerEmail: [
    'customer email',
    'customer_email',
    'customeremail',
    'client email',
    'client_email',
    'email',
    'contact email',
    'billing email',
  ],
  amount: [
    'amount',
    'invoice amount',
    'invoice_amount',
    'total',
    'total amount',
    'total_amount',
    'grand total',
    'grand_total',
    'gross amount',
    'net amount',
    'value',
    'bill amount',
  ],
  dueDate: [
    'due date',
    'due_date',
    'duedate',
    'payment due',
    'payment_due',
    'due',
    'payment due date',
    'pay date',
  ],
  issueDate: [
    'invoice date',
    'invoice_date',
    'invoicedate',
    'issue date',
    'issue_date',
    'issuedate',
    'date',
    'bill date',
    'created at',
  ],
  status: [
    'status',
    'invoice status',
    'invoice_status',
    'payment status',
    'payment_status',
    'state',
    'stage',
  ],
  paidAmount: [
    'paid amount',
    'paid_amount',
    'paid',
    'amount paid',
    'amount_paid',
    'received',
    'received amount',
  ],
  outstandingAmount: [
    'outstanding',
    'outstanding amount',
    'outstanding_amount',
    'balance',
    'balance due',
    'balance_due',
    'amount due',
    'amount_due',
    'due amount',
  ],
};

/**
 * Intelligent column header detection
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: Partial<ColumnMapping> = {};
  const lowerHeaders = headers.map((h) => h.trim().toLowerCase());

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const idx = lowerHeaders.findIndex((h) => h === alias || h.includes(alias));
      if (idx !== -1 && !Object.values(mapping).includes(headers[idx])) {
        mapping[key as keyof ColumnMapping] = headers[idx];
        break;
      }
    }
  }

  return {
    invoiceNumber: mapping.invoiceNumber || headers[0] || '',
    customerName: mapping.customerName || headers[1] || '',
    customerEmail: mapping.customerEmail,
    amount: mapping.amount || headers[2] || '',
    dueDate: mapping.dueDate || headers[3] || '',
    issueDate: mapping.issueDate,
    status: mapping.status,
    paidAmount: mapping.paidAmount,
    outstandingAmount: mapping.outstandingAmount,
  };
}

/**
 * Parse date from Excel serial number or string formats (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)
 */
function normalizeDate(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;

  // Handle Excel serial date
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const y = d.y.toString().padStart(4, '0');
      const m = d.m.toString().padStart(2, '0');
      const day = d.d.toString().padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // ISO format YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
    const [y, m, d] = str.split('T')[0].split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    // Defaulting to DD/MM/YYYY
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Parse numeric amount safely without modifying original precision
 */
function normalizeAmount(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;

  const clean = String(val).replace(/[^0-9.-]/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

/**
 * Main parser function for Files (.csv, .xlsx, .xls)
 */
export async function parseInvoiceFile(
  file: File,
  customMapping?: Partial<ColumnMapping>,
  existingInvoices?: Invoice[]
): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

  const mapping = {
    ...detectColumnMapping(headers),
    ...customMapping,
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const batchId = `IMP-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'csv';

  const seenInvoices = new Set<string>();
  const parsedRows: ParsedImportRow[] = [];

  let totalInvoiceAmount = 0;
  let totalOutstandingAmount = 0;
  let paidCount = 0;
  let unpaidCount = 0;

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // 1-indexed plus header row
    const errors: string[] = [];

    const rawInvNum = mapping.invoiceNumber ? String(row[mapping.invoiceNumber] || '').trim() : '';
    const rawCustName = mapping.customerName ? String(row[mapping.customerName] || '').trim() : '';
    const rawEmail = mapping.customerEmail ? String(row[mapping.customerEmail] || '').trim() : '';
    const rawAmt = mapping.amount ? normalizeAmount(row[mapping.amount]) : null;
    const rawDueDate = mapping.dueDate ? normalizeDate(row[mapping.dueDate]) : null;
    const rawIssueDate = mapping.issueDate ? normalizeDate(row[mapping.issueDate]) : null;
    const rawStatus = mapping.status ? String(row[mapping.status] || '').trim().toLowerCase() : '';
    const rawPaid = mapping.paidAmount ? normalizeAmount(row[mapping.paidAmount]) : null;
    const rawOutstanding = mapping.outstandingAmount ? normalizeAmount(row[mapping.outstandingAmount]) : null;

    // Validation
    if (!rawInvNum) {
      errors.push('Missing invoice number');
    }
    if (!rawCustName) {
      errors.push('Missing customer name');
    }
    if (rawAmt === null || rawAmt <= 0) {
      errors.push('Invalid or missing invoice amount');
    }
    if (!rawDueDate) {
      errors.push('Invalid or missing due date');
    }

    const isDuplicate = rawInvNum ? seenInvoices.has(rawInvNum.toLowerCase()) : false;
    if (rawInvNum) seenInvoices.add(rawInvNum.toLowerCase());
    if (isDuplicate) {
      errors.push(`Duplicate invoice number in file (${rawInvNum})`);
    }

    if (errors.length > 0 || rawAmt === null || !rawDueDate || !rawInvNum || !rawCustName) {
      parsedRows.push({
        rowNumber,
        raw: row,
        errors,
        isDuplicate,
      });
      return;
    }

    // Determine Status and Outstanding accurately
    let finalStatus: InvoiceStatus = 'overdue';
    let finalPaid = rawPaid || 0;
    let finalOutstanding = rawAmt - finalPaid;

    if (rawOutstanding !== null && rawOutstanding >= 0) {
      finalOutstanding = rawOutstanding;
      finalPaid = rawAmt - finalOutstanding;
    }

    if (rawStatus.includes('paid') && !rawStatus.includes('unpaid') && !rawStatus.includes('partially')) {
      finalStatus = 'paid';
      finalPaid = rawAmt;
      finalOutstanding = 0;
    } else if (rawStatus.includes('partial') || (finalPaid > 0 && finalOutstanding > 0)) {
      finalStatus = 'partially_paid';
    } else if (rawStatus.includes('dispute')) {
      finalStatus = 'disputed';
    } else if (rawStatus.includes('promise')) {
      finalStatus = 'promised';
    } else if (rawDueDate < todayStr) {
      finalStatus = 'overdue';
    } else {
      finalStatus = 'chasing';
    }

    if (finalStatus === 'paid') {
      paidCount++;
    } else {
      unpaidCount++;
    }

    totalInvoiceAmount += rawAmt;
    totalOutstandingAmount += finalOutstanding;

    parsedRows.push({
      rowNumber,
      raw: row,
      errors: [],
      isDuplicate: false,
      parsed: {
        invoiceNumber: rawInvNum,
        customerName: rawCustName,
        customerEmail: rawEmail || `${rawCustName.toLowerCase().replace(/[^a-z0-9]/g, '')}@billing.com`,
        amount: rawAmt,
        paidAmount: finalPaid,
        outstandingAmount: finalOutstanding,
        issueDate: rawIssueDate || todayStr,
        dueDate: rawDueDate,
        status: finalStatus,
        sourceFileName: file.name,
        sourceFileType: ext,
        sourceRowNumber: rowNumber,
        importBatchId: batchId,
      },
    });
  });

  const validCount = parsedRows.filter((r) => r.errors.length === 0 && r.parsed).length;
  const errorCount = parsedRows.length - validCount;

  return {
    fileName: file.name,
    fileType: ext,
    batchId,
    headers,
    mapping,
    rows: parsedRows,
    validCount,
    errorCount,
    totalInvoiceAmount,
    totalOutstandingAmount,
    paidCount,
    unpaidCount,
  };
}
