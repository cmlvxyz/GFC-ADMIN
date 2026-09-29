import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  QrCode, Trash2, Plus, Upload, ArrowLeft, Image as ImageIcon, X
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { useSiteEvents, eventSlug } from '../../services/siteEvents.ts';
import { generateQRCodeDataURL } from '../../utils/qr.ts';
import { useToast } from '../common/Toast.tsx';

interface EventsPhotosViewProps {
  onBack?: () => void;
}

/**
 * Identity of a selected photo. Facebook re-signs every CDN URL on each read
 * (oh=/oe=/_nc_*= change), so two imports of one post give two different
 * strings for the same picture. The path is the stable part.
 */
const photoIdentity = (url: string): string => {
  const value = String(url ?? '').trim();
  // Base64 data URLs are case sensitive, so they are never case folded.
  if (!/^https?:\/\//i.test(value)) return value;
  const stripped = /^https:\/\/(?:[a-z0-9-]+\.)*(?:fbcdn\.net|fbsbx\.com|cdninstagram\.com|facebook\.com|fb\.com)\//i
    .test(value)
    ? value.split('?')[0]
    : value;
  return stripped.toLowerCase();
};

/**
 * Anniversary events are organised by year, not by service date, so their
 * albums are labelled "2025" and the admin needs different wording.
 */
const isYearAlbumEvent = (title: string): boolean => /anniversar/i.test(title || '');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Current year down to five years back, so the date picker is never empty. */
const ALBUM_YEARS: string[] = (() => {
  const now = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => String(now + 1 - i));
})();

