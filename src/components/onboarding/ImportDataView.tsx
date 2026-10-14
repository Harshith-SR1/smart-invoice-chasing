'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  FileCheck,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { parseInvoiceFile, ParseResult } from '../../lib/invoiceParser';

export const ImportDataView: React.FC = () => {
  const { setActiveScreen, handleImportData, showToast, invoices } = useApp();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const handleDownloadTemplate = () => {
    const csvContent =
      'Invoice Number,Customer,Customer Email,Amount,Issue Date,Due Date,Status,Paid Amount\n' +
      'INV-1042,Rahul Enterprises,rahul@rahulenterprises.in,85000,2026-06-15,2026-06-30,overdue,0\n' +
      'INV-1088,ABC Pvt Ltd,accounts@abcpvtltd.com,180000,2026-06-08,2026-06-22,overdue,0\n' +
      'INV-1102,Nexus Tech Solutions,priya.nair@nexustech.io,250000,2026-08-15,2026-08-30,promised,0\n' +
      'INV-1105,Zenith Logistics,finance@zenithlogistics.in,45000,2026-07-01,2026-07-15,paid,45000\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'smart_invoice_chasing_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded sample CSV template!', 'info');
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    setSelectedFile(file);
    try {
      const result = await parseInvoiceFile(file, undefined, invoices);
      setParseResult(result);
      if (result.validCount > 0) {
        showToast(`Parsed ${result.validCount} valid invoices from ${file.name}!`, 'success');
      } else {
        showToast(`No valid invoices found in ${file.name}. Please check column mappings.`, 'error');
      }
    } catch (err: any) {
      showToast(`Error parsing file: ${err.message || 'Unknown error'}`, 'error');
      setParseResult(null);
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

  const handleCustomFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleProceedToAnalysis = () => {
    if (parseResult && parseResult.validCount > 0) {
      const validRows = parseResult.rows
        .filter((r) => r.errors.length === 0 && r.parsed)
        .map((r) => r.parsed!);

      handleImportData(validRows, parseResult.fileName, parseResult.batchId, 'update');
      showToast(`Imported ${validRows.length} real invoices into workspace!`, 'success');
    }
    setActiveScreen('ai_processing');
  };

  const overdueInvoicesCount = parseResult?.rows.filter((r) => r.parsed && r.parsed.status === 'overdue').length ?? 0;
  const activeFollowupsCount = parseResult?.rows.filter((r) => r.parsed && (r.parsed.status === 'chasing' || r.parsed.status === 'promised')).length ?? 0;

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-slate-800/80 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Step 2 of 3 &bull; Historical Recovery Import
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Bring your existing receivables</h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload your CSV or Excel file. Data is imported directly into your workspace with zero fabrication.
            </p>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Download Sample CSV
          </button>
        </div>

        {/* Drag & Drop Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
            dragActive
              ? 'border-emerald-500 bg-emerald-500/10'
              : selectedFile
              ? 'border-emerald-500/50 bg-slate-900/60'
              : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-4 border border-emerald-500/30">
            {isParsing ? <Loader2 className="w-7 h-7 animate-spin" /> : <UploadCloud className="w-7 h-7" />}
          </div>

          {selectedFile ? (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-full text-xs font-mono font-medium">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                {selectedFile.name}
              </div>
              <p className="text-xs text-slate-400">
                {isParsing ? 'Parsing spreadsheet rows...' : 'File parsed & ready for AI Analysis'}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-bold text-white text-base">Drag & Drop your CSV or Excel file here</p>
              <p className="text-xs text-slate-400 mt-1">Supports .csv, .xlsx, .xls (exact source data parsing)</p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-4">
            <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer border border-slate-700 transition">
              <span>{selectedFile ? 'Choose Another File' : 'Browse Files'}</span>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleCustomFileInput} className="hidden" />
            </label>
          </div>
        </div>

        {/* File Analysis Preview Stats */}
        {parseResult && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Exact Source Data Validation
              </p>
              {parseResult.errorCount > 0 && (
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                  {parseResult.errorCount} row(s) skipped/with issues
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-[11px] text-slate-400">Valid Invoices</p>
                <p className="text-xl font-bold text-white font-mono mt-0.5">{parseResult.validCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-[11px] text-rose-400 font-semibold">Overdue Invoices</p>
                <p className="text-xl font-bold text-rose-400 font-mono mt-0.5">{overdueInvoicesCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-[11px] text-amber-400 font-semibold">Active Pipeline</p>
                <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">{activeFollowupsCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-[11px] text-emerald-400 font-semibold">Total Outstanding</p>
                <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                  ₹{parseResult.totalOutstandingAmount.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Planned Integration Badges */}
        <div className="mt-6 pt-4 border-t border-slate-800/80">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2">
            Direct Accounting Connections (Coming Soon)
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            {['Zoho Books', 'QuickBooks', 'Xero', 'Tally Prime', 'Gmail', 'Outlook'].map((item, idx) => (
              <span key={idx} className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setActiveScreen('dashboard')}
            className="text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            Skip for now (empty workspace)
          </button>

          <button
            onClick={handleProceedToAnalysis}
            disabled={isParsing}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-3.5 rounded-xl transition shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-3 text-sm cursor-pointer disabled:opacity-50"
          >
            {parseResult && parseResult.validCount > 0 ? 'Analyze My Data with AI' : 'Proceed to Dashboard'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
