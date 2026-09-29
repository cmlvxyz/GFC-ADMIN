import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Save, Type, Search, RotateCcw, Check } from 'lucide-react';
import { api } from '../../services/api.ts';
import type { SiteCopyGroup } from '../../types/index.ts';

interface Props {
  onSaved?: () => void;
}

/**
 * Editor for every string the public website renders. Changes save straight to
 * `siteSettings`, which the site reads on its next load.
 */
export const WebsiteTextPanel: React.FC<Props> = ({ onSaved }) => {
  const [groups, setGroups] = useState<SiteCopyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({ nav: true });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSiteCopy();
      setGroups(res.groups);
      const next: Record<string, string> = {};
      for (const g of res.groups) for (const f of g.fields) next[f.key] = f.value;
      setDraft(next);
      // Open every group when a search is active so matches are visible.
      if (search.trim()) setOpen(Object.fromEntries(res.groups.map(g => [g.id, true])));
    } catch (err: any) {
      console.error('site-copy load failed', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dirtyKeys = useMemo(
    () => Object.keys(draft).filter(k => {
      const f = groups.flatMap(g => g.fields).find(x => x.key === k);
      return f && f.value !== draft[k];
    }),
    [draft, groups],
  );

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map(g => ({
        ...g,
        fields: g.fields.filter(f =>
          f.key.toLowerCase().includes(q) ||
          f.label.toLowerCase().includes(q) ||
          (draft[f.key] || '').toLowerCase().includes(q)),
      }))
      .filter(g => g.fields.length > 0);
  }, [groups, search, draft]);

  const totalMatches = visibleGroups.reduce((n, g) => n + g.fields.length, 0);

  const save = async () => {
    if (!dirtyKeys.length) return;
    setSaving(true);
    try {
      const values = Object.fromEntries(dirtyKeys.map(k => [k, draft[k]]));
      await api.saveSiteCopy(values);
      await load();
      onSaved?.();
    } catch (err: any) {
      console.error('site-copy save failed', err);
      alert(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const revert = (key: string) => {
    const original = groups.flatMap(g => g.fields).find(f => f.key === key)?.value ?? '';
    setDraft(d => ({ ...d, [key]: original }));
  };

  if (loading) {
    return <div className="text-sm text-slate-500 py-8 text-center">Loading website text...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Type className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Website Text</h3>
            <p className="text-xs text-slate-500">
              {totalMatches} field{totalMatches === 1 ? '' : 's'} shown. Anything you change here appears on the public site.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirtyKeys.length > 0 && (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
              {dirtyKeys.length} unsaved
            </span>
          )}
          <button
            onClick={save}
            disabled={saving || dirtyKeys.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search labels or text, e.g. navbar, prayer, footer..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {visibleGroups.map(group => {
        const isOpen = !!open[group.id];
        return (
          <div key={group.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <button
              onClick={() => setOpen(o => ({ ...o, [group.id]: !o[group.id] }))}
              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900">{group.title}</h4>
                <p className="text-[11px] text-slate-500 truncate">{group.blurb}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-400">{group.fields.length}</span>
                <span className="text-slate-400 text-xs">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 p-5 space-y-4">
                {group.fields.map(field => {
                  const changed = field.value !== draft[field.key];
                  const cls =
                    'w-full px-3 py-2 rounded-lg border text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white ' +
                    (changed ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200');
                  return (
                    <div key={field.key}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <label className="text-[11px] font-semibold text-slate-600">{field.label}</label>
                        {changed && (
                          <button
                            onClick={() => revert(field.key)}
                            title="Undo this change"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" /> undo
                          </button>
                        )}
                      </div>
                      {field.multiline ? (
                        <textarea
                          rows={3}
                          value={draft[field.key] ?? ''}
                          onChange={e => setDraft(d => ({ ...d, [field.key]: e.target.value }))}
                          className={cls + ' resize-y leading-relaxed'}
                        />
                      ) : (
                        <input
                          type="text"
                          value={draft[field.key] ?? ''}
                          onChange={e => setDraft(d => ({ ...d, [field.key]: e.target.value }))}
                          className={cls}
                        />
                      )}
                      <p className="text-[10px] text-slate-400 font-mono mt-1">{field.key}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {totalMatches === 0 && (
        <div className="text-center text-sm text-slate-500 py-8">No text matches "{search}".</div>
      )}

      {dirtyKeys.length > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 bg-slate-900 text-white rounded-2xl px-5 py-3 shadow-lg">
          <span className="text-xs font-semibold inline-flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            {dirtyKeys.length} change{dirtyKeys.length === 1 ? '' : 's'} waiting to save
          </span>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
};
