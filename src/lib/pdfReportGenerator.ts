/**
 * PDF Recovery Audit Report Generator
 *
 * Generates an executive-grade, client-side PDF recovery report using jsPDF.
 * Reconciles strictly with canonical recovery metrics and confirmed ledger truth.
 *
 * Requirements:
 * - Real PDF file download (no window.print()).
 * - Contains Workspace Header, Executive KPIs, 6 Canonical Aging Tiers,
 *   Delinquent Accounts Table, and AI Executive Commentary.
 * - Handles long tables with automatic multi-page breaks.
 * - Safe formatting for currencies and numeric balances.
 */

import { jsPDF } from 'jspdf';
import { RecoveryReportSummary, PaymentPromise } from '../types';

export interface RecoveryReportPdfParams {
  reportSummary: RecoveryReportSummary;
  workspace: {
    businessName?: string;
    businessEmail?: string;
    currency?: string;
  };
  promises?: PaymentPromise[];
}

/**
 * Format currency amounts safely for standard PDF typography.
 * In standard PDF Helvetica Type 1 fonts, the Indian Rupee symbol ('\u20B9')
 * is outside the WinAnsi encoding. Using 'INR' avoids character corruption.
 */
export function formatPdfCurrency(amount: number, isINR: boolean): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  if (isINR) {
    return `INR ${safeAmount.toLocaleString('en-IN')}`;
  }
  return `$${safeAmount.toLocaleString('en-US')}`;
}

/**
 * Format short currency amounts for KPI cards (e.g. INR 2.50L).
 */
export function formatPdfKpiCurrency(amount: number, isINR: boolean): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  if (isINR) {
    if (safeAmount >= 10000000) {
      return `INR ${(safeAmount / 10000000).toFixed(2)} Cr`;
    }
    if (safeAmount >= 100000) {
      return `INR ${(safeAmount / 100000).toFixed(2)}L`;
    }
    return `INR ${safeAmount.toLocaleString('en-IN')}`;
  }
  if (safeAmount >= 1000000) {
    return `$${(safeAmount / 1000000).toFixed(2)}M`;
  }
  if (safeAmount >= 1000) {
    return `$${(safeAmount / 1000).toFixed(1)}k`;
  }
  return `$${safeAmount.toLocaleString('en-US')}`;
}

/**
 * Generate the canonical filename for the Recovery Audit Report.
 * Contract: Recovery_Audit_Report_[Month]_[Year].pdf
 */
export function getRecoveryReportPdfFilename(month: string, year: number): string {
  const safeMonth = (month || 'Audit').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  return `Recovery_Audit_Report_${safeMonth}_${safeYear}.pdf`;
}

/**
 * Generate a complete, multi-page jsPDF document from Recovery Report data.
 */
