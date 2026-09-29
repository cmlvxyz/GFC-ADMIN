import React, { useState, useEffect } from 'react';
import { Activity, Search, RefreshCw, QrCode, Calendar, Image as ImageIcon, User, Bell } from 'lucide-react';
import { ActivityLog } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { Badge } from '../common/Badge.tsx';

export const ActivityLogsView: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getActivityLogs(100);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      l.performedBy.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Activity Logs & Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete record of administrative events, QR ticket entrance scans, photo uploads, and settings updates.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Feed
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">No activity logs recorded yet.</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">Performed By</th>
                <th className="py-3 px-4">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const isQR = log.entityType === 'qr_checkin';
                const isEvent = log.entityType === 'event';
                const isPhoto = log.entityType === 'photo';

                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {isQR ? (
                          <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <QrCode className="w-3.5 h-3.5" />
                          </div>
                        ) : isEvent ? (
                          <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                        ) : isPhoto ? (
                          <div className="w-6 h-6 rounded bg-purple-100 text-purple-700 flex items-center justify-center">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center">
                            <Activity className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className="font-bold text-slate-900">{log.action}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-md">{log.details}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{log.performedBy}</p>
                      <span className="text-[10px] text-slate-400">{log.role}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
