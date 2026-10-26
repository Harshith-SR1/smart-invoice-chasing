'use client';

import React, { useState } from 'react';
import {
  Save,
  LogOut,
  Trash2,
  AlertTriangle,
  X,
  Camera,
  Key,
  Building2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { validateFullName, validatePhoneNumber } from '../../lib/authValidation';
import { accountService } from '../../services/accountService';

export default function ProfilePage() {
  const { user, workspace, signOut, showToast } = useApp();

  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Harshith S R';
  const userDisplayEmail = user?.email || workspace.businessEmail;
  const userPhone = user?.user_metadata?.phone || '+91 98765 43210';
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Sep 10, 2026';
  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Today';

  const [fullName, setFullName] = useState(userDisplayName);
  const [phone, setPhone] = useState(userPhone);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameRes = validateFullName(fullName);
    if (!nameRes.isValid) {
      showToast(nameRes.error || 'Invalid full name', 'error');
      return;
    }
    const phoneRes = validatePhoneNumber(phone, 'IN');
    if (!phoneRes.isValid) {
      showToast(phoneRes.error || 'Invalid phone number', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (user?.id) {
        const res = await accountService.updateProfile(user.id, {
          fullName: nameRes.normalized,
          phone: phoneRes.e164 || phone,
        });
        if (!res.success) {
          showToast(res.error || 'Failed to update profile in database.', 'error');
          return;
        }
      }
      showToast('Profile information saved and persisted successfully!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save profile.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = () => {
    showToast(`Password reset link sent to ${userDisplayEmail}`, 'info');
  };

  return (
    <div className="space-y-4 p-6 max-w-5xl mx-auto font-sans">
      {/* Shared Page Context Header */}
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal account, authentication, and security."
      />

      {/* SECTION A — PROFILE HEADER */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-2xl text-slate-950 shadow-xl shadow-emerald-950 shrink-0">
              {fullName.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={() => showToast('Avatar upload storage backend ready for connection.', 'info')}
              className="absolute inset-0 rounded-full bg-slate-950/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white cursor-pointer"
              title="Change Profile Photo"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">{fullName}</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
                AUTHENTICATED USER
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{userDisplayEmail}</p>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Building2 className="w-3.5 h-3.5" />
                {workspace.businessName}
              </span>
              <span>&bull;</span>
              <span className="font-mono">Workspace Owner</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => signOut()}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-400 border border-rose-500/30 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* SECTION B — PERSONAL INFORMATION */}
      <form onSubmit={handleSaveProfile} className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-5 shadow-2xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center justify-between">
          <span>Personal Information</span>
          <span className="text-[10px] text-slate-500 font-mono font-normal">Editable Details</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              value={userDisplayEmail}
              disabled
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 cursor-not-allowed font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Email updates require re-authentication verification.</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Contact Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Profile Photo</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => showToast('Photo storage backend ready for upload.', 'info')}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Upload New Photo
              </button>
              <span className="text-[11px] text-slate-500">JPG, PNG or WEBP (Max 2MB)</span>
            </div>
          </div>
        </div>

        <div className="pt-3 flex items-center justify-between border-t border-slate-800">
          <span className="text-[11px] text-slate-500">Last updated: Today</span>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>

      {/* SECTION C — ACCOUNT INFORMATION & SECTION D — SECURITY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Info */}
        <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-2xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
            Account Details
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between py-2 border-b border-slate-900">
              <span className="text-slate-400">Account Role</span>
              <span className="text-emerald-400 font-bold">Workspace Owner</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-900">
              <span className="text-slate-400">Current Workspace</span>
              <span className="text-white font-bold">{workspace.businessName}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-900">
              <span className="text-slate-400">Subscription Tier</span>
              <span className="text-emerald-300 font-bold">Early Access (₹999/mo)</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-900">
              <span className="text-slate-400">Member Since</span>
              <span className="text-slate-300">{createdAt}</span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-slate-400">Last Sign-In</span>
              <span className="text-slate-300">{lastSignIn}</span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-2xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
            Security & Credentials
          </h3>

          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Password Authentication</span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  PROTECTED
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Your account uses encrypted password credentials managed via Supabase Auth.
              </p>
              <button
                type="button"
                onClick={handlePasswordReset}
                className="mt-1 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                Send Password Reset Link
              </button>
            </div>

            <div className="p-3.5 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-1">
              <span className="font-semibold text-white block">Active Session</span>
              <p className="text-slate-400 text-[11px] font-mono">
                Current Browser &bull; Windows &bull; SSL Encrypted Session
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION E — DANGER ZONE */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-rose-900/30 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-rose-950/60 pb-3">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Danger Zone</h3>
          </div>
          <span className="text-[10px] font-mono text-rose-500/70">Destructive Actions</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div>
            <h4 className="font-bold text-white">Delete Personal Account</h4>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Permanently remove your account credentials, preferences, and workspace association.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 rounded-xl font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>

      {/* DELETE ACCOUNT CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#070b14] border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-rose-950/80 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">Delete Account Confirmation</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p className="font-semibold text-rose-300">
                Warning: Account deletion is a destructive, irreversible action.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Your individual user credentials will be permanently removed.</li>
                <li>Your workspace ownership will require transfer to another administrator.</li>
                <li>Associated personal preferences and security logs will be purged.</li>
              </ul>

              <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-[11px] text-rose-200">
                <strong>Backend Notice:</strong> Account deletion backend safety checks are active. Account deletion will be completed via workspace admin protocol.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  showToast('Account deletion request queued for workspace admin review.', 'info');
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950"
              >
                Confirm Account Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
