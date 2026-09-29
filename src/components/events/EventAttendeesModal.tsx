import React, { useState, useEffect } from 'react';
import { X, Users, CheckCircle2, QrCode, Search, UserPlus, ShieldCheck } from 'lucide-react';
import { GFCEvent, Attendee } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { Badge } from '../common/Badge.tsx';
import { QRDisplayModal } from '../qr/QRDisplayModal.tsx';
import { useToast } from '../common/Toast.tsx';

interface EventAttendeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: GFCEvent;
  onAttendeeUpdated?: () => void;
}

export const EventAttendeesModal: React.FC<EventAttendeesModalProps> = ({
  isOpen,
  onClose,
  event,
  onAttendeeUpdated,
}) => {
  const { showToast } = useToast();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Attendee | null>(null);

  // New Attendee Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && event.id) {
      loadAttendees();
    }
  }, [isOpen, event.id]);

  const loadAttendees = async () => {
    setLoading(true);
    try {
      const data = await api.getEventAttendees(event.id);
      setAttendees(data);
    } catch (err: any) {
      showToast('error', 'Failed to load attendees', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckIn = async (attendee: Attendee) => {
    try {
      const result = await api.verifyQRCode(attendee.ticketCode, event.id);
      if (result.valid) {
        showToast('success', 'Checked In', `${attendee.attendeeName} marked as checked in!`);
        loadAttendees();
        if (onAttendeeUpdated) onAttendeeUpdated();
      } else {
        showToast('warning', 'Notice', result.message);
      }
    } catch (err: any) {
      showToast('error', 'Check-In Error', err.message);
    }
  };

  const handleAddAttendee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.registerAttendee(event.id, newName.trim(), newEmail.trim(), newPhone.trim());
      showToast('success', 'Attendee Registered', `Generated QR Ticket for ${newName.trim()}`);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setIsAdding(false);
      loadAttendees();
      if (onAttendeeUpdated) onAttendeeUpdated();
    } catch (err: any) {
      showToast('error', 'Registration Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredAttendees = attendees.filter(
    (a) =>
      a.attendeeName.toLowerCase().includes(search.toLowerCase()) ||
      a.attendeeEmail.toLowerCase().includes(search.toLowerCase()) ||
      a.ticketCode.toLowerCase().includes(search.toLowerCase())
  );

  const checkedInCount = attendees.filter((a) => a.status === 'checked_in').length;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[88vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Attendees & QR Tickets</h3>
                <p className="text-xs text-slate-300 truncate max-w-md">{event.title}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Stats Bar */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-slate-500">Total Registered:</span>{' '}
                <span className="font-bold text-slate-800">{attendees.length}</span>
              </div>
              <div>
                <span className="text-slate-500">Checked In:</span>{' '}
                <span className="font-bold text-emerald-600">{checkedInCount}</span>
              </div>
              <div>
                <span className="text-slate-500">Pending:</span>{' '}
                <span className="font-bold text-amber-600">{attendees.length - checkedInCount}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAdding(!isAdding)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {isAdding ? 'Close Form' : 'Register Attendee'}
              </button>
            </div>
          </div>

          {/* Add Attendee Form Drawer */}
          {isAdding && (
            <form onSubmit={handleAddAttendee} className="p-4 bg-indigo-50/60 border-b border-indigo-100 flex flex-wrap gap-2.5 items-end text-xs shrink-0">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Santos"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="w-32">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="+63 9..."
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? 'Generating...' : 'Issue QR Ticket'}
              </button>
            </form>
          )}

          {/* Search bar */}
          <div className="p-4 border-b border-slate-200 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search attendee name, email, or ticket code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Attendees Table */}
          <div className="overflow-y-auto flex-1 p-4">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Loading attendee records...
              </div>
            ) : filteredAttendees.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No registered attendees found. Use the "Register Attendee" button above or member self-registration in the GFC App.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="pb-2.5">Attendee</th>
                    <th className="pb-2.5">Ticket Code</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5">Check-In Time</th>
                    <th className="pb-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttendees.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3">
                        <p className="font-semibold text-slate-900">{att.attendeeName}</p>
                        <p className="text-[11px] text-slate-500">{att.attendeeEmail}</p>
                      </td>
                      <td className="py-3 font-mono font-medium text-slate-700">
                        {att.ticketCode}
                      </td>
                      <td className="py-3">
                        {att.status === 'checked_in' ? (
                          <Badge variant="success">Checked In</Badge>
                        ) : (
                          <Badge variant="warning">Confirmed</Badge>
                        )}
                      </td>
                      <td className="py-3 text-slate-500 text-[11px]">
                        {att.checkedInAt ? new Date(att.checkedInAt).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => setSelectedTicket(att)}
                          title="View Personal QR Ticket"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 font-medium text-[11px] transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                          View QR
                        </button>

                        {att.status !== 'checked_in' && (
                          <button
                            onClick={() => handleManualCheckIn(att)}
                            title="Manually Check In"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-medium text-[11px] transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Check In
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Individual Attendee QR Ticket Preview Modal */}
      {selectedTicket && (
        <QRDisplayModal
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          title={`GFC Ticket: ${selectedTicket.attendeeName}`}
          subtitle={`${event.title} • Ticket: ${selectedTicket.ticketCode}`}
          qrValue={selectedTicket.qrData}
          entityType="ticket"
          metadata={[
            { label: 'Event', value: event.title },
            { label: 'Date & Time', value: `${event.date} • ${event.time}` },
            { label: 'Attendee', value: selectedTicket.attendeeName },
            { label: 'Ticket Code', value: selectedTicket.ticketCode },
            { label: 'Status', value: selectedTicket.status.toUpperCase() },
          ]}
        />
      )}
    </>
  );
};
