import React, { useEffect, useState } from 'react';
import { User as UserType } from '../../types/index.ts';
import { api } from '../../services/api.ts';

interface AdminHeaderProps {
  currentTab: string;
  currentUser: UserType | null;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  currentTab,
  currentUser,
}) => {
  // The giving verse belongs to the Tithes & Offering ledger, so it is only
  // shown while that tab is open.
  const [verse, setVerse] = useState<{ text: string; ref: string } | null>(null);

  useEffect(() => {
    if (currentTab !== 'ledger') return;
    api.getWebsiteContent()
      .then((c) => setVerse({ text: c.bannerVerse ?? '', ref: c.bannerVerseRef ?? '' }))
      .catch(() => setVerse(null));
  }, [currentTab]);

  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'System Overview & Dashboard';
      case 'website-editor':
        return 'Website Content & CMS Live Editor';
      case 'ledger':
        return 'Tithes & Offering Financial Ledger';
      case 'events':
        return 'Church Events Management';
      case 'photos':
        return 'All Photos Gallery';
      case 'people':
        return 'Church People';
      case 'announcements':
        return 'Church Bulletins & Announcements';
      case 'logs':
        return 'Activity Logs & System Audit';
      case 'settings':
        return 'Church Configuration';
      default:
        return 'GFC Administration';
    }
  };

  return (
    <header className="min-h-16 bg-white border-b border-slate-200 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-xs">
      {/* Title & Context */}
      <div>
        <h2 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
          {getTabTitle()}
        </h2>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            GFC Admin Portal
          </span>
          <span className="text-[11px] text-slate-300 hidden sm:inline">•</span>
          <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Live DB Sync Active
          </span>
        </div>
      </div>

      {/* Giving verse - Tithes & Offering only */}
      {currentTab === 'ledger' && verse?.text && (
        <div className="hidden xl:flex items-center text-center max-w-xl px-4 text-xs italic text-indigo-900 bg-indigo-50/70 border border-indigo-100 rounded-xl py-1.5">
          <span>
            {verse.text}{' '}
            {verse.ref && (
              <b className="font-semibold not-italic text-indigo-700">{verse.ref}</b>
            )}
          </span>
        </div>
      )}
    </header>
  );
};
