import React, { useState, useEffect } from 'react';
import { 
  Globe, Save, RotateCcw, CheckCircle2, Image as ImageIcon, 
  BookOpen, Heart, Clock, MapPin, Mail, Phone, Plus, Trash2 
} from 'lucide-react';
import { WebsiteContent } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';
import { WebsiteTextPanel } from './WebsiteTextPanel.tsx';

interface WebsiteEditorViewProps {
}

export const WebsiteEditorView: React.FC<WebsiteEditorViewProps> = () => {
  const { showToast } = useToast();
  const [content, setContent] = useState<WebsiteContent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'hero' | 'about' | 'events' | 'verse' | 'prayer' | 'contact' | 'branding' | 'text'>('hero');

  // Collections that are edited per-item on their own website page.
  const [siteEvents, setSiteEvents] = useState<any[]>([]);
  const [verses, setVerses] = useState<any[]>([]);
  const [prayers, setPrayers] = useState<any[]>([]);

  const loadCollections = async () => {
    try {
      const [se, vs, pr] = await Promise.all([
        api.getSiteEvents(),
        api.getCollection('verses'),
        api.getCollection('prayers'),
      ]);
      setSiteEvents(se as any[]);
      setVerses(vs);
      setPrayers(pr);
    } catch {
      /* the settings form still works without these */
    }
  };

  const updateSiteEvent = async (id: string, updates: Record<string, unknown>) => {
    try {
      await api.updateInCollection('siteEvents', id, updates as any);
      setSiteEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
      showToast('success', 'Event cover updated');
    } catch (err: any) {
      showToast('error', 'Could not update event', err.message);
    }
  };

  const updateCollectionItem = async (key: string, id: string, updates: Record<string, unknown>) => {
    try {
      await api.updateInCollection(key, id, updates as any);
      showToast('success', 'Saved');
    } catch (err: any) {
      showToast('error', 'Could not save', err.message);
    }
  };

  const addCollectionItem = async (key: string, record: Record<string, unknown>) => {
    try {
      const created = await api.addToCollection(key, record as any);
      if (key === 'verses') setVerses((prev) => [...prev, created]);
      showToast('success', 'Added');
    } catch (err: any) {
      showToast('error', 'Could not add', err.message);
    }
  };

  const removeCollectionItem = async (key: string, id: string) => {
    if (!window.confirm('Remove this item?')) return;
    try {
      await api.removeFromCollection(key, id);
      if (key === 'verses') setVerses((prev) => prev.filter((v) => v.id !== id));
      if (key === 'prayers') setPrayers((prev) => prev.filter((p) => p.id !== id));
      showToast('success', 'Removed');
    } catch (err: any) {
      showToast('error', 'Could not remove', err.message);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getWebsiteContent();
      setContent(data);
    } catch (err: any) {
      showToast('error', 'Failed to load website content', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadCollections();
  }, []);

  const handleChange = (field: keyof WebsiteContent, value: any) => {
    if (!content) return;
    setContent({
      ...content,
      [field]: value,
    });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content) return;

    setSaving(true);
    try {
      const updated = await api.updateWebsiteContent(content);
      setContent(updated);
      showToast('success', 'Website Updated!', 'All website descriptions and images have been saved live.');
    } catch (err: any) {
      showToast('error', 'Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddService = () => {
    if (!content) return;
    const newService = {
      name: 'New Ministry Gathering',
      dayTime: 'Fridays 7:00 PM - 8:30 PM',
      description: 'Fellowship and prayer gathering in the sanctuary.',
    };
    setContent({
      ...content,
      serviceTimes: [...(content.serviceTimes || []), newService],
    });
  };

  const handleUpdateService = (index: number, key: 'name' | 'dayTime' | 'description', val: string) => {
    if (!content) return;
    const list = [...(content.serviceTimes || [])];
    list[index] = { ...list[index], [key]: val };
    setContent({ ...content, serviceTimes: list });
  };

  const handleDeleteService = (index: number) => {
    if (!content) return;
    const list = content.serviceTimes.filter((_, i) => i !== index);
    setContent({ ...content, serviceTimes: list });
  };

  if (loading || !content) {
    return (
      <div className="py-20 text-center text-slate-400 text-xs">
        Loading website editor configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Website Content &amp; CMS Live Editor
            </h1>
            <p className="text-xs text-slate-500">
              Edit all church website descriptions, headlines, verses, and photos live.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>

      {/* Editor Navigation Tabs - mirrors the website's own routes in
          Desktop/GFC (Header.tsx navLinks) so an edit here lands on the page
          it looks like it belongs to. */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-wrap gap-1">
        {[
          { id: 'hero', label: 'Home', route: '/' },
          { id: 'about', label: 'About', route: '/about' },
          { id: 'events', label: 'Events', route: '/events' },
          { id: 'verse', label: 'Verse', route: '/verse' },
          { id: 'prayer', label: 'Prayer', route: '/prayer' },
          { id: 'contact', label: 'Contact & Giving', route: '/contact' },
          { id: 'branding', label: 'Site-wide Branding', route: null },
          { id: 'text', label: 'Website Text', route: null },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {tab.route && (
              <span className="ml-1.5 font-mono text-[10px] opacity-60">{tab.route}</span>
            )}
          </button>
        ))}
      </div>

      {/* Form Content Area */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        {/* 1. HERO BANNER */}
        {activeTab === 'hero' && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Hero Banner &amp; Welcome</h2>
              <p className="text-xs text-slate-500">
                This is the first section visitors see when they open your church website.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Welcome Badge Text
                </label>
                <input
                  type="text"
                  value={content.heroBadge}
                  onChange={(e) => handleChange('heroBadge', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hero Headline
                </label>
                <input
                  type="text"
                  value={content.heroHeadline}
                  onChange={(e) => handleChange('heroHeadline', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hero Subtitle / Description Paragraph
                </label>
                <textarea
                  rows={3}
                  value={content.heroDescription}
                  onChange={(e) => handleChange('heroDescription', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primary Action Button Text
                </label>
                <input
                  type="text"
                  value={content.ctaButtonText}
                  onChange={(e) => handleChange('ctaButtonText', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Secondary Action Button Text
                </label>
                <input
                  type="text"
                  value={content.ctaSecondaryText}
                  onChange={(e) => handleChange('ctaSecondaryText', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hero Background Image URL
                </label>
                <input
                  type="text"
                  value={content.heroImageUrl}
                  onChange={(e) => handleChange('heroImageUrl', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
                {content.heroImageUrl && (
                  <div className="mt-2 h-36 rounded-xl overflow-hidden border border-slate-200 relative">
                    <img
                      src={content.heroImageUrl}
                      alt="Hero preview"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                      Image Preview
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. BRANDING & SCRIPTURE */}
        {activeTab === 'text' && (
          <WebsiteTextPanel onSaved={() => showToast('success', 'Website text saved. It shows on the site right away.')} />
        )}

        {activeTab === 'branding' && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Church Brand &amp; Scripture</h2>
              <p className="text-xs text-slate-500">
                Configure your church name, motto, and banner scripture verse.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Church Name
                </label>
                <input
                  type="text"
                  value={content.churchName}
                  onChange={(e) => handleChange('churchName', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tagline / Subheading
                </label>
                <input
                  type="text"
                  value={content.tagline}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Church Sub-tagline / Mission Motto
                </label>
                <input
                  type="text"
                  value={content.subTagline}
                  onChange={(e) => handleChange('subTagline', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Banner Scripture Verse Text
                </label>
                <textarea
                  rows={2}
                  value={content.bannerVerse}
                  onChange={(e) => handleChange('bannerVerse', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bible Citation Reference
                </label>
                <input
                  type="text"
                  value={content.bannerVerseRef}
                  onChange={(e) => handleChange('bannerVerseRef', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Church Logo Image URL
                </label>
                <input
                  type="text"
                  value={content.logoUrl}
                  onChange={(e) => handleChange('logoUrl', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. ABOUT US & PASTOR MESSAGE */}
        {activeTab === 'about' && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">About Church &amp; Pastor's Welcome</h2>
              <p className="text-xs text-slate-500">
                Descriptions of your church history, mission, vision, and pastoral leadership.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  About Section Title
                </label>
                <input
                  type="text"
                  value={content.aboutTitle}
                  onChange={(e) => handleChange('aboutTitle', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  About Church Full Description
                </label>
                <textarea
                  rows={4}
                  value={content.aboutDescription}
                  onChange={(e) => handleChange('aboutDescription', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mission Statement
                </label>
                <textarea
                  rows={3}
                  value={content.mission}
                  onChange={(e) => handleChange('mission', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vision Statement
                </label>
                <textarea
                  rows={3}
                  value={content.vision}
                  onChange={(e) => handleChange('vision', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senior Pastor Name
                </label>
                <input
                  type="text"
                  value={content.pastorName}
                  onChange={(e) => handleChange('pastorName', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pastor Role / Title
                </label>
                <input
                  type="text"
                  value={content.pastorRole}
                  onChange={(e) => handleChange('pastorRole', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pastor's Welcome Letter Title
                </label>
                <input
                  type="text"
                  value={content.pastorWelcomeTitle}
                  onChange={(e) => handleChange('pastorWelcomeTitle', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pastor's Welcome Message
                </label>
                <textarea
                  rows={3}
                  value={content.pastorWelcomeMessage}
                  onChange={(e) => handleChange('pastorWelcomeMessage', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pastor Photo URL
                </label>
                <input
                  type="text"
                  value={content.pastorImageUrl}
                  onChange={(e) => handleChange('pastorImageUrl', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* GIVING & STEWARDSHIP (shown on the Contact & Giving tab) */}
        {activeTab === 'contact' && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Tithes, Offerings &amp; Giving Portal</h2>
              <p className="text-xs text-slate-500">
                Information displayed to church members for online tithes, bank transfers, and GCash offerings.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Giving Section Title
                </label>
                <input
                  type="text"
                  value={content.givingTitle}
                  onChange={(e) => handleChange('givingTitle', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Giving Description &amp; Encouragement
                </label>
                <textarea
                  rows={3}
                  value={content.givingDescription}
                  onChange={(e) => handleChange('givingDescription', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Giving Scripture Verse
                </label>
                <input
                  type="text"
                  value={content.givingVerse}
                  onChange={(e) => handleChange('givingVerse', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Giving Verse Reference
                </label>
                <input
                  type="text"
                  value={content.givingVerseRef}
                  onChange={(e) => handleChange('givingVerseRef', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bank Account Deposit Details
                </label>
                <textarea
                  rows={3}
                  value={content.bankAccountDetails}
                  onChange={(e) => handleChange('bankAccountDetails', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GCash Mobile Wallet Details
                </label>
                <textarea
                  rows={3}
                  value={content.gcashDetails}
                  onChange={(e) => handleChange('gcashDetails', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. SERVICE TIMES */}
        {activeTab === 'hero' && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Service Times &amp; Schedule</h2>
                <p className="text-xs text-slate-500">
                  Manage weekly worship services and ministry gatherings.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddService}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Gathering</span>
              </button>
            </div>

            <div className="space-y-3">
              {(content.serviceTimes || []).map((srv, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-slate-700">Gathering #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteService(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                      title="Remove gathering"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Service Name
                      </label>
                      <input
                        type="text"
                        value={srv.name}
                        onChange={(e) => handleUpdateService(idx, 'name', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Day &amp; Time
                      </label>
                      <input
                        type="text"
                        value={srv.dayTime}
                        onChange={(e) => handleUpdateService(idx, 'dayTime', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Description / Location
                      </label>
                      <input
                        type="text"
                        value={srv.description}
                        onChange={(e) => handleUpdateService(idx, 'description', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. CONTACT & SOCIAL */}
        {activeTab === 'contact' && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Church Location &amp; Contact Info</h2>
              <p className="text-xs text-slate-500">
                Church address, phone, email, and social media channels.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Physical Sanctuary Address
                </label>
                <input
                  type="text"
                  value={content.contactAddress}
                  onChange={(e) => handleChange('contactAddress', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  value={content.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Email Address
                </label>
                <input
                  type="email"
                  value={content.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official Facebook Page URL
                </label>
                <input
                  type="url"
                  value={content.facebookUrl}
                  onChange={(e) => handleChange('facebookUrl', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* EVENTS PAGE - per-event cover art on /events */}
        {activeTab === 'events' && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Events Page</h2>
              <p className="text-xs text-slate-500">
                The cover image shown on each event card. Albums and photos are managed under the
                Events tab, and the order here is the order the website renders.
              </p>
            </div>
            {siteEvents.length === 0 ? (
              <p className="text-xs text-slate-500">Loading events...</p>
            ) : (
              <div className="space-y-3">
                {siteEvents.map((ev, i) => (
                  <div key={ev.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{ev.title}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{ev.id} &middot; {ev.dateEntries.length} albums</p>
                    </div>
                    <input
                      type="text"
                      defaultValue={ev.image ?? ''}
                      placeholder="Cover image path or URL"
                      onBlur={(e) => updateSiteEvent(ev.id, { image: e.target.value })}
                      className="w-64 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] focus:outline-indigo-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VERSE OF THE DAY - /verse */}
        {activeTab === 'verse' && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Verse of the Day</h2>
                <p className="text-xs text-slate-500">
                  These rotate on the website's <span className="font-mono">/verse</span> page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => addCollectionItem('verses', { text: '', ref: '' })}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Verse
              </button>
            </div>
            {verses.length === 0 ? (
              <p className="text-xs text-slate-500">No verses yet. Add the first one.</p>
            ) : (
              <div className="space-y-3">
                {verses.map((v: any) => (
                  <div key={v.id} className="p-3 rounded-xl border border-slate-200 space-y-2">
                    <textarea
                      rows={2}
                      defaultValue={v.text}
                      placeholder="Verse text"
                      onBlur={(e) => updateCollectionItem('verses', v.id, { text: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-indigo-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        defaultValue={v.ref}
                        placeholder="Reference, e.g. Psalm 23:1"
                        onBlur={(e) => updateCollectionItem('verses', v.id, { ref: e.target.value })}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] focus:outline-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeCollectionItem('verses', v.id)}
                        title="Remove verse"
                        className="px-2.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRAYER REQUESTS - /prayer */}
        {activeTab === 'prayer' && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Prayer Requests</h2>
              <p className="text-xs text-slate-500">
                Submitted from the website's <span className="font-mono">/prayer</span> page. Only
                approved requests are shown publicly.
              </p>
            </div>
            {prayers.length === 0 ? (
              <p className="text-xs text-slate-500">No prayer requests submitted yet.</p>
            ) : (
              <div className="space-y-2">
                {prayers.map((p: any) => (
                  <div key={p.id} className="p-3 rounded-xl border border-slate-200 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900">{p.name}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">{p.request}</p>
                      {p.contact && <p className="text-[10px] text-slate-400 mt-0.5">{p.contact}</p>}
                    </div>
                    <select
                      value={p.status ?? 'pending'}
                      onChange={(e) => updateCollectionItem('prayers', p.id, { status: e.target.value })}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] focus:outline-indigo-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="answered">Answered</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeCollectionItem('prayers', p.id)}
                      title="Remove request"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom Save Bar */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Changes will take effect instantly across the entire church website.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Changes...' : 'Save All Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
