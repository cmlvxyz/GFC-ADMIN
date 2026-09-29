import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.ts';
import { User } from '../../types/index.ts';

interface LoginModalProps {
  onLoginSuccess: (user: User) => void;
  onSwitchToPublic: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, onSwitchToPublic }) => {
  const [email, setEmail] = useState('admin@gfc.org');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.login(email.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('admin123');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4">
      {/* Background radial effects */}
      <div className="absolute inset-0 bg-radial from-indigo-900/30 via-slate-950 to-slate-950 pointer-events-none"></div>

      <div className="relative max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-8 pb-6 text-center bg-gradient-to-b from-slate-900 to-indigo-950 text-white">
          <div className="w-16 h-16 rounded-full bg-white p-1 mx-auto mb-3 shadow-lg border-2 border-indigo-400">
            <img
              src="/gfc-logo.png"
              alt="GFC Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            Protected Administration
          </div>
          <h2 className="text-xl font-bold tracking-tight">GFC Admin Authentication</h2>
          <p className="text-xs text-indigo-200/80 mt-1">
            Gospel Fellowship Church Management Portal
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="p-8 pt-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gfc.org"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to GFC Admin'}
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Quick-fill Demo Accounts */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Quick Login Roles:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@gfc.org')}
                className="text-left p-2 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-[11px] transition-colors cursor-pointer"
              >
                <p className="font-semibold text-slate-800">Pastor Edrian</p>
                <p className="text-slate-400 text-[10px]">Super Admin</p>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('media@gfc.org')}
                className="text-left p-2 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-[11px] transition-colors cursor-pointer"
              >
                <p className="font-semibold text-slate-800">Bro. Joshua</p>
                <p className="text-slate-400 text-[10px]">Media Team</p>
              </button>
            </div>
          </div>

          {/* Switch to Public App */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onSwitchToPublic}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              &larr; Return to GFC Member App
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
