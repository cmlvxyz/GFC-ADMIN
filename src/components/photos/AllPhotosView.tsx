import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, QrCode, Image as ImageIcon, Folder, Eye, Trash2, Plus, 
  Upload, X, Check, ExternalLink, ArrowLeft 
} from 'lucide-react';
import { Photo, Album } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { generateQRCodeDataURL } from '../../utils/qr.ts';
import { useToast } from '../common/Toast.tsx';

interface MonthAlbum {
  id: string;
  name: string;
  month: string;
  year: string;
  photoCount: number;
  coverImage?: string;
  photos: Photo[];
}

export const AllPhotosView: React.FC = () => {
  const { showToast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<string>('All Months');
  const [selectedYear, setSelectedYear] = useState<string>('All Years');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Selected Album modal to view photos inside
  const [activeAlbum, setActiveAlbum] = useState<MonthAlbum | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [newPhotoTitle, setNewPhotoTitle] = useState<string>('');
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>('');

  // Dynamically determine the upload page URL
  const uploadPageUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/upload`
    : 'http://192.168.100.7:4000/upload';

  // Generate QR code for the upload page
  useEffect(() => {
    generateQRCodeDataURL(uploadPageUrl, { width: 340, margin: 2 })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [uploadPageUrl]);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const data = await api.getPhotos();
      setPhotos(data);
    } catch (err: any) {
      showToast('error', 'Failed to load photos', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  /**
   * Albums are grouped from the photos that actually exist, so the counts are
   * always truthful and new uploads show up on their own. There are no
   * pre-made months: a month appears once a photo falls into it, and a photo
   * with no usable date lands in "Other".
   */
  const defaultAlbums: MonthAlbum[] = (() => {
    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const buckets = new Map<string, Photo[]>();
    const keyOf = (month: string, year: string) => `${month}|${year}`;

    for (const photo of photos) {
      const taken = String(photo.takenAt ?? '').trim();
      const parsed = taken ? new Date(taken) : null;
      const valid = parsed && !Number.isNaN(parsed.getTime());

      const month = valid ? MONTHS[parsed!.getMonth()] : 'Other';
      const year = valid ? String(parsed!.getFullYear()) : 'Other';
      const key = keyOf(month, year);

      const bucket = buckets.get(key);
      if (bucket) bucket.push(photo);
      else buckets.set(key, [photo]);
    }

    // Newest month first; "Other" always last.
    const order = (month: string, year: string): number => {
      if (month === 'Other') return Number.MAX_SAFE_INTEGER;
      const m = MONTHS.indexOf(month);
      return year.length === 4 ? Number(year) * 100 + m : Number.MAX_SAFE_INTEGER - 1;
    };

    return Array.from(buckets.entries())
      .map(([key, group]) => {
        const [month, year] = key.split('|');
        return {
          id: key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: month === 'Other' ? '📁 Other / Not Categorized' : `${month} ${year}`,
          month,
          year,
          photoCount: group.length,
          coverImage: group[0]?.imageUrl,
          photos: group,
        };
      })
      .sort((a, b) => order(a.month, a.year) - order(b.month, b.year));
  })();

  // Filter albums by selected month and year
  const filteredAlbums = defaultAlbums.filter((album) => {
    if (album.id === 'other') return true;
    const matchMonth = selectedMonth === 'All Months' || album.month.toLowerCase() === selectedMonth.toLowerCase();
    const matchYear = selectedYear === 'All Years' || album.year === selectedYear;
    return matchMonth && matchYear;
  });

  const monthsList = [
    'All Months',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Years come from the photos that exist, newest first.
  const yearsList = useMemo((): string[] => {
    const years = Array.from(
      new Set(
        defaultAlbums
          .map(a => a.year)
          .filter(y => /^\d{4}$/.test(y)),
      ),
    ).sort((a, b) => Number(b) - Number(a));
    return ['All Years', ...years];
  }, [defaultAlbums]);

  const handleUploadPhotoToAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoTitle.trim() || !newPhotoUrl.trim() || !activeAlbum) return;

      try {
        // Use today's date so the photo files itself under the right month
        // instead of being pinned to a hardcoded one.
        const today = new Date();
        const takenAt = [
          today.getFullYear(),
          String(today.getMonth() + 1).padStart(2, '0'),
          String(today.getDate()).padStart(2, '0'),
        ].join('-');
        await api.createPhoto({
          title: newPhotoTitle.trim(),
          imageUrl: newPhotoUrl.trim(),
          albumName: activeAlbum.name,
          category: 'Sunday Worship',
          takenAt,
        });
      showToast('success', 'Photo Added', `Added photo to ${activeAlbum.name}`);
      setNewPhotoTitle('');
      setNewPhotoUrl('');
      setIsUploading(false);
      loadPhotos();
    } catch (err: any) {
      showToast('error', 'Upload Failed', err.message);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    // No confirmation step: the photo is removed for good and the public site
    // drops it on the same change, so a second click cannot undo anything.
    try {
      await api.deletePhoto(photoId);
      showToast('success', 'Photo Deleted', 'Photo removed from the collection and from the website.');
      loadPhotos();
    } catch (err: any) {
      showToast('error', 'Delete Failed', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card matching Screenshot 1 */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ImageIcon className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">All Photos</h1>
        </div>

        {/* Upload page link badge */}
        <div className="mt-4">
          <a
            href={uploadPageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50/80 border border-indigo-200/70 text-indigo-700 text-xs font-mono font-medium hover:bg-indigo-100 transition-colors"
          >
            <span>Upload page:</span>
            <span className="underline">{uploadPageUrl}</span>
          </a>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Filter Dropdowns + Grid of Month Album Cards (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Select Month & Select Year Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Select Month */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Month
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-indigo-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {monthsList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Select Year */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Year
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-indigo-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {yearsList.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid of Album Cards matching Screenshot 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {filteredAlbums.map((album) => {
              const hasImage = !!album.coverImage;

              return (
                <div
                  key={album.id}
                  onClick={() => setActiveAlbum(album)}
                  className="group relative rounded-2xl overflow-hidden aspect-4/3 border border-slate-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer select-none bg-slate-200"
                >
                  {hasImage ? (
                    <>
                      <img
                        src={album.coverImage}
                        alt={album.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Gradient overlay for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    </>
                  ) : (
                    /* "No image" Placeholder Card matching Screenshot 1 */
                    <div className="w-full h-full bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 flex items-center justify-center relative">
                      <span className="text-2xl sm:text-3xl font-bold text-slate-500/70 select-none">
                        No image
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    </div>
                  )}

                  {/* Text on Card (Bottom-Left) */}
                  <div className="absolute bottom-3.5 left-3.5 right-3.5 text-white">
                    <p className="font-bold text-sm sm:text-base leading-snug drop-shadow-sm">
                      {album.name}
                    </p>
                    <p className="text-xs text-white/80 mt-0.5 drop-shadow-sm">
                      {album.photoCount} photos
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Upload QR Code Sticky Card (4 cols) matching Screenshot 1 */}
        <div className="lg:col-span-4 sticky top-20">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs flex flex-col items-center text-center">
            {/* Header */}
            <div className="flex items-center gap-2 self-start mb-6">
              <QrCode className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-base text-slate-900">Upload QR Code</h3>
            </div>

            {/* Big Square QR Code with authentic GFC Logo in center */}
            <div className="relative p-3 bg-white rounded-2xl border-2 border-indigo-100 shadow-sm flex items-center justify-center">
              {qrDataUrl ? (
                <div className="relative">
                  <img
                    src={qrDataUrl}
                    alt="Upload QR Code"
                    className="w-56 h-56 object-contain rounded-xl"
                  />
                  {/* Gospel Fellowship Church authentic center logo */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-11 h-11 rounded-full bg-white shadow-md p-1 border border-indigo-200 flex items-center justify-center">
                      <img
                        src="/gfc-logo.png"
                        alt="GFC Logo"
                        className="w-full h-full object-contain rounded-full"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                  Generating QR...
                </div>
              )}
            </div>

            {/* Monospace Link Underneath */}
            <div className="mt-5 w-full">
              <a
                href={uploadPageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-indigo-600 hover:text-indigo-800 underline break-all leading-relaxed"
              >
                {uploadPageUrl}
              </a>
            </div>

            {/* Quick Actions Row */}
            <div className="mt-4 pt-4 border-t border-slate-100 w-full flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(uploadPageUrl);
                  showToast('success', 'Link Copied', 'Upload page URL copied to clipboard');
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copy Link</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (qrDataUrl) {
                    const a = document.createElement('a');
                    a.href = qrDataUrl;
                    a.download = 'gfc-upload-qr.png';
                    a.click();
                    showToast('success', 'QR Downloaded', 'Saved gfc-upload-qr.png');
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Album Photos Drawer / Modal when clicking an album card */}
      {activeAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveAlbum(null)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-bold text-base">{activeAlbum.name}</h3>
                    <p className="text-xs text-slate-300">
                      {activeAlbum.photos.length}{' '}
                      {activeAlbum.photos.length === 1 ? 'photo' : 'photos'} in this collection
                    </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsUploading(!isUploading)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Photo
                </button>
                <button
                  onClick={() => setActiveAlbum(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Upload Bar */}
            {isUploading && (
              <form
                onSubmit={handleUploadPhotoToAlbum}
                className="p-4 bg-indigo-50/70 border-b border-indigo-100 flex flex-wrap gap-2.5 items-end text-xs shrink-0"
              >
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Photo Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sunday Fellowship Group"
                    value={newPhotoTitle}
                    onChange={(e) => setNewPhotoTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Image URL *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://images.unsplash.com/..."
                    value={newPhotoUrl}
                    onChange={(e) => setNewPhotoUrl(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium cursor-pointer"
                >
                  Save Photo
                </button>
              </form>
            )}

            {/* Photos Grid */}
            <div className="p-6 overflow-y-auto flex-1">
              {activeAlbum.photos.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No individual photos uploaded yet</p>
                  <p className="mt-1 text-slate-400">
                    Use the "Add Photo" button above or scan the Upload QR Code to add photos to this album.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {activeAlbum.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative rounded-xl overflow-hidden aspect-4/3 bg-slate-100 border border-slate-200"
                    >
                      <img
                        src={photo.imageUrl}
                        alt={photo.title}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                        <button
                          onClick={() => setPreviewPhoto(photo)}
                          className="p-1.5 rounded-lg bg-white/90 text-slate-800 hover:bg-white cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-1.5 left-2 right-2 text-white text-[11px] font-medium truncate pointer-events-none drop-shadow-sm">
                        {photo.title}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in">
          <div className="relative max-w-4xl w-full flex flex-col items-center">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              Close <X className="w-4 h-4 ml-1" />
            </button>
            <img
              src={previewPhoto.imageUrl}
              alt={previewPhoto.title}
              className="max-h-[80vh] w-auto max-w-full rounded-xl shadow-2xl object-contain"
            />
            <p className="text-white font-bold text-sm mt-3">{previewPhoto.title}</p>
          </div>
        </div>
      )}
    </div>
  );
};
