'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  X,
  Loader2,
  Check,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { parseInvoiceFile, ParseResult, ColumnMapping } from '../../lib/invoiceParser';
import { ImportInvoicesBatchResult } from '../../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const { handleImportData, workspace, showToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'success' | 'error'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'update' | 'skip'>('update');
  const [importResult, setImportResult] = useState<ImportInvoicesBatchResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [customMapping, setCustomMapping] = useState<ColumnMapping>({
    invoiceNumber: '',
    customerName: '',
    customerEmail: '',
    amount: '',
    dueDate: '',
    issueDate: '',
    status: '',
    paidAmount: '',
    outstandingAmount: '',
  });

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent =
      'Invoice Number,Customer Name,Customer Email,Amount,Due Date,Issue Date,Status,Paid Amount\n' +
      'INV-001,Acme Enterprises,billing@acme.com,85000,2026-09-30,2026-09-01,unpaid,0\n' +
      'INV-002,Global Logistics,finance@globallog.com,120000,2026-09-15,2026-08-15,partially_paid,40000\n' +
      'INV-003,Starlight Media,accounts@starlight.io,65000,2026-08-20,2026-08-01,paid,65000\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'smart_invoice_chasing_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded sample CSV/Excel template!', 'info');
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    try {
      const result = await parseInvoiceFile(file);
      setParseResult(result);
      setCustomMapping(result.mapping);
      setStep('preview');
      showToast(`Parsed ${result.rows.length} rows from ${file.name}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to parse file. Please check format.', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleReParseWithMapping = async () => {
    if (!selectedFile) return;
    setIsParsing(true);
    try {
      const result = await parseInvoiceFile(selectedFile, customMapping);
      setParseResult(result);
      setStep('preview');
      showToast('Re-evaluated file with updated column mappings!', 'info');
    } catch (err: any) {
      showToast('Error re-parsing file', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parseResult) return;

    const validInvoices = parseResult.rows
      .filter((r) => r.errors.length === 0 && r.parsed)
      .map((r) => r.parsed!);

    if (validInvoices.length === 0) {
      showToast('No valid invoices to import. Please resolve errors.', 'error');
      return;
    }

    setStep('importing');
    setImportError(null);

    try {
      const result = await handleImportData(
        validInvoices,
        parseResult.fileName,
        parseResult.batchId,
        duplicateStrategy
      );

      setImportResult(result);

      if (result.success || result.importedCount > 0) {
        setStep('success');
      } else {
        setImportError(result.errors?.[0] || 'Database persistence failed. No records were written.');
        setStep('error');
      }
    } catch (err: any) {
      setImportError(err?.message || 'An unexpected error occurred while persisting invoices.');
      setStep('error');
    }
  };

  const currencySymbol = workspace.currency.includes('INR') || workspace.currency === 'INR' ? '₹' : '$';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl relative my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Import Invoices</h2>
              <p className="text-xs text-slate-400">
                Upload CSV or Excel (.csv, .xlsx, .xls) &bull; Exact source data persisted as single source of truth
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all ${
                  dragActive
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-4 border border-emerald-500/30">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-white text-base">Select or Drop your Invoice File</h3>
                  <p className="text-xs text-slate-400">
                    Supports <strong className="text-emerald-400">.csv</strong>, <strong className="text-emerald-400">.xlsx</strong>, and <strong className="text-emerald-400">.xls</strong> files
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs cursor-pointer transition shadow-lg shadow-emerald-500/20"
                  >
                    Browse Local File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    Download CSV Template
                  </button>
                </div>

                {isParsing && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400 font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Parsing file & detecting columns...</span>
                  </div>
                )}
              </div>

              {/* Supported Columns Guide */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <p className="font-bold text-slate-200 mb-2 flex items-center gap-1.5 text-xs">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  Auto-detected Columns:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 font-mono">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <strong className="text-slate-200 block">Invoice Number *</strong>
                    <span>invoice_no, bill #</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <strong className="text-slate-200 block">Customer Name *</strong>
                    <span>customer, client</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <strong className="text-slate-200 block">Amount *</strong>
                    <span>total, grand total</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <strong className="text-slate-200 block">Due Date *</strong>
                    <span>due_date, payment due</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Column Verification */}
          {step === 'preview' && parseResult && (
            <div className="space-y-6">
              {/* File Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{parseResult.fileName}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {parseResult.rows.length} Total Rows &bull; Batch: {parseResult.batchId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Total Invoiced</p>
                    <p className="text-sm font-bold text-white font-mono">
                      {currencySymbol}{parseResult.totalInvoiceAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="border-l border-slate-800 pl-4">
                    <p className="text-[10px] text-emerald-400 uppercase font-mono">Valid Records</p>
                    <p className="text-sm font-bold text-emerald-400 font-mono">
                      {parseResult.validCount} / {parseResult.rows.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Validation Warning Alert (if any errors) */}
              {parseResult.errorCount > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-white font-semibold">
                      {parseResult.errorCount} row(s) contain validation errors and will be skipped:
                    </strong>
                    <span className="text-[11px] text-rose-300/90">
                      Check missing invoice numbers, customers, or invalid dates in the preview table below.
                    </span>
                  </div>
                </div>
              )}

              {/* Exact Data Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                    Exact Source Data Preview ({parseResult.validCount} Valid Records)
                  </h4>
                  <button
                    onClick={() => setStep('mapping')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    Adjust Column Mapping
                  </button>
                </div>

                <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800 sticky top-0">
                        <th className="py-2.5 px-4">Row #</th>
                        <th className="py-2.5 px-3">Invoice Number</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {parseResult.rows.map((row) => {
                        const hasErrors = row.errors.length > 0;
                        return (
                          <tr
                            key={row.rowNumber}
                            className={`transition ${hasErrors ? 'bg-rose-950/20 text-rose-300' : 'hover:bg-slate-800/30 text-slate-200'}`}
                          >
                            <td className="py-2.5 px-4 text-slate-500 font-bold">#{row.rowNumber}</td>
                            <td className="py-2.5 px-3 font-bold text-white">
                              {row.parsed?.invoiceNumber || String(row.raw[parseResult.mapping.invoiceNumber] || '—')}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              {row.parsed?.customerName || String(row.raw[parseResult.mapping.customerName] || '—')}
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              {row.parsed ? `${currencySymbol}${row.parsed.amount.toLocaleString()}` : String(row.raw[parseResult.mapping.amount] || '—')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {row.parsed?.dueDate || String(row.raw[parseResult.mapping.dueDate] || '—')}
                            </td>
                            <td className="py-2.5 px-3 uppercase text-[10px]">
                              {row.parsed ? (
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {row.parsed.status}
                                </span>
                              ) : (
                                'Invalid'
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {hasErrors ? (
                                <span className="text-rose-400 font-bold text-[10px]">
                                  {row.errors[0]}
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-bold text-[10px] flex items-center justify-end gap-1">
                                  <Check className="w-3 h-3" /> Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Duplicate Handling Option */}
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <span className="text-white font-semibold block text-xs">Duplicate Invoice Policy</span>
                  <span className="text-[11px] text-slate-400">If an invoice number already exists in your workspace:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy('update')}
                    className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition cursor-pointer ${
                      duplicateStrategy === 'update'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    Update Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy('skip')}
                    className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition cursor-pointer ${
                      duplicateStrategy === 'skip'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    Skip Duplicates
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2B: Column Mapping Adjustment */}
          {step === 'mapping' && parseResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-white text-sm">Review Column Mapping</h3>
                  <p className="text-[11px] text-slate-400">Map your file columns to Smart Invoice Chasing fields.</p>
                </div>
                <button
                  onClick={() => setStep('preview')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Back to Preview
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Invoice Number *</label>
                  <select
                    value={customMapping.invoiceNumber}
                    onChange={(e) => setCustomMapping({ ...customMapping, invoiceNumber: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none"
                  >
                    {parseResult.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Customer Name *</label>
                  <select
                    value={customMapping.customerName}
                    onChange={(e) => setCustomMapping({ ...customMapping, customerName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none"
                  >
                    {parseResult.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Invoice Amount *</label>
                  <select
                    value={customMapping.amount}
                    onChange={(e) => setCustomMapping({ ...customMapping, amount: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none"
                  >
                    {parseResult.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Due Date *</label>
                  <select
                    value={customMapping.dueDate}
                    onChange={(e) => setCustomMapping({ ...customMapping, dueDate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none"
                  >
                    {parseResult.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Customer Email (Optional)</label>
                  <select
                    value={customMapping.customerEmail || ''}
                    onChange={(e) => setCustomMapping({ ...customMapping, customerEmail: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none"
                  >
                    <option value="">-- None / Auto-generate --</option>
                    {parseResult.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Status / Paid (Optional)</label>
                  <select
                    value={customMapping.status || ''}
                    onChange={(e) => setCustomMapping({ ...customMapping, status: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none"
                  >
                    <option value="">-- Auto-determine from Due Date --</option>
                    {parseResult.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleReParseWithMapping}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Apply & Re-validate Preview
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Importing */}
          {step === 'importing' && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Persisting Invoices to Canonical Database</h3>
                <p className="text-xs text-slate-400">
                  Creating customer records, calculating aging & risk metrics, and evaluating AI next-best actions...
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Success */}
          {step === 'success' && parseResult && (
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-white">Import Complete & Persisted</h3>
                <p className="text-xs text-slate-300">
                  Successfully processed file <strong className="text-white font-mono">{parseResult.fileName}</strong> for your workspace.
                </p>
                <p className="text-xs text-slate-400">
                  Database records updated. Dashboard, Invoices, Aging, and Reports reflect the authoritative state.
                </p>
              </div>

              {/* Import Breakdown Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-left">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">New Invoices</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {importResult ? importResult.insertedCount : parseResult.validCount}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Updated</span>
                  <span className="text-lg font-bold text-cyan-400 font-mono">
                    {importResult?.updatedCount ?? 0}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Skipped</span>
                  <span className="text-lg font-bold text-slate-400 font-mono">
                    {importResult?.skippedCount ?? 0}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Rejected</span>
                  <span className="text-lg font-bold text-rose-400 font-mono">
                    {importResult?.rejectedCount ?? parseResult.errorCount}
                  </span>
                </div>
              </div>

              {importResult && importResult.skippedCount > 0 ? (
                <p className="text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800 py-2 px-3 rounded-xl max-w-lg mx-auto">
                  Note: {importResult.skippedCount} duplicate invoice(s) were preserved without modification per your duplicate policy.
                </p>
              ) : null}
            </div>
          )}

          {/* STEP 5: Error */}
          {step === 'error' && (
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-xl font-bold text-white">Import Persistence Failed</h3>
                <p className="text-xs text-rose-300">
                  {importError || 'An error prevented the invoices from being saved to the database.'}
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  No partial or invalid financial records were committed. You can review your file and retry.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-t border-slate-800/80 bg-slate-950 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            {step === 'success' ? 'Close' : 'Cancel'}
          </button>

          {step === 'preview' && parseResult && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setParseResult(null);
                  setStep('upload');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition"
              >
                Choose Different File
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={parseResult.validCount === 0}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Confirm & Import {parseResult.validCount} Invoices</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep('preview')}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition"
              >
                Back to Preview
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Retry Import
              </button>
            </div>
          )}

          {step === 'success' && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              View Updated Dashboard
            </button>
          )}

        </div>
      </div>
    </div>
  );
};
