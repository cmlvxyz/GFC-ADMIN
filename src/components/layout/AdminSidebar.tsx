import React from 'react';
import { 
  LayoutDashboard, Calendar, Image as ImageIcon, Users, Bell, 
  Activity, Settings, ExternalLink, LogOut, Globe, BookOpen
} from 'lucide-react';
import { User } from '../../types/index.ts';
import { openSiteOrExplain } from '../../services/site.ts';

interface AdminSidebarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  currentUser: User | null;
  onLogout: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  onNavigate,
  currentUser,
  onLogout,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'website-editor', label: 'Website', icon: Globe },
    { id: 'ledger', label: 'Tithes & Offering', icon: BookOpen },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'photos', label: 'All Photos', icon: ImageIcon },
    { id: 'people', label: 'Church People', icon: Users },
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'logs', label: 'Activity Logs', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white text-slate-700 flex flex-col shrink-0 h-screen sticky top-0 border-r border-slate-200 select-none z-30 shadow-xs">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white">
        <img
          src="/gfc-logo.png"
          alt="GFC Logo"
          className="w-10 h-10 rounded-full border-2 border-indigo-600 shadow-xs object-cover bg-white"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="font-extrabold text-slate-900 text-sm tracking-tight truncate">
              GFC Admin
            </h1>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-mono font-semibold">
              v2.1
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">Gospel Fellowship Church</p>
        </div>
      </div>

      {/* Database Connection Status Bar */}
      <div className="px-4 py-2 bg-emerald-50/70 border-b border-slate-100 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Shared GFC DB:
        </span>
        <span className="text-emerald-700 font-semibold font-mono">CONNECTED</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-bold border-l-3 border-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Public App Switcher Box */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <button
          onClick={() => openSiteOrExplain('/')}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-left text-xs transition-all cursor-pointer group"
        >
          <div>
            <p className="font-bold text-slate-900 text-[11px] group-hover:text-indigo-600">
              View Church Website
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Live member & visitor portal</p>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Current User Card */}
      {currentUser && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase shrink-0">
              {currentUser.name.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-xs truncate">{currentUser.name}</p>
              <p className="text-[10px] text-indigo-600 font-medium truncate">{currentUser.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Log Out"
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
};
