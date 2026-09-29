import React, { useState, useEffect } from 'react';
import { 
  Calendar, Image as ImageIcon, Users, Plus, ArrowUpRight, 
  Clock, Sparkles, Activity, BookOpen, Globe, Wallet, TrendingUp, TrendingDown 
} from 'lucide-react';
import { DashboardStats, GFCEvent, Photo, ActivityLog } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { Badge } from '../common/Badge.tsx';
import { useToast } from '../common/Toast.tsx';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenCreateEvent: () => void;
  onOpenUploadPhoto: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenCreateEvent,
  onOpenUploadPhoto,
}) => {
  const { showToast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<GFCEvent[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const formatPHP = (val: number | undefined) => {
    return '₱' + Number(val || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, eventsData, photosData, logsData] = await Promise.all([
        api.getStats(),
        api.getEvents({ status: 'published' }),
        api.getPhotos(),
        api.getActivityLogs(8),
      ]);
      setStats(statsData);
      setUpcomingEvents(eventsData.slice(0, 3));
      setRecentPhotos(photosData.slice(0, 4));
      setActivityLogs(logsData);
    } catch (err: any) {
      showToast('error', 'Failed to load dashboard', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner (Clean White with subtle border & accent) */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Gospel Fellowship Church • Connected System
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              GFC Church Administration
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Real-time administration connected to the shared GFC database. Manage upcoming worship services, all photo albums, church website content, and the official tithes &amp; offerings ledger.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('website-editor')}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Globe className="w-4 h-4" />
              <span>Edit Website</span>
            </button>

            <button
              onClick={() => onNavigate('ledger')}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-slate-600" />
              <span>Tithes Ledger</span>
            </button>

            <button
              onClick={onOpenCreateEvent}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-600" />
              <span>New Event</span>
            </button>

            <button
              onClick={onOpenUploadPhoto}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-slate-600" />
              <span>Upload Photo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tithes & Offerings Balance */}
        <div 
          onClick={() => onNavigate('ledger')}
          className="bg-white p-5 rounded-2xl border-2 border-indigo-200 hover:border-indigo-500 shadow-xs transition-all cursor-pointer group bg-indigo-50/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Church Funds Balance</p>
          <div className="mt-1">
            <span className="text-2xl font-black text-indigo-950">
              {formatPHP(stats?.totalLedgerBalance)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold">
            <span className="text-emerald-700">
              &uarr; {formatPHP(stats?.totalLedgerIn)} in
            </span>
            <span className="text-rose-700">
              &darr; {formatPHP(stats?.totalLedgerOut)} out
            </span>
          </div>
          <p className="text-[11px] text-indigo-700 font-medium mt-1">
            Tithes &amp; Offering Ledger
          </p>
        </div>

        {/* Total Events */}
        <div 
          onClick={() => onNavigate('events')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Events Management</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{stats?.totalEvents ?? '—'}</span>
            <span className="text-xs font-medium text-emerald-600">
              {stats?.upcomingEvents ?? 0} upcoming
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Worship services &amp; outreach
          </p>
        </div>

        {/* Total Photos */}
        <div 
          onClick={() => onNavigate('photos')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ImageIcon className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">All Photos</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{stats?.totalPhotos ?? '—'}</span>
            <span className="text-xs font-medium text-purple-600">
              {stats?.featuredPhotos ?? 0} featured
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Fellowship photo albums
          </p>
        </div>

        {/* Church People */}
        <div 
          onClick={() => onNavigate('people')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Church People</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{stats?.totalMembers ?? '—'}</span>
            <span className="text-xs font-medium text-slate-500">
              members &middot; {stats?.totalLeaders ?? 0} leaders
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Promoted from attendees
          </p>
        </div>
      </div>

      {/* Main Grid: Upcoming Events & Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upcoming Events (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Events Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Upcoming Church Events</h3>
                  <p className="text-xs text-slate-500">Scheduled services and ministry dates</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('events')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              >
                View All &rarr;
              </button>
            </div>

            {loading ? (
              <div className="py-10 text-center text-slate-400 text-xs">Loading events...</div>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No upcoming events scheduled.</p>
            ) : (
              <div className="space-y-3.5">
                {upcomingEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <img
                        src={evt.bannerUrl}
                        alt={evt.title}
                        className="w-16 h-14 object-cover rounded-lg shrink-0 border border-slate-200"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="primary" size="sm">
                            {evt.category}
                          </Badge>
                          <span className="text-[11px] font-semibold text-slate-500">{evt.date}</span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm truncate">{evt.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {evt.time}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => onNavigate('events')}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      >
                        Manage &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Photos Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Recent Church Photos</h3>
                  <p className="text-xs text-slate-500">Moments from Sunday worship and youth fellowships</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('photos')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              >
                Go to All Photos &rarr;
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {recentPhotos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => onNavigate('photos')}
                  className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-4/3 cursor-pointer"
                >
                  <img
                    src={photo.imageUrl}
                    alt={photo.title}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end">
                    <span className="text-[11px] text-white font-medium truncate">
                      {photo.title}
                    </span>
                    <span className="text-[9px] text-indigo-200 truncate">
                      {photo.albumName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Audit Feed */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Activity Feed</h3>
                <p className="text-xs text-slate-500">Audit trail of church updates</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('logs')}
              className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Full Log
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px]">
            {activityLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800">{log.action}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">{log.details}</p>
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span>By:</span>
                  <span className="font-medium text-slate-700">{log.performedBy}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
