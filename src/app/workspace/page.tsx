'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { accountService, isUuid } from '../../services/accountService';
import {
  Check,
  Copy,
  Save,
  Plus,
} from 'lucide-react';

export default function WorkspacePage() {
  const { workspace, setWorkspace, user, showToast } = useApp();

  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Harshith S R';
  const userDisplayEmail = user?.email || workspace.businessEmail;

  // Editable Form State
  const [businessName, setBusinessName] = useState(workspace.businessName);
  const [businessType, setBusinessType] = useState(workspace.businessType || 'Agency & Services');
  const [businessEmail, setBusinessEmail] = useState(workspace.businessEmail || userDisplayEmail);
  const [phone, setPhone] = useState('+91 98765 43210');
  const [website, setWebsite] = useState('https://smartchasing.io');
  const [address, setAddress] = useState('100 Financial District, Tech Park');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [country, setCountry] = useState(workspace.country || 'India');
  const [postalCode, setPostalCode] = useState('560100');
  const [currency, setCurrency] = useState(workspace.currency || 'INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST)');

  const [copiedId, setCopiedId] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(workspace.id || 'ws_apex_98412_prod');
    setCopiedId(true);
    showToast('Workspace ID copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = {
        ...workspace,
        businessName,
        businessType,
        businessEmail,
        country,
        currency,
      };

      if (isUuid(workspace.id) && workspace.id !== 'ws-default') {
        const res = await accountService.updateWorkspace(workspace.id, {
          businessName,
          businessType,
          businessEmail,
          country,
          currency,
          businessPhone: phone,
          website,
          address,
          city,
          state,
          postalCode,
          timezone,
        });

        if (!res.success) {
          showToast(res.error || 'Failed to persist workspace in database.', 'error');
          return;
        }
      }

      setWorkspace(updated);
      showToast('Workspace business settings saved and persisted successfully!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save workspace.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-6 max-w-5xl mx-auto font-sans">
      {/* Shared Page Context Header */}
      <PageHeader
        title="Workspace Management"
        subtitle="Manage your business identity, workspace details, and team access."
        actions={
          <Link
            href="/settings?tab=ai"
            className="bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
          >
            Configure AI Rules &rarr;
          </Link>
        }
      />

      {/* SECTION A — WORKSPACE HEADER */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">{businessName}</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30 uppercase">
              ACTIVE WORKSPACE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            {businessType} &bull; Operating in {country} ({currency})
          </p>
          <div className="flex items-center gap-3 mt-3 text-xs">
            <span className="text-slate-400">Owner: <strong className="text-white">{userDisplayName}</strong></span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-emerald-400 font-mono font-bold">Plan: Early Access (₹999/mo)</span>
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 text-right shrink-0">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">WORKSPACE ID</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs text-emerald-400 font-bold">{workspace.id || 'ws_apex_98412_prod'}</span>
            <button
              onClick={handleCopyId}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Copy Workspace ID"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION B — BUSINESS INFORMATION (EDITABLE) */}
      <form onSubmit={handleSaveWorkspace} className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Business Information</h3>
          <span className="text-[10px] text-slate-500 font-mono">Corporate Identity</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Business / Workspace Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Business Type</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition"
            >
              <option value="Agency & Services">Agency & Services</option>
              <option value="SaaS & Software">SaaS & Software</option>
              <option value="Consulting & Professional Services">Consulting & Professional Services</option>
              <option value="Manufacturing & Logistics">Manufacturing & Logistics</option>
              <option value="E-Commerce & Retail">E-Commerce & Retail</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Finance Contact Email</label>
            <input
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Business Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Company Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Operating Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition font-mono font-bold"
            >
              <option value="INR">INR (₹) - Indian Rupee</option>
              <option value="USD">USD ($) - US Dollar</option>
              <option value="EUR">EUR (€) - Euro</option>
              <option value="GBP">GBP (£) - British Pound</option>
              <option value="AED">AED (Direct) - UAE Dirham</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Street Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">State / Province</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition font-mono"
            />
          </div>
        </div>

        <div className="pt-3 flex items-center justify-between border-t border-slate-800">
          <span className="text-[11px] text-slate-500">Shared workspace source of truth</span>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving Workspace...' : 'Save Workspace Info'}
          </button>
        </div>
      </form>

      {/* SECTION D — TEAM MEMBERS */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Workspace Team Members</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Manage member seats and role permissions.</p>
          </div>
          <button
            onClick={() => showToast('Team member invitations coming soon in Growth plan!', 'info')}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            Invite Team Member
          </button>
        </div>

        {/* Members Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Member Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              <tr className="hover:bg-slate-900/40 transition">
                <td className="py-3.5 px-4 font-sans font-bold text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-xs text-slate-950 shrink-0">
                    {userDisplayName.charAt(0).toUpperCase()}
                  </div>
                  <span>{userDisplayName}</span>
                </td>
                <td className="py-3.5 px-4 text-slate-300">{userDisplayEmail}</td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    OWNER
                  </span>
                </td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">Active</td>
                <td className="py-3.5 px-4 text-slate-400 text-[11px]">Sep 10, 2026</td>
                <td className="py-3.5 px-4 text-right text-slate-500 italic font-sans text-[11px]">
                  Primary Owner
                </td>
              </tr>
              <tr className="hover:bg-slate-900/40 transition">
                <td className="py-3.5 px-4 font-sans font-semibold text-slate-300 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-400 shrink-0">
                    F
                  </div>
                  <span>Finance Admin</span>
                </td>
                <td className="py-3.5 px-4 text-slate-400">finance-admin@company.com</td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    ADMIN
                  </span>
                </td>
                <td className="py-3.5 px-4 text-amber-400 font-bold">Pending Setup</td>
                <td className="py-3.5 px-4 text-slate-400 text-[11px]">Sep 12, 2026</td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={() => showToast('Team invitation management available in Growth tier.', 'info')}
                    className="text-emerald-400 hover:underline text-[11px] font-sans"
                  >
                    Resend Invite
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 flex items-center justify-between">
          <span>Team Seat Capacity: <strong>2 / 5 Seats Used</strong></span>
          <span className="text-emerald-400 font-mono">Team invitations coming soon in Growth plan.</span>
        </div>
      </div>

      {/* SECTION E — WORKSPACE OWNERSHIP & SECURITY */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-2xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
          Workspace Ownership & Security
        </h3>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div>
            <h4 className="font-bold text-white">Transfer Workspace Ownership</h4>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Transfer primary ownership to another verified admin within this organization.
            </p>
          </div>
          <button
            type="button"
            onClick={() => showToast('Ownership transfer protocols available via support ticket.', 'info')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl font-semibold transition cursor-pointer shrink-0"
          >
            Transfer Ownership
          </button>
        </div>
      </div>
    </div>
  );
}
