import React, { useState, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Sparkles, Tag, Folder } from 'lucide-react';
import { Photo, Album } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useSiteEvents } from '../../services/siteEvents.ts';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Photo>) => Promise<void>;
  albums: Album[];
  initialData?: Photo | null;
}

const CATEGORIES = [
  'Sunday Worship',
  'Youth Ministry',
  'Outreach & Missions',
  'Baptism',
  'Fellowship & Community',
  'Special Gatherings',
];

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  albums,
  initialData,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Sunday Worship');
  const [albumId, setAlbumId] = useState('');
  const [eventId, setEventId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The picker lists the church website's events, so an upload here lands in
  // the same event on the site.
  const { events: siteEvents } = useSiteEvents();

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setCategory(initialData.category);
      setAlbumId(initialData.albumId);
      setEventId(initialData.eventId || '');
      setImageUrl(initialData.imageUrl);
      setTagsInput(initialData.tags?.join(', ') || '');
      setIsFeatured(initialData.isFeatured);
    } else {
      setTitle('');
      setDescription('');
      setCategory('Sunday Worship');
      setAlbumId(albums[0]?.id || 'alb-1');
      setEventId(siteEvents[0]?.id || '');
      setImageUrl('https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80');
      setTagsInput('worship, gfc, church fellowship');
      setIsFeatured(false);
    }
    setError(null);
  }, [initialData, isOpen, albums, siteEvents]);

  if (!isOpen) return null;
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use FileReader for instant local preview and data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageUrl(event.target.result as string);
        if (!title) {
          const nameClean = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setTitle(nameClean.charAt(0).toUpperCase() + nameClean.slice(1));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !imageUrl.trim()) {
      setError('Please provide a Photo Title and Image URL or upload an image.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const tagsArray = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        albumId: albumId || albums[0]?.id || 'alb-1',
        eventId: eventId || null,
        // Carry the title so the website can match this photo to its event.
        eventTitle: siteEvents.find(e => e.id === eventId)?.title || null,
        imageUrl: imageUrl.trim(),
        tags: tagsArray.length > 0 ? tagsArray : ['gfc', 'fellowship'],
        isFeatured,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save photo.');
    } finally {
      setSubmitting(false);
    }
  };

  const sampleImages = [
    { label: 'Worship Team', url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80' },
    { label: 'Preaching Pulpit', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80' },
    { label: 'Youth Group', url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80' },
    { label: 'Outreach Feeding', url: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80' },
    { label: 'Water Baptism', url: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1200&q=80' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base">
                {initialData ? 'Edit Photo Metadata' : 'Upload to All Photos'}
              </h3>
              <p className="text-xs text-slate-300">
                Auto-generates dedicated QR Code share link and EXIF association
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
              {error}
            </div>
          )}

          {/* Image Preview & Upload Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Photo Image <span className="text-rose-500">*</span>
            </label>

            {imageUrl && (
              <div className="relative mb-3 h-48 w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg text-xs transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1 border border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 hover:bg-indigo-50/30 transition-colors">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>Upload from Device</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="flex-1">
                <input
                  type="url"
                  placeholder="Or paste direct image URL..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Quick Sample Image Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {sampleImages.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImageUrl(img.url)}
                  className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                    imageUrl === img.url
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {img.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Photo Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Worship Team Leading Communion Praise"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Photo Album</label>
              <select
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {albums.map((alb) => (
                  <option key={alb.id} value={alb.id}>
                    {alb.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Associated Church Event</label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">None (Independent Photo)</option>
                {siteEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Feature in Church Home Showcase
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Brief details about who is in the photo or what took place..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Search Tags (comma-separated)
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="e.g. worship, communion, choir, sunday"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* QR Code Preservation Notice */}
          <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl flex items-center gap-2.5 text-xs text-indigo-900">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Preserved All Photos QR Feature:</strong> A permanent QR Code for instant mobile scanning and high-res downloading will be generated for this photo.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : initialData ? 'Update Photo' : 'Upload to Gallery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
