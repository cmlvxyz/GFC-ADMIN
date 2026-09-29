import React, { useState, useEffect } from 'react';
import { Bell, Plus, Edit2, Trash2, CheckCircle2, AlertTriangle, X, Sparkles } from 'lucide-react';
import { Announcement } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { Badge } from '../common/Badge.tsx';
import { useToast } from '../common/Toast.tsx';

export const AnnouncementsView: React.FC = () => {
  const { showToast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'General' | 'Urgent' | 'Ministry' | 'Schedule'>('General');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [author, setAuthor] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await api.getAnnouncements(false);
      setAnnouncements(data);
    } catch (err: any) {
      showToast('error', 'Failed to load announcements', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const openForm = (ann?: Announcement) => {
    if (ann) {
      setEditingAnn(ann);
      setTitle(ann.title);
      setContent(ann.content);
      setCategory(ann.category);
      setPriority(ann.priority);
      setAuthor(ann.author);
      setIsActive(ann.isActive);
    } else {
      setEditingAnn(null);
      setTitle('');
      setContent('');
      setCategory('General');
      setPriority('normal');
      setAuthor('GFC Pastoral Leadership');
      setIsActive(true);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      if (editingAnn) {
        await api.updateAnnouncement(editingAnn.id, {
          title: title.trim(),
          content: content.trim(),
          category,
          priority,
          author: author.trim(),
          isActive,
        });
        showToast('success', 'Announcement Updated', `Updated "${title}"`);
      } else {
        await api.createAnnouncement({
          title: title.trim(),
          content: content.trim(),
          category,
          priority,
          author: author.trim(),
          isActive,
        });
        showToast('success', 'Announcement Published', `Published to GFC Public App`);
      }
      setIsModalOpen(false);
      loadAnnouncements();
    } catch (err: any) {
      showToast('error', 'Operation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ann: Announcement) => {
    if (!window.confirm(`Delete announcement "${ann.title}"?`)) return;
    try {
      await api.deleteAnnouncement(ann.id);
      showToast('success', 'Announcement Removed', `Deleted "${ann.title}"`);
      loadAnnouncements();
    } catch (err: any) {
      showToast('error', 'Delete Failed', err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Church Announcements & Bulletins</h1>
          <p className="text-xs text-slate-500 mt-1">
            Publish weekly announcements, urgent prayer requests, and ministry notices displayed in the GFC Member App.
          </p>
        </div>

        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Announcement
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
            No announcements currently posted.
          </div>
        ) : (
          announcements.map((ann) => (
            <div
              key={ann.id}
              className={`p-5 rounded-2xl border bg-white shadow-xs transition-all flex flex-col sm:flex-row justify-between gap-4 ${
                ann.priority === 'urgent'
                  ? 'border-rose-300 ring-1 ring-rose-200'
                  : ann.priority === 'important'
                  ? 'border-amber-300'
                  : 'border-slate-200'
              }`}
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      ann.priority === 'urgent'
                        ? 'danger'
                        : ann.priority === 'important'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {ann.priority.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {ann.category}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(ann.publishedAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base">{ann.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {ann.content}
                </p>
                <p className="text-[11px] text-slate-400">By {ann.author}</p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
                <button
                  onClick={() => openForm(ann)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(ann)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-slate-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <h3 className="font-semibold text-sm">
                {editingAnn ? 'Edit Announcement' : 'Post New Announcement'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule of Prayer Vigils"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="General">General</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Ministry">Ministry</option>
                    <option value="Schedule">Schedule</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Announcement Body *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Details of the announcement..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Author / Sign-off</label>
                <input
                  type="text"
                  placeholder="e.g. Pastor Edrian Clavel"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Posting...' : editingAnn ? 'Update' : 'Post to App'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
