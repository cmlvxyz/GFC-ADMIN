import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Building, QrCode } from 'lucide-react';
import { ChurchSettings } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';
import { UsersView } from '../users/UsersView.tsx';

export const SettingsView: React.FC<{ onDatabaseReset?: () => void }> = ({ onDatabaseReset }) => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<ChurchSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await api.updateSettings(settings);
      showToast('success', 'Settings Saved', 'Church configuration and QR rules updated.');
    } catch (err: any) {
      showToast('error', 'Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDB = async () => {
    if (!window.confirm('Are you sure you want to reset the shared database to initial authentic seed data?')) {
      return;
    }

    setResetting(true);
    try {
      await api.resetDatabase();
      showToast('success', 'Database Reset', 'Sample events, photos, and QR codes restored.');
      const fresh = await api.getSettings();
      setSettings(fresh);
      if (onDatabaseReset) onDatabaseReset();
    } catch (err: any) {
      showToast('error', 'Reset Failed', err.message);
    } finally {
      setResetting(false);
    }
  };

  if (loading || !settings) {
    return <div className="p-12 text-center text-slate-400 text-xs">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900">Church & System Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure church organization metadata, attendance policies, and QR Code system behavior.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Church Identity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-sm">Church Identity & Contact</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Church Name</label>
              <input
                type="text"
                value={settings.churchName}
                onChange={(e) => setSettings({ ...settings, churchName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Abbreviation</label>
              <input
                type="text"
                value={settings.abbreviation}
                onChange={(e) => setSettings({ ...settings, abbreviation: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Motto / Tagline</label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Physical Address</label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={settings.contactPhone}
                onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
          </div>
        </div>

        {/* QR Code Preservation & Rules */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <QrCode className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-sm">QR Code System Configuration</h2>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-800">Event Check-In QR Verification</p>
                <p className="text-slate-500 text-[11px]">
                  Enables live camera and image scanning of attendee passes at church entrance.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.qrCheckInEnabled}
                onChange={(e) => setSettings({ ...settings, qrCheckInEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-800">All Photos QR Sharing</p>
                <p className="text-slate-500 text-[11px]">
                  Generates instant scannable QR codes on every photo in the gallery for quick mobile downloads.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.qrPhotoSharingEnabled}
                onChange={(e) => setSettings({ ...settings, qrPhotoSharingEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-800">Public Photo Submissions</p>
                <p className="text-slate-500 text-[11px]">
                  Allow church members to submit photos from events in the GFC Public App.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowPublicPhotoUpload}
                onChange={(e) => setSettings({ ...settings, allowPublicPhotoUpload: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Changes...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Admin Access - login accounts, kept separate from Church People */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-slate-900 mb-1">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-sm">Admin Access</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          These are the accounts that can sign in to this admin. Church members and leaders are managed
          under <span className="font-semibold">Church People</span> instead.
        </p>
        <UsersView embedded />
      </div>

      {/* Database Maintenance */}
      <div className="bg-rose-50/70 p-6 rounded-2xl border border-rose-200 shadow-xs">
        <div className="flex items-center gap-2 text-rose-900 mb-2">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <h2 className="font-bold text-sm">Database Maintenance & Reset</h2>
        </div>
        <p className="text-xs text-rose-700 leading-relaxed mb-4">
          Resetting the database reloads the default clean records for Gospel Fellowship Church (Events, All Photos, QR Codes, and initial Admin accounts).
        </p>
        <button
          onClick={handleResetDB}
          disabled={resetting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
          {resetting ? 'Resetting Database...' : 'Restore Initial Sample Database'}
        </button>
      </div>
    </div>
  );
};