export const EventsPhotosView: React.FC<EventsPhotosViewProps> = ({ onBack }) => {
  const { showToast } = useToast();

  // Event choices come from the church website, so the admin always offers
  // exactly the events the public sees (and their real album dates).
  const { events: siteEvents, loading: eventsLoading } = useSiteEvents();
  const eventsList = siteEvents.map(e => e.title);

  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [serverAlbums, setServerAlbums] = useState<Record<string, string[]>>({});

  // Album dates: whatever the website has, plus any added from the admin.
  const dateAlbumsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const e of siteEvents) map[e.title] = [...e.dates];
    for (const [title, dates] of Object.entries(serverAlbums)) {
      map[title] = Array.from(new Set([...(map[title] || []), ...(dates || [])]));
    }
    return map;
  }, [siteEvents, serverAlbums]);

  const currentDateAlbums = dateAlbumsMap[selectedEvent] || [];
  const [selectedDate, setSelectedDate] = useState<string>(currentDateAlbums[0] || 'June 14, 2026');
  const [newDateInput, setNewDateInput] = useState<string>('');
  // Church Anniversary has a second kind of album, a labelled year such as
  // "1st Year Anniversary", which is typed rather than picked.
  const [newMonthInput, setNewMonthInput] = useState<string>('');
  const [newYearInput, setNewYearInput] = useState<string>('');
  const [newYearAlbumInput, setNewYearAlbumInput] = useState<string>('');

  // Selected files for upload
  const [selectedPhotos, setSelectedPhotos] = useState<Array<{ name: string; url: string }>>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Cover image per album (year albums and date albums alike).
  const [albumCovers, setAlbumCovers] = useState<Record<string, Record<string, string>>>({});
  const [isSavingCover, setIsSavingCover] = useState<string>('');

  const yearAlbumMode = isYearAlbumEvent(selectedEvent);
  const albumNoun = yearAlbumMode ? 'Year Album' : 'Date Album';
  const currentCover = albumCovers[selectedEvent]?.[selectedDate] || '';

  // A QR code is opened on a phone, so it must point at the public site on the
  // LAN address: the admin's own origin is the wrong app, and "localhost" on a
  // phone means the phone itself. The site origin is the same host with the
  // site port, which is what the backend reports.
  const [siteOrigin, setSiteOrigin] = useState<string>('');
  const [qrTarget, setQrTarget] = useState<string>('');

  const cleanEventParam = eventSlug(selectedEvent);
  const cleanDateParam = selectedDate.replace(/\s+/g, '');
  const dynamicQRUrl = `${qrTarget || siteOrigin}/upload?event=${cleanEventParam}&date=${encodeURIComponent(cleanDateParam)}`;

  // Load any album dates added from the admin side
  useEffect(() => {
    api.getDateAlbums()
      .then((data) => { if (data && Object.keys(data).length > 0) setServerAlbums(data); })
      .catch(console.error);
    api.getAlbumCovers()
      .then((data) => { if (data) setAlbumCovers(data); })
      .catch(console.error);
    api.getReachableUrls()
      .then((urls) => {
        // Prefer a LAN address (192.168.x.x / 10.x.x.x) over loopback: only the
        // LAN one opens on a phone. Loopback is the fallback when offline.
        const lan = urls.find((u) => /^http:\/\/(?!localhost|127\.0\.0\.1)/.test(u));
        const first = lan || urls[0] || '';
        if (first) setSiteOrigin(first);
      })
      .catch(console.error);
  }, []);

  // Let the admin scan from the same device it is on (localhost) or from a
  // phone (LAN address).
  const reachableOptions = useMemo(
    () => Array.from(new Set([siteOrigin, 'http://localhost:3002'].filter(Boolean))),
    [siteOrigin],
  );

  useEffect(() => {
    if (siteOrigin && !qrTarget) setQrTarget(siteOrigin);
  }, [siteOrigin, qrTarget]);

  // Default to the first website event once they load
  useEffect(() => {
    if (!selectedEvent && eventsList.length > 0) {
      setSelectedEvent(eventsList[0]);
      setSelectedDate(dateAlbumsMap[eventsList[0]]?.[0] || '');
    }
  }, [eventsList, selectedEvent, dateAlbumsMap]);

  // Update selectedDate when event changes
  useEffect(() => {
    const dates = dateAlbumsMap[selectedEvent] || [];
    if (dates.length > 0) {
      if (!dates.includes(selectedDate)) {
        setSelectedDate(dates[0]);
      }
    } else {
      setSelectedDate('');
    }
  }, [selectedEvent, dateAlbumsMap]);

  // Generate QR Code dynamically
  useEffect(() => {
    generateQRCodeDataURL(dynamicQRUrl, { width: 340, margin: 2 })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [dynamicQRUrl]);

  /**
   * Adds one album label to the selected event and selects it. Shared by the
   * date form and the year-album form so both behave identically, including
   * refusing a label that already exists.
   */
  const addAlbum = async (label: string, noun: string) => {
    const trimmed = label.trim();
    if (!trimmed || !selectedEvent) return;
    if ((dateAlbumsMap[selectedEvent] || []).includes(trimmed)) {
      showToast('warning', `${noun} Exists`, `"${trimmed}" is already listed for ${selectedEvent}.`);
      return;
    }

    try {
      const updated = await api.addDateAlbum(selectedEvent, trimmed);
      setServerAlbums(updated);
    } catch {
      // Local fallback so the admin is not blocked by a storage hiccup.
      setServerAlbums((prev: Record<string, string[]>) => ({
        ...prev,
        [selectedEvent]: [trimmed, ...(prev[selectedEvent] || [])],
      }));
    }
    setSelectedDate(trimmed);
    showToast('success', `${noun} Added`, `Added "${trimmed}" to ${selectedEvent}`);
  };

  const handleAddDateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (yearAlbumMode) {
      if (!newMonthInput || !newYearInput) {
        showToast('warning', 'Month and Year Required', 'Choose a month and a year first.');
        return;
      }
      await addAlbum(`${newMonthInput} ${newYearInput}`, 'Date Album');
      setNewMonthInput('');
      setNewYearInput('');
      return;
    }
    if (!newDateInput.trim()) return;
    await addAlbum(newDateInput, 'Date Album');
    setNewDateInput('');
  };

  /** Church Anniversary only: a labelled year such as "1st Year Anniversary". */
  const handleAddYearAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearAlbumInput.trim()) return;
    await addAlbum(newYearAlbumInput, 'Year Album');
    setNewYearAlbumInput('');
  };

  /**
   * Pick the cover of the selected album from an image on this computer. The
   * file is read inline, so no upload endpoint or new storage is involved.
   */
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedEvent || !selectedDate) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = String(ev.target?.result || '');
      if (!dataUrl) return;
      const label = `${selectedEvent} ${selectedDate}`;
      setIsSavingCover(label);
      try {
        const updated = await api.setAlbumCover(selectedEvent, selectedDate, dataUrl);
        setAlbumCovers(updated);
        showToast('success', 'Cover Selected', `Set the cover for ${selectedDate}.`);
      } catch (err: any) {
        showToast('error', 'Cover Not Saved', err?.message || 'Could not set that cover.');
      } finally {
        setIsSavingCover('');
      }
    };
    reader.onerror = () => showToast('error', 'Cover Not Saved', 'Could not read that image.');
    reader.readAsDataURL(file);
  };

  const handleClearCover = async () => {
    if (!selectedEvent || !selectedDate) return;
    const label = `${selectedEvent} ${selectedDate}`;
    setIsSavingCover(label);
    try {
      const updated = await api.setAlbumCover(selectedEvent, selectedDate, '');
      setAlbumCovers(updated);
      showToast('success', 'Cover Removed', `Cleared the cover for ${selectedDate}.`);
    } catch (err: any) {
      showToast('error', 'Cover Not Cleared', err?.message || 'Could not clear that cover.');
    } finally {
      setIsSavingCover('');
    }
  };

  const handleDeleteDateAlbum = async () => {
    if (!selectedDate) return;
    if (!window.confirm(`Delete ${albumNoun.toLowerCase()} "${selectedDate}" from ${selectedEvent}?`)) return;

    try {
      const updated = await api.deleteDateAlbum(selectedEvent, selectedDate);
      setServerAlbums(updated);
      const remaining = updated[selectedEvent] || [];
      setSelectedDate(remaining[0] || '');
      showToast('success', 'Album Deleted', `Deleted "${selectedDate}"`);
    } catch {
      setServerAlbums((prev: Record<string, string[]>) => {
        const remaining = (prev[selectedEvent] || []).filter((d: string) => d !== selectedDate);
        setSelectedDate(remaining[0] || '');
        return {
          ...prev,
          [selectedEvent]: remaining,
        };
      });
      showToast('success', 'Album Deleted', `Deleted "${selectedDate}"`);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) {
      showToast('warning', 'No Images Found', 'Choose image files (JPG, PNG, WEBP).');
      return;
    }

    let pending = list.length;
    let skipped = 0;
    const finishOne = () => {
      pending -= 1;
      // The input is only cleared once every read has finished. Clearing it
      // straight away aborts the pending FileReader calls in Chrome and Safari,
      // which is why selecting photos appeared to do nothing.
      if (pending === 0 && fileInputRef.current) fileInputRef.current.value = '';
    };

    list.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = String(event.target?.result || '');
        if (dataUrl) {
          setSelectedPhotos((prev) => {
            // The same file picked twice must not be added twice.
            if (prev.some((p) => photoIdentity(p.url) === photoIdentity(dataUrl))) {
              skipped += 1;
              return prev;
            }
            return [...prev, { name: file.name, url: dataUrl }];
          });
        }
        finishOne();
      };
      reader.onerror = () => {
        showToast('error', 'Read Failed', `Could not read ${file.name}.`);
        finishOne();
      };
      reader.readAsDataURL(file);
    });
  };


  const handleSaveToEventAndPhotos = async () => {
    if (selectedPhotos.length === 0) {
      showToast('warning', 'No Photos Selected', 'Please select or import photos first.');
      return;
    }

    setIsSaving(true);
    try {
      const siteEvent = siteEvents.find(e => e.title === selectedEvent);

      let saved = 0;
      let duplicates = 0;
      // Genuine failures stay in the list so a retry only re-attempts those.
      const failed: Array<{ name: string; url: string }> = [];
      for (const p of selectedPhotos) {
        try {
          await api.createPhoto({
            title: `${selectedEvent} - ${p.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}`,
            imageUrl: p.url,
            albumName: `${selectedEvent}${selectedDate ? ` (${selectedDate})` : ''}`,
            albumDate: selectedDate || undefined,
            // Link to the website event so it shows up in that album on the site.
            eventId: siteEvent?.id || null,
            eventTitle: selectedEvent || null,
            category: /youth|next generation/i.test(selectedEvent) ? 'Youth Ministry' : 'Sunday Worship',
            uploaderName: 'Admin',
            takenAt: new Date().toISOString().split('T')[0],
            isFeatured: true,
          });
          saved += 1;
        } catch (err: any) {
          if (err?.code === 'duplicate_photo') {
            duplicates += 1;
            continue;
          }
          failed.push(p);
        }
      }

      setSelectedPhotos(failed);
      const parts = [`Added ${saved} photo${saved === 1 ? '' : 's'} to ${selectedEvent} & All Photos.`];
      if (duplicates) {
        parts.push(`${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped - already in the gallery.`);
      }
      if (failed.length) {
        showToast('error', 'Partially Saved', `${parts.join(' ')} ${failed.length} failed to save.`);
      } else {
        showToast('success', 'Saved Successfully', parts.join(' '));
      }
    } catch (err: any) {
      showToast('error', 'Save Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header matching Screenshot 2 */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            <ImageIcon className="w-4 h-4" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Events Photos</h1>
        </div>
      </div>

      {/* Top Banner Card: Event QR Code Generator matching Screenshot 2 */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center gap-2.5">
          <QrCode className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Event QR Code Generator
          </h2>
        </div>

        {/* Upload page link badge */}
        <div className="mt-4">
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-50/80 border border-indigo-200/70 text-indigo-700 text-xs font-mono font-medium">
            Upload page: {qrTarget || siteOrigin || 'loading...'}
          </span>
        </div>

        {/* A phone cannot open localhost, so the scannable address is picked here. */}
        <div className="mt-3 space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            QR opens on
          </label>
          <div className="relative">
            <select
              value={qrTarget}
              onChange={(e) => setQrTarget(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {reachableOptions.map((url) => (
                <option key={url} value={url}>{url}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
              ▼
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Use the LAN address to scan with a phone on the same Wi-Fi. Both devices
            must be on the same network, and this computer&apos;s firewall must allow the site port.
          </p>
        </div>
      </div>

      {/* Main Form and QR Code (Two Columns) matching Screenshot 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column Form (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-5">
          {/* Select Event */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Event
            </label>
            <div className="relative">
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {eventsList.map((evt) => (
                  <option key={evt} value={evt}>
                    {evt}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Select Album (For Upload) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select {albumNoun} (For Upload)
            </label>
            <div className="relative">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {currentDateAlbums.length === 0 && (
                  <option value="">{`No ${albumNoun.toLowerCase()} yet`}</option>
                )}
                {currentDateAlbums.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Album Cover: pick the picture that represents this album */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Cover
            </label>
            {selectedDate ? (
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 shrink-0 rounded-xl border border-slate-300 bg-slate-50 overflow-hidden flex items-center justify-center">
                  {currentCover ? (
                    <img src={currentCover} alt={`${selectedDate} cover`} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-slate-300" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer">
                    {isSavingCover ? (
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                    <span>{isSavingCover ? 'Saving...' : currentCover ? 'Change Cover' : 'Select Cover'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverSelect}
                      className="hidden"
                    />
                  </label>
                  {currentCover && (
                    <button
                      type="button"
                      onClick={handleClearCover}
                      disabled={isSavingCover === `${selectedEvent} ${selectedDate}`}
                      className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Remove Cover
                    </button>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Cover for <span className="font-semibold text-slate-700">{selectedDate}</span>
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                {`Add a ${albumNoun.toLowerCase()} first, then choose its cover.`}
              </p>
            )}
          </div>

          {/* Delete Selected Album Button matching Screenshot 2 */}
          <div>
            <button
              type="button"
              onClick={handleDeleteDateAlbum}
              disabled={!selectedDate}
              className="w-full py-2.5 px-4 rounded-xl border border-rose-300/80 bg-white hover:bg-rose-50/60 text-rose-600 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              {`Delete Selected ${albumNoun}`}
            </button>
          </div>

          {/*
            Church Anniversary needs two separate inputs: a month + year for a
            regular date album, and a free-form year label such as
            "1st Year Anniversary". Other events only ever need the date form.
          */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              Add Event Album
            </label>
            <form onSubmit={handleAddDateAlbum} className="flex gap-2">
              {yearAlbumMode ? (
                <>
                  <div className="relative flex-1">
                    <select
                      value={newMonthInput}
                      onChange={(e) => setNewMonthInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 appearance-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                  <div className="relative flex-1">
                    <select
                      value={newYearInput}
                      onChange={(e) => setNewYearInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 appearance-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">Year</option>
                      {ALBUM_YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                </>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. August 18, 2026"
                  value={newDateInput}
                  onChange={(e) => setNewDateInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
              <button
                type="submit"
                disabled={yearAlbumMode ? !newMonthInput || !newYearInput : !newDateInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add Date
              </button>
            </form>
          </div>

          {yearAlbumMode && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                Add Year
              </label>
              <form onSubmit={handleAddYearAlbum} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 1st Year Anniversary"
                  value={newYearAlbumInput}
                  onChange={(e) => setNewYearAlbumInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!newYearAlbumInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Add Year
                </button>
              </form>
            </div>
          )}

          {/* Blue Summary Pill Box matching Screenshot 2 */}
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs font-semibold">
            <span>Selected: </span>
            <span className="font-bold">{selectedEvent}</span>
            <span> • </span>
            <span>{selectedDate || `No ${albumNoun.toLowerCase()} selected`}</span>
          </div>
        </div>

        {/* Right Column: GFC QR Code matching Screenshot 2 (4 cols) */}
        <div className="lg:col-span-4 sticky top-20">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs flex flex-col items-center text-center">
            {/* Header */}
            <div className="flex items-center gap-2 self-start mb-6">
              <QrCode className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-base text-slate-900">GFC QR Code</h3>
            </div>

            {/* Big Square QR Code with authentic GFC Logo in center */}
            <div className="relative p-3 bg-white rounded-2xl border-2 border-indigo-100 shadow-sm flex items-center justify-center">
              {qrDataUrl ? (
                <div className="relative">
                  <img
                    src={qrDataUrl}
                    alt="Event QR Code"
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

            {/* Dynamic URL Printed in Monospace Blue matching Screenshot 2 */}
            <div className="mt-6 w-full">
              <a
                href={dynamicQRUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-indigo-600 hover:text-indigo-800 underline break-all leading-relaxed"
              >
                {dynamicQRUrl}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Card: Upload Photos to Event matching Screenshot 2 */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-6">
        <div className="flex items-center gap-2.5">
          <Upload className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-base text-slate-900">Upload Photos to Event</h3>
        </div>

        {/* Buttons: Select Photos & Clear All */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer">
            <ImageIcon className="w-4 h-4" />
            <span>Select Photos</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setSelectedPhotos([])}
            disabled={selectedPhotos.length === 0}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Clear All
          </button>
        </div>

        {/* Preview of Selected Photos */}
        {selectedPhotos.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              Selected ({selectedPhotos.length} photo{selectedPhotos.length > 1 ? 's' : ''}):
            </p>
            <div className="flex flex-wrap gap-3">
              {selectedPhotos.map((p, idx) => (
                <div
                  key={idx}
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group"
                >
                  <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setSelectedPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white p-1 rounded-full text-xs"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Save to Event & All Photos Button matching Screenshot 2 */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSaveToEventAndPhotos}
            disabled={isSaving || selectedPhotos.length === 0}
            className="px-6 py-3 rounded-xl bg-[#5eead4] hover:bg-[#2dd4bf] text-emerald-950 font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Saving to Shared Database...' : 'Save to Event & All Photos'}
          </button>
        </div>
      </div>
    </div>
  );
};
