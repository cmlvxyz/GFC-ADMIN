import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, UserCheck, Crown, Trash2, ArrowRight, Users, Ticket, Loader2 } from 'lucide-react';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';
import { useSiteEvents, albumOptions, isYearAlbumEvent } from '../../services/siteEvents.ts';

type Pane = 'attendees' | 'members' | 'leaders';

const PANES: { id: Pane; label: string; icon: React.ElementType; blurb: string }[] = [
  { id: 'attendees', label: 'Attendees', icon: Ticket, blurb: 'People who registered or walked in. Promote them once they commit to joining.' },
  { id: 'members', label: 'Members', icon: Users, blurb: 'Committed members you are discipling. Promote the ones ready to serve.' },
  { id: 'leaders', label: 'Leaders', icon: Crown, blurb: 'The church leader list. These are the same leaders shown on the public website, so edits here go live there too.' },
];

/** Persons already promoted, so we can show "done" instead of offering it again. */
const nameKey = (v?: string) => (v ?? '').trim().toLowerCase();

export const ChurchPeopleView: React.FC = () => {
  const { showToast } = useToast();
  const { events: siteEvents } = useSiteEvents();

  const [pane, setPane] = useState<Pane>('attendees');
  const [attendees, setAttendees] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', phone: '', facebook: '', eventId: '', albumDate: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, m, l] = await Promise.all([api.getAttendees(), api.getMembers(), api.getLeaders()]);
      setAttendees(a);
      setMembers(m);
      setLeaders(l);
    } catch {
      showToast('error', 'Could not load church people.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const memberNames = useMemo(() => new Set(members.map((m) => nameKey(m.name))), [members]);
  const leaderNames = useMemo(() => new Set(leaders.map((l) => nameKey(l.name))), [leaders]);

  const rows = pane === 'attendees' ? attendees : pane === 'members' ? members : leaders;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) =>
      [r.name ?? r.attendeeName, r.email ?? r.attendeeEmail, r.phone ?? r.attendeePhone, r.role]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const openAdd = () => {
    const first = siteEvents[0]?.id ?? '';
    setDraft({ name: '', phone: '', facebook: '', eventId: first, albumDate: albumOptions(siteEvents[0])[0] ?? '' });
    setAdding(true);
  };

  // The album dropdown mirrors whatever albums the event already has on the
  // website, so a date added under Events turns up here automatically.
  const draftEvent = siteEvents.find(e => e.id === draft.eventId);
  const albumChoices = albumOptions(draftEvent);
  const isYearEvent = isYearAlbumEvent(draftEvent);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const ev = siteEvents.find((x) => x.id === draft.eventId);
      if (pane === 'attendees') {
        await api.addAttendee({
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          facebook: draft.facebook.trim(),
          albumDate: draft.albumDate,
          eventId: draft.eventId,
          eventTitle: ev?.title ?? '',
        });
      } else if (pane === 'members') {
        await api.addMember({ name: draft.name.trim(), phone: draft.phone.trim() });
      } else {
        await api.addLeader({ name: draft.name.trim(), phone: draft.phone.trim() });
      }
      setAdding(false);
      await load();
      showToast('success', `${draft.name.trim()} added.`);
    } catch (err: any) {
      showToast('error', err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const handlePromote = async (row: any) => {
    const id = pane === 'attendees' ? row.id : row.id;
    setBusyId(id);
    try {
      if (pane === 'attendees') {
        const m = await api.promoteAttendee(row.id);
        showToast('success', `${m.name} is now a member.`);
      } else {
        const l = await api.promoteMember(row.id);
        showToast('success', `${l.name} is now a leader.`);
      }
      await load();
    } catch (err: any) {
      showToast('error', err.message || 'Could not promote.');
    } finally {
      setBusyId(null);
    }
  };

  /** Leaders live in `pastors`, the same list the website renders. */
  const handleEditLeader = async (row: any, updates: Record<string, unknown>) => {
    setBusyId(row.id);
    try {
      await api.updateInCollection('pastors', row.id, updates as any);
      setLeaders((prev) => prev.map((l) => (l.id === row.id ? { ...l, ...updates } : l)));
      showToast('success', `${row.name} updated on the website.`);
    } catch (err: any) {
      showToast('error', err.message || 'Could not update.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (row: any) => {
    if (pane === 'leaders' && !window.confirm(`Remove ${row.name} from the website's leader list?`)) return;
    if (pane !== 'leaders' && !window.confirm(`Remove ${row.name ?? row.attendeeName}?`)) return;
    setBusyId(row.id);
    try {
      await api.removePerson(pane, row.id);
      await load();
      showToast('success', 'Removed.');
    } catch (err: any) {
      showToast('error', err.message || 'Could not remove.');
    } finally {
      setBusyId(null);
    }
  };

  const nameOf = (r: any) => r.name ?? r.attendeeName ?? '(no name)';
  const phoneOf = (r: any) => r.phone ?? r.attendeePhone ?? '';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Church People</h1>
          <p className="text-xs text-slate-500">
            Attendees become members, members become leaders.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add {pane === 'attendees' ? 'Attendee' : pane === 'members' ? 'Member' : 'Leader'}
        </button>
      </div>

      {/* Stage switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PANES.map((p) => {
          const Icon = p.icon;
          const count = p.id === 'attendees' ? attendees.length : p.id === 'members' ? members.length : leaders.length;
          const active = pane === p.id;
          return (
            <button
              key={p.id}
              onClick={() => { setPane(p.id); setSearch(''); }}
              className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                active ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider ${active ? 'text-indigo-700' : 'text-slate-500'}`}>
                  {p.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {count}
                </span>
              </div>
              <Icon className={`w-4 h-4 mb-1.5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
              <p className="text-[11px] text-slate-500 leading-snug">{p.blurb}</p>
            </button>
          );
        })}
      </div>

      {/* Add form */}
      {adding && (
        <form onSubmit={handleAdd} className="bg-white p-4 rounded-xl border border-indigo-200 space-y-3">
          {pane === 'attendees' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  autoFocus
                  placeholder="Full name *"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="px-3.5 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  placeholder="Contact number"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  className="px-3.5 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  placeholder="Facebook account"
                  value={draft.facebook}
                  onChange={(e) => setDraft({ ...draft, facebook: e.target.value })}
                  className="px-3.5 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-600 mb-1">Event</span>
                  <select
                    value={draft.eventId}
                    onChange={(e) => {
                      const next = siteEvents.find(x => x.id === e.target.value);
                      setDraft({ ...draft, eventId: e.target.value, albumDate: albumOptions(next)[0] ?? '' });
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {siteEvents.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-600 mb-1">
                    {isYearEvent ? 'Year' : 'Date'}
                  </span>
                  <select
                    value={draft.albumDate}
                    onChange={(e) => setDraft({ ...draft, albumDate: e.target.value })}
                    disabled={albumChoices.length === 0}
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  >
                    {albumChoices.length === 0 ? (
                      <option value="">No albums yet - add one under Events</option>
                    ) : (
                      albumChoices.map((d) => <option key={d} value={d}>{d}</option>)
                    )}
                  </select>
                </label>
              </div>

              {albumChoices.length === 0 && !isYearEvent && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  This event has no photo albums yet. Add a date under Events first, then it will
                  appear in this list.
                </p>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                autoFocus
                placeholder="Full name *"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="px-3.5 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                placeholder="Contact number"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                className="px-3.5 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading church people...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            {search ? 'Nobody matched your search.' : `No ${pane} yet. Add the first one above.`}
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Contact / Facebook</th>
                {pane === 'attendees' && <th className="py-3 px-4">Event / Album</th>}
                {pane === 'leaders' && <th className="py-3 px-4">Role</th>}
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r: any) => {
                const alreadyMoved =
                  pane === 'attendees' ? memberNames.has(nameKey(nameOf(r)))
                  : pane === 'members' ? leaderNames.has(nameKey(nameOf(r)))
                  : false;
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase border border-indigo-200">
                          {nameOf(r).slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{nameOf(r)}</p>
                          {pane !== 'attendees' && r.source && r.source !== 'manual' && (
                            <p className="text-[10px] text-slate-400">promoted</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-700">{phoneOf(r) || '-'}</p>
                      {r.attendeeFacebook && (
                        <p className="text-[11px] text-indigo-600 truncate max-w-[14rem]">{r.attendeeFacebook}</p>
                      )}
                    </td>
                    {pane === 'attendees' && (
                      <td className="py-3 px-4">
                        <p className="text-slate-600">{r.eventTitle || '-'}</p>
                        {r.albumDate && <p className="text-[11px] text-slate-400">{r.albumDate}</p>}
                      </td>
                    )}
                    {pane === 'leaders' && (
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          defaultValue={r.role || 'Leader'}
                          onBlur={(e) => handleEditLeader(r, { role: e.target.value })}
                          className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    <td className="py-3 px-4">
                      {alreadyMoved ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]">
                          {pane === 'attendees' ? <UserCheck className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                          {pane === 'attendees' ? 'Already a member' : 'Already a leader'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-[10px]">
                          {r.status || 'active'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {pane !== 'leaders' && (
                          <button
                            onClick={() => handlePromote(r)}
                            disabled={busyId === r.id || alreadyMoved}
                            title={pane === 'attendees' ? 'Add to members' : 'Add to leaders'}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-bold cursor-pointer"
                          >
                            {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                            {pane === 'attendees' ? 'Add to Members' : 'Add to Leaders'}
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(r)}
                          disabled={busyId === r.id}
                          title="Remove"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