export function generateRecoveryReportPdf(params: RecoveryReportPdfParams): jsPDF {
  const { reportSummary, workspace, promises = [] } = params;

  // Initialize jsPDF in A4 portrait (width: 210mm, height: 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const isINR =
    workspace.currency?.includes('INR') ||
    workspace.currency === 'INR' ||
    !workspace.currency; // default workspace currency is INR in this app

  const currencyCode = isINR ? 'INR' : 'USD';
  const workspaceName = workspace.businessName?.trim() || 'Smart Invoice Chasing';
  const month = reportSummary.month || 'Current';
  const year = reportSummary.year || new Date().getFullYear();
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Derived financial values
  const totalRecovered = reportSummary.totalRecovered || 0;
  const portfolioRecovered =
    reportSummary.totalPortfolioRecovered !== undefined
      ? reportSummary.totalPortfolioRecovered
      : totalRecovered;
  const totalOutstanding = reportSummary.totalOutstanding || 0;
  const remindersSent = reportSummary.remindersSent || 0;
  const repliesReceived = reportSummary.repliesReceived || 0;
  const promisesDetected = reportSummary.promisesDetected || 0;
  const promisesFulfilled = reportSummary.promisesFulfilled || 0;
  const escalatedCount = reportSummary.escalatedCount || 0;

  // Promise fulfillment rate & active commitments
  const promiseFulfillmentRate =
    promisesDetected > 0
      ? Math.min(100, Math.round((promisesFulfilled / promisesDetected) * 100))
      : 0;

  const activePromisesCount = promises.filter(
    (p) => p.status === 'ACTIVE' || p.status === 'pending'
  ).length;

  const brokenPromisesCount = promises.filter(
    (p) => p.status === 'BROKEN' || p.status === 'missed'
  ).length;

  // Aging breakdown tiers
  const aging = reportSummary.agingBreakdown || {
    notDue: { count: 0, amount: 0 },
    days1_7: { count: 0, amount: 0 },
    days8_30: { count: 0, amount: 0 },
    days31_60: { count: 0, amount: 0 },
    days61_90: { count: 0, amount: 0 },
    days90Plus: { count: 0, amount: 0 },
    totalCollectible: totalOutstanding,
  };

  const totalAgingCount =
    aging.notDue.count +
    aging.days1_7.count +
    aging.days8_30.count +
    aging.days31_60.count +
    aging.days61_90.count +
    aging.days90Plus.count;

  // Layout boundaries
  const leftMargin = 14;
  const rightMargin = 196;
  const contentWidth = 182;
  const pageHeight = 297;
  const maxY = 272; // Leave room for footer
  let yPos = 14;

  // Page break helper
  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > maxY) {
      doc.addPage();
      yPos = 18;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. HEADER SECTION
  // ─────────────────────────────────────────────────────────────────────────────
  // Top brand emerald accent strip
  doc.setFillColor(16, 185, 129); // Emerald-500
  doc.rect(0, 0, 210, 4, 'F');

  // Business / Workspace Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(workspaceName, leftMargin, yPos + 4);

  // Document Type Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(4, 120, 87); // Emerald-700
  doc.text('SMART INVOICE RECOVERY & CASH AUDIT REPORT', leftMargin, yPos + 10);

  // Metadata Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(
    `Reporting Period: ${month} ${year}   |   Generated: ${generatedDate}   |   Currency: ${currencyCode}`,
    leftMargin,
    yPos + 15
  );

  // Right-aligned Verified Ledger Badge
  doc.setFillColor(240, 253, 244); // Emerald-50
  doc.setDrawColor(187, 247, 208); // Emerald-200
  doc.roundedRect(138, yPos, 58, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52); // Emerald-800
  doc.text('VERIFIED RECOVERY AUDIT', 141, yPos + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('Authoritative Confirmed Ledger Only', 141, yPos + 11);

  // Horizontal divider
  yPos += 22;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.3);
  doc.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 6;

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. EXECUTIVE RECOVERY KPIS
  // ─────────────────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. EXECUTIVE RECOVERY KPIS', leftMargin, yPos);
  yPos += 5;

  // KPI Grid: 2 rows of 3 cards
  const cardWidth = (contentWidth - 6) / 3; // ~58.6mm each
  const cardHeight = 19;
  const colGap = 3;
  const rowGap = 3;

  const kpis = [
    {
      title: `Cash Recovered (${month})`,
      value: formatPdfKpiCurrency(totalRecovered, isINR),
      subtitle: 'Confirmed bank receipts',
      highlight: true,
    },
    {
      title: 'Portfolio Confirmed Cash',
      value: formatPdfKpiCurrency(portfolioRecovered, isINR),
      subtitle: 'All-time verified collections',
      highlight: false,
    },
    {
      title: 'Outstanding Collectible',
      value: formatPdfKpiCurrency(totalOutstanding, isINR),
      subtitle: 'Active pending receivables',
      highlight: false,
    },
    {
      title: 'Reminders Dispatched',
      value: `${remindersSent}`,
      subtitle: `${repliesReceived} debtor replies received`,
      highlight: false,
    },
    {
      title: 'Promise Outcomes',
      value: `${promisesFulfilled} / ${promisesDetected} Fulfilled`,
      subtitle: `${promiseFulfillmentRate}% rate (${activePromisesCount} active${brokenPromisesCount > 0 ? `, ${brokenPromisesCount} broken` : ''})`,
      highlight: false,
    },
    {
      title: 'Human Escalations',
      value: `${escalatedCount}`,
      subtitle: 'Severely overdue / broken cadence',
      highlight: false,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = leftMargin + col * (cardWidth + colGap);
    const y = yPos + row * (cardHeight + rowGap);

    if (kpi.highlight) {
      doc.setFillColor(236, 253, 245); // Emerald-50
      doc.setDrawColor(16, 185, 129); // Emerald-500
      doc.setLineWidth(0.4);
    } else {
      doc.setFillColor(248, 250, 252); // Slate-50
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.setLineWidth(0.2);
    }

    doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title.toUpperCase(), x + 3, y + 4.5);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (kpi.highlight) {
      doc.setTextColor(4, 120, 87);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(kpi.value, x + 3, y + 11.5);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.subtitle, x + 3, y + 16);
  });

  yPos += 2 * cardHeight + rowGap + 8;

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. RECEIVABLES AGING BREAKDOWN
  // ─────────────────────────────────────────────────────────────────────────────
  checkPageBreak(50);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. RECEIVABLES AGING BREAKDOWN (CANONICAL TIERS)', leftMargin, yPos);
  yPos += 5;

  // Aging table header
  const agingCols = [
    { title: 'Aging Interval', x: leftMargin + 2, width: 50, align: 'left' },
    { title: 'Risk Severity', x: leftMargin + 52, width: 35, align: 'left' },
    { title: 'Invoices', x: leftMargin + 115, width: 25, align: 'right' },
    { title: 'Outstanding Balance', x: leftMargin + 155, width: 40, align: 'right' },
    { title: 'Share', x: rightMargin - 2, width: 20, align: 'right' },
  ];

  doc.setFillColor(241, 245, 249); // Slate-100
  doc.rect(leftMargin, yPos, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  agingCols.forEach((c) => {
    doc.text(c.title, c.x, yPos + 4.2, { align: c.align as any });
  });
  yPos += 6;

  const totalAmt = aging.totalCollectible || totalOutstanding || 1;

  const agingRows = [
    { label: 'Current (Not Due)', severity: 'Low Risk / Scheduled', count: aging.notDue.count, amt: aging.notDue.amount },
    { label: '1–7 Days Overdue', severity: 'Initial Grace Period', count: aging.days1_7.count, amt: aging.days1_7.amount },
    { label: '8–30 Days Overdue', severity: 'Active Chasing Follow-up', count: aging.days8_30.count, amt: aging.days8_30.amount },
    { label: '31–60 Days Overdue', severity: 'Elevated Risk / Negotiation', count: aging.days31_60.count, amt: aging.days31_60.amount },
    { label: '61–90 Days Overdue', severity: 'High Risk / Escalation Candidate', count: aging.days61_90.count, amt: aging.days61_90.amount },
    { label: '90+ Days Overdue', severity: 'Critical / Severely Delinquent', count: aging.days90Plus.count, amt: aging.days90Plus.amount },
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  agingRows.forEach((row, i) => {
    const isEven = i % 2 === 0;
    if (isEven) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.rect(leftMargin, yPos, contentWidth, 5.5, 'F');

    const sharePct = totalAmt > 0 ? ((row.amt / totalAmt) * 100).toFixed(1) : '0.0';

    doc.setTextColor(30, 41, 59);
    doc.text(row.label, leftMargin + 2, yPos + 3.8);

    doc.setTextColor(100, 116, 139);
    doc.text(row.severity, leftMargin + 52, yPos + 3.8);

    doc.setTextColor(15, 23, 42);
    doc.text(`${row.count}`, leftMargin + 115, yPos + 3.8, { align: 'right' });

    doc.text(formatPdfCurrency(row.amt, isINR), leftMargin + 155, yPos + 3.8, { align: 'right' });

    doc.setTextColor(100, 116, 139);
    doc.text(`${sharePct}%`, rightMargin - 2, yPos + 3.8, { align: 'right' });

    yPos += 5.5;
  });

  // Aging Summary Row
  doc.setFillColor(241, 245, 249);
  doc.rect(leftMargin, yPos, contentWidth, 6, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, yPos, rightMargin, yPos);
  doc.line(leftMargin, yPos + 6, rightMargin, yPos + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Total Collectible Receivables', leftMargin + 2, yPos + 4.2);
  doc.text(`${totalAgingCount}`, leftMargin + 115, yPos + 4.2, { align: 'right' });
  doc.text(formatPdfCurrency(aging.totalCollectible, isINR), leftMargin + 155, yPos + 4.2, { align: 'right' });
  doc.text('100.0%', rightMargin - 2, yPos + 4.2, { align: 'right' });

  yPos += 11;

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. DELINQUENT ACCOUNTS REQUIRING ATTENTION
  // ─────────────────────────────────────────────────────────────────────────────
  checkPageBreak(40);

  const unrecovered = reportSummary.unrecoveredAccounts || [];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `3. DELINQUENT ACCOUNTS REQUIRING ATTENTION (${unrecovered.length} FLAGGED)`,
    leftMargin,
    yPos
  );
  yPos += 5;

  if (unrecovered.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(leftMargin, yPos, contentWidth, 12, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'No delinquent accounts currently flagged for repeated unanswered follow-up in this reporting period.',
      leftMargin + 4,
      yPos + 7.5
    );
    yPos += 18;
  } else {
    // Delinquent Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(leftMargin, yPos, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    doc.text('Invoice #', leftMargin + 2, yPos + 4.2);
    doc.text('Customer / Account', leftMargin + 32, yPos + 4.2);
    doc.text('Overdue', leftMargin + 85, yPos + 4.2);
    doc.text('Reminders', leftMargin + 105, yPos + 4.2);
    doc.text('Outstanding Balance', leftMargin + 145, yPos + 4.2, { align: 'right' });
    doc.text('Next Action Recommendation', leftMargin + 150, yPos + 4.2);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    unrecovered.forEach((acc, i) => {
      checkPageBreak(6.5);

      const isEven = i % 2 === 0;
      if (isEven) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(248, 250, 252);
      }
      doc.rect(leftMargin, yPos, contentWidth, 6, 'F');

      // Invoice Number
      doc.setTextColor(30, 41, 59);
      doc.text(acc.invoiceNumber, leftMargin + 2, yPos + 4.2);

      // Customer Name (clipped safely if too long)
      const customerSafe =
        acc.customerName.length > 24
          ? `${acc.customerName.slice(0, 22)}...`
          : acc.customerName;
      doc.text(customerSafe, leftMargin + 32, yPos + 4.2);

      // Overdue Days
      doc.setTextColor(225, 29, 72); // Rose-600
      doc.text(`${acc.daysOverdue}d`, leftMargin + 85, yPos + 4.2);

      // Reminders Count
      doc.setTextColor(100, 116, 139);
      doc.text(`${acc.remindersCount} sent`, leftMargin + 105, yPos + 4.2);

      // Outstanding
      doc.setTextColor(15, 23, 42);
      doc.text(formatPdfCurrency(acc.amount, isINR), leftMargin + 145, yPos + 4.2, {
        align: 'right',
      });

      // Recommendation (clipped safely)
      const rec = acc.recommendation || 'Standard collection workflow';
      const recSafe = rec.length > 24 ? `${rec.slice(0, 22)}...` : rec;
      doc.setTextColor(4, 120, 87);
      doc.text(recSafe, leftMargin + 150, yPos + 4.2);

      yPos += 6;
    });

    yPos += 6;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. AI MONTHLY EXECUTIVE SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  checkPageBreak(35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('4. AI EXECUTIVE SUMMARY & ACTIONABLE COMMENTARY', leftMargin, yPos);
  yPos += 5;

  const rawSummary =
    reportSummary.aiExecutiveSummary?.trim() ||
    'AI Executive Summary is currently unavailable for this reporting period.';

  // Split narrative text into wrapped lines for width
  const wrappedLines = doc.splitTextToSize(rawSummary, contentWidth - 8);
  const boxHeight = Math.max(16, wrappedLines.length * 4.2 + 10);

  checkPageBreak(boxHeight + 5);

  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, yPos, contentWidth, boxHeight, 1.5, 1.5, 'FD');

  // Left vertical accent bar
  doc.setFillColor(16, 185, 129); // Emerald-500
  doc.rect(leftMargin, yPos, 2, boxHeight, 'F');

  // Analytical Notice
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(4, 120, 87);
  doc.text(
    'DECISION INTELLIGENCE NARRATIVE (CONFIRMED LEDGER SYNTHESIS)',
    leftMargin + 5,
    yPos + 4.5
  );

  // Wrapped narrative text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85); // Slate-700
  doc.text(wrappedLines, leftMargin + 5, yPos + 9.5);

  yPos += boxHeight + 6;

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. FOOTERS ON EVERY PAGE
  // ─────────────────────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(leftMargin, pageHeight - 12, rightMargin, pageHeight - 12);

    // Left footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(
      'Smart Invoice Chasing • Confidential Financial Recovery Audit Report',
      leftMargin,
      pageHeight - 7.5
    );

    // Right footer page count
    doc.text(`Page ${i} of ${totalPages}`, rightMargin, pageHeight - 7.5, {
      align: 'right',
    });
  }

  return doc;
}

/**
 * Build a valid PDF Blob and canonical filename from Recovery Report data.
 * Safe for execution in client browser or Node.js test environment.
 */
export function buildRecoveryReportPdfBlob(params: RecoveryReportPdfParams): {
  blob: Blob;
  filename: string;
} {
  const doc = generateRecoveryReportPdf(params);
  const filename = getRecoveryReportPdfFilename(
    params.reportSummary.month,
    params.reportSummary.year
  );

  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });

  return { blob, filename };
}

/**
 * Trigger client-side browser download for a PDF Blob.
 * Guarded against SSR / non-browser execution.
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('downloadPdfBlob can only be executed in a browser environment.');
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke object URL after delay to free memory
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}
