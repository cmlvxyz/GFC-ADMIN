import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Plus, Search, Filter, QrCode, Users, MapPin, Clock, Edit2, 
  Trash2, Upload, Check, Copy, Download, Camera, CheckCircle2, AlertCircle, 
  ExternalLink, Sparkles, Folder, X, Link2, Image as ImageIcon 
} from 'lucide-react';
import { GFCEvent, EventStatus, type AlbumPair } from '../../types/index.ts';
import { api, type FacebookImportResult } from '../../services/api.ts';
import { useSiteEvents, eventSlug } from '../../services/siteEvents.ts';
import { Badge } from '../common/Badge.tsx';
import { EventFormModal } from './EventFormModal.tsx';
import { EventAttendeesModal } from './EventAttendeesModal.tsx';
import { generateQRCodeDataURL, downloadQRCode } from '../../utils/qr.ts';
import { useToast } from '../common/Toast.tsx';

/**
 * Identity of a selected photo. Facebook re-signs every CDN URL on each read
 * (oh=/oe=/_nc_*= change), so two imports of one post give two different
 * strings for the same picture. The hostname plus path is the stable part.
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

export const EventsView: React.FC = () => {
  const { showToast } = useToast();

  // Tab mode: 'qr-albums' (Screenshot 2 view) vs 'directory' (Scheduled church services)
  const [activeTab, setActiveTab] = useState<'qr-albums' | 'directory'>('qr-albums');

  // Events list & filter state
  const [events, setEvents] = useState<GFCEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Event choices come from the church website, so the admin offers exactly
  // the events the public sees (and their real album dates).
  const { events: siteEvents } = useSiteEvents();
  const standardEvents = siteEvents.map(e => e.title);

  // Selected event & date albums
  const [selectedEventName, setSelectedEventName] = useState<string>('');
  const [serverAlbums, setServerAlbums] = useState<Record<string, string[]>>({});

  /**
   * Older date-album records were stored under legacy event names in ALL CAPS
   * ("SUNDAY SERVICE"), while the website events are Title Case ("Sunday
   * Service"). Match case- and whitespace-insensitively so dates saved before
   * the rename still show up under the right event.
   */
  const normalizeKey = (value: string): string =>
    String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

  const dateAlbumsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const e of siteEvents) map[e.title] = [...e.dates];

    // Index the website events by their normalized title so legacy keys resolve.
    const byNormalizedTitle = new Map<string, string>();
    for (const e of siteEvents) byNormalizedTitle.set(normalizeKey(e.title), e.title);

    for (const [title, dates] of Object.entries(serverAlbums)) {
      const canonical = byNormalizedTitle.get(normalizeKey(title)) ?? title;
      map[canonical] = Array.from(new Set([...(map[canonical] || []), ...(dates || [])]));
    }
    return map;
  }, [siteEvents, serverAlbums]);

  const currentDateAlbums = dateAlbumsMap[selectedEventName] || [];
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [newDateInput, setNewDateInput] = useState<string>('');

  /**
   * Church Anniversary albums are a Year plus an Event name shown together as
   * ONE card. A year is only a choice until it is paired with an event, which
   * is why the two lists are kept apart and joined by `albumPairs`.
   */
  const isAnniversary = /anniversar/i.test(selectedEventName);
  const [albumYears, setAlbumYears] = useState<Record<string, string[]>>({});
  const [albumPairs, setAlbumPairs] = useState<Record<string, AlbumPair[]>>({});
  const [newYearInput, setNewYearInput] = useState<string>('');
  const [newAlbumEventInput, setNewAlbumEventInput] = useState<string>('');
  const [pairYear, setPairYear] = useState<string>('');
  const [pairEvent, setPairEvent] = useState<string>('');
  const currentYears = albumYears[selectedEventName] || [];
  const currentPairs = albumPairs[selectedEventName] || [];
  const yearOfPair = (event: string) =>
    currentPairs.find((p) => p.event.toLowerCase() === event.toLowerCase())?.year || '';

  // Selected event for directory view
  const [selectedDirectoryEvent, setSelectedDirectoryEvent] = useState<GFCEvent | null>(null);

  // Selected files for upload
  const [selectedPhotos, setSelectedPhotos] = useState<Array<{ name: string; url: string }>>([]);
  const [fbLink, setFbLink] = useState<string>('');
  const [isImportingFb, setIsImportingFb] = useState<boolean>(false);
  const [fbPreview, setFbPreview] = useState<FacebookImportResult | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<GFCEvent | null>(null);
  const [viewingAttendees, setViewingAttendees] = useState<GFCEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<GFCEvent | null>(null);

  // Single Authoritative QR Code state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Dynamic host and query link matching Screenshot 2 and All Photos
  const hostOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://192.168.100.7:4000';
  const uploadPageUrl = `${hostOrigin}/upload`;

  // Compute dynamic QR link based on current selection
  const cleanEventParam = selectedEventName.toLowerCase().replace(/\s+/g, '');
  const cleanDateParam = selectedDate.replace(/\s+/g, '');
  const dynamicQRUrl = activeTab === 'qr-albums'
    ? `${uploadPageUrl}?event=${cleanEventParam}&date=${encodeURIComponent(cleanDateParam)}`
    : selectedDirectoryEvent
      ? `${uploadPageUrl}?event=${selectedDirectoryEvent.id}&ticketSecret=${selectedDirectoryEvent.qrTicketSecret}`
      : `${uploadPageUrl}?event=${cleanEventParam}`;

  // Generate the Single QR Code whenever selection changes
  useEffect(() => {
    generateQRCodeDataURL(dynamicQRUrl, { width: 340, margin: 2 })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [dynamicQRUrl]);

  // Load events from database
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await api.getEvents({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search.trim() || undefined,
      });
      setEvents(data);
      if (data.length > 0 && !selectedDirectoryEvent) {
        setSelectedDirectoryEvent(data[0]);
      }
    } catch (err: any) {
      showToast('error', 'Error fetching events', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load any album dates added from the admin side
  useEffect(() => {
    api.getDateAlbums()
      .then((data) => { if (data && Object.keys(data).length > 0) setServerAlbums(data); })
      .catch(console.error);
  }, []);

  // Default to the first website event once they load
  useEffect(() => {
    if (!selectedEventName && standardEvents.length > 0) {
      setSelectedEventName(standardEvents[0]);
      setSelectedDate(dateAlbumsMap[standardEvents[0]]?.[0] || '');
    }
  }, [standardEvents, selectedEventName, dateAlbumsMap]);

  useEffect(() => {
    fetchEvents();
  }, [statusFilter, search]);

  // Update selectedDate when event changes
  useEffect(() => {
    const dates = dateAlbumsMap[selectedEventName] || [];
    if (dates.length > 0) {
      if (!dates.includes(selectedDate)) {
        setSelectedDate(dates[0]);
      }
    } else {
      setSelectedDate('');
    }
  }, [selectedEventName, dateAlbumsMap]);

  // Album covers, so the picture shown on the website card can be chosen here
  const [albumCovers, setAlbumCovers] = useState<Record<string, Record<string, string>>>({});
  const currentCover = isAnniversary ? (albumCovers[selectedEventName]?.[selectedDate] || '') : '';

  // Load any album dates added from the admin side
  useEffect(() => {
    api.getDateAlbums()
      .then((data) => { if (data && Object.keys(data).length > 0) setServerAlbums(data); })
      .catch(console.error);
    api.getAlbumCovers()
      .then((data) => { if (data) setAlbumCovers(data); })
      .catch(console.error);
  }, []);

  // Load the Year + Event pairings alongside the existing album data
  useEffect(() => {
    Promise.all([api.getAlbumYears(), api.getAlbumPairs()])
      .then(([years, pairs]) => {
        if (years && Object.keys(years).length > 0) setAlbumYears(years);
        if (pairs && Object.keys(pairs).length > 0) setAlbumPairs(pairs);
      })
      .catch(console.error);
  }, []);

  /**
   * Covers are stored per event and album label, so the same upload path works
   * for a date album and for an anniversary album.
   */
  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedDate) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const url = String(reader.result || '');
      try {
        const updated = await api.setAlbumCover(selectedEventName, selectedDate, url);
        setAlbumCovers(updated);
        showToast('success', 'Cover Saved', `Cover set for "${selectedDate}"`);
      } catch (err) {
        showToast('error', 'Could Not Save Cover', (err as Error).message);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearCover = async () => {
    if (!selectedDate) return;
    try {
      const updated = await api.setAlbumCover(selectedEventName, selectedDate, '');
      setAlbumCovers(updated);
      showToast('success', 'Cover Removed', `"${selectedDate}" will fall back to its first photo`);
    } catch (err) {
      showToast('error', 'Could Not Remove Cover', (err as Error).message);
    }
  };

  const handleAddYearAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    const year = newYearInput.trim();
    if (!year) return;
    if (!/\d/.test(year)) {
      showToast('error', 'Invalid Year', 'Enter a year, e.g. 2024');
      return;
    }
    setNewYearInput('');
    setPairYear(year);
    try {
      const updated = await api.addAlbumYear(selectedEventName, year);
      setAlbumYears(updated);
      showToast('success', 'Year Album Added', `Added "${year}". Now pair it with an event below.`);
    } catch (err) {
      showToast('error', 'Could Not Add Year', (err as Error).message);
    }
  };

  /**
   * The event name is added as a real album so photos and a cover can be filed
   * under it, and it is remembered as a pairing choice at the same time.
   */
  const handleAddEventAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newAlbumEventInput.trim();
    if (!label) return;

    setNewAlbumEventInput('');
    setPairEvent(label);
    try {
      const albums = await api.addDateAlbum(selectedEventName, label);
      setServerAlbums(albums);
      setSelectedDate(label);
      showToast('success', 'Event Album Added', `Added "${label}". Now pair it with a year below.`);
    } catch (err) {
      showToast('error', 'Could Not Add Event', (err as Error).message);
    }
  };

  const handlePairAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairYear || !pairEvent) {
      showToast('error', 'Missing Selection', 'Choose a year and an event, then pair them');
      return;
    }
    try {
      const updated = await api.setAlbumPair(selectedEventName, pairYear, pairEvent);
      setAlbumPairs(updated);
      showToast('success', 'Album Paired', `${pairYear} + ${pairEvent} is now one album card`);
    } catch (err) {
      showToast('error', 'Could Not Pair', (err as Error).message);
    }
  };

  const handleUnpairAlbum = async (pair: AlbumPair) => {
    if (!window.confirm(`Unpair "${pair.year}" from "${pair.event}"? The album and its photos stay.`)) return;
    try {
      const updated = await api.deleteAlbumPair(selectedEventName, pair.year, pair.event);
      setAlbumPairs(updated);
      showToast('success', 'Album Unpaired', 'The album and its photos are untouched');
    } catch (err) {
      showToast('error', 'Could Not Unpair', (err as Error).message);
    }
  };

  const handleAddDateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDateInput.trim()) return;

    const trimmed = newDateInput.trim();
    try {
      const updated = await api.addDateAlbum(selectedEventName, trimmed);
      setServerAlbums(updated);
      setSelectedDate(trimmed);
      setNewDateInput('');
      showToast('success', 'Date Album Added', `Added "${trimmed}" to ${selectedEventName}`);
    } catch {
      setServerAlbums((prev) => ({
        ...prev,
        [selectedEventName]: [trimmed, ...(prev[selectedEventName] || [])],
      }));
      setSelectedDate(trimmed);
      setNewDateInput('');
      showToast('success', 'Date Album Added', `Added "${trimmed}" to ${selectedEventName}`);
    }
  };

  const handleDeleteDateAlbum = async () => {
    if (!selectedDate) return;
    if (!window.confirm(`Delete date album "${selectedDate}" from ${selectedEventName}?`)) return;

    try {
      const updated = await api.deleteDateAlbum(selectedEventName, selectedDate);
      setServerAlbums(updated);
      const remaining = updated[selectedEventName] || [];
      setSelectedDate(remaining[0] || '');
      showToast('success', 'Album Deleted', `Deleted "${selectedDate}"`);
    } catch {
      setServerAlbums((prev) => {
        const remaining = (prev[selectedEventName] || []).filter((d) => d !== selectedDate);
        setSelectedDate(remaining[0] || '');
        return {
          ...prev,
          [selectedEventName]: remaining,
        };
      });
      showToast('success', 'Album Deleted', `Deleted "${selectedDate}"`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedPhotos((prev) => [
            ...prev,
            { name: file.name, url: event.target!.result as string },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  /**
   * Ask the backend to read the media attached to the exact Facebook post
   * behind the pasted link. Nothing is saved yet: the photos land in the
   * selection list so they can be reviewed, and the existing
   * "Save to Event & All Photos" button does the writing.
   */
  const handleImportFacebook = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = fbLink.trim();
    if (!raw || isImportingFb) return;

    // Accept links pasted with or without the scheme, but only facebook hosts.
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!/^https?:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.watch|fb\.com)([/?#]|$)/i.test(candidate)) {
      showToast(
        'warning',
        'Not a Facebook link',
        'Paste the link of a specific Facebook post, e.g. https://www.facebook.com/permalink.php?story_fbid=... or https://www.facebook.com/yourpage/posts/123456789.',
      );
      return;
    }

    setIsImportingFb(true);
    setFbPreview(null);
    try {
      const result = await api.previewFacebookPhotos(candidate);
      setFbPreview(result);

      const images = result.media.filter((item) => item.type === 'image' && !item.duplicate);
      const videos = result.media.filter((item) => item.type === 'video');
      // Clicking Import twice must not stack the same pictures, so the batch is
      // merged by identity rather than appended blindly. Facebook re-signs the
      // CDN URL on every read, hence the path-only comparison.
      if (images.length) {
        setSelectedPhotos((prev) => {
          const seen = new Set(prev.map((p) => photoIdentity(p.url)));
          const additions = images
            .filter((item) => {
              const key = photoIdentity(item.url);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map((item, index) => ({
              name: `${result.albumName} - Photo ${index + 1}.jpg`,
              url: item.url,
            }));
          return additions.length ? [...prev, ...additions] : prev;
        });
      }

      // The post is now in the selection list, so clear the field: a second
      // click would otherwise import the very same post again.
      setFbLink('');

      const dupes = result.duplicateCount ?? 0;
      const alreadyInBatch = result.media.length - images.length - videos.length - dupes;
      const skippedNote = dupes
        ? ` ${dupes} already in the gallery, skipped.`
        : '';
      const batchNote = alreadyInBatch > 0
        ? ` ${alreadyInBatch} already selected, skipped.`
        : '';
      const added = Math.max(0, images.length - alreadyInBatch);

      showToast(
        'success',
        'Facebook Media Found',
        (added
          ? `Added ${added} photo${added === 1 ? '' : 's'} from that post.`
          : `Nothing new to add.${skippedNote}${batchNote}`) +
          (videos.length ? ` ${videos.length} video${videos.length === 1 ? '' : 's'} available.` : '') +
          (added ? '. Review them below, then save.' : ''),
      );
    } catch (err: any) {
      setFbPreview(null);
      showToast('error', 'Facebook Import Failed', err?.message || 'Could not read that Facebook post.');
    } finally {
      setIsImportingFb(false);
    }
  };

  const handleSaveToEventAndPhotos = async () => {
    if (selectedPhotos.length === 0) {
      showToast('warning', 'No Photos Selected', 'Please select or import photos first.');
      return;
    }

    setIsSaving(true);
    try {
      let saved = 0;
      let duplicates = 0;
      // The Year of the selected Year + Event album, resolved once per save so
      // every photo of this batch lands in the same year.
      const albumYearForUpload = yearOfPair(selectedDate);
      // Genuine failures stay in the list so a retry only re-attempts those.
      const failed: Array<{ name: string; url: string }> = [];
      for (const p of selectedPhotos) {
        try {
          await api.createPhoto({
            title: `${selectedEventName} - ${p.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}`,
            imageUrl: p.url,
            albumName: `${selectedEventName}${selectedDate ? ` (${selectedDate})` : ''}`,
            albumDate: selectedDate || undefined,
            // Link to the website event so it appears in that album on the site.
            eventId: siteEvents.find(e => e.title === selectedEventName)?.id || null,
            eventTitle: selectedEventName || null,
            category: /youth|next generation/i.test(selectedEventName) ? 'Youth Ministry' : 'Sunday Worship',
            uploaderName: 'Admin',
            // A year album is dated by its Year, not by the day it was uploaded,
            // otherwise every anniversary photo piles up under the current month.
            takenAt: albumYearForUpload
              ? `${albumYearForUpload}-01-01`
              : new Date().toISOString().split('T')[0],
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
      const parts = [`Added ${saved} photo${saved === 1 ? '' : 's'} to ${selectedEventName} & All Photos.`];
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

  const handleCreateOrUpdate = async (eventData: Partial<GFCEvent>) => {
    if (editingEvent) {
      await api.updateEvent(editingEvent.id, eventData);
      showToast('success', 'Event Updated', `Updated "${eventData.title}"`);
    } else {
      await api.createEvent(eventData);
      showToast('success', 'Event Created', `Created "${eventData.title}" with QR verification secret`);
    }
    fetchEvents();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEvent) return;
    try {
      await api.deleteEvent(deletingEvent.id);
      showToast('success', 'Event Deleted', `Deleted "${deletingEvent.title}"`);
      setDeletingEvent(null);
      fetchEvents();
    } catch (err: any) {
      showToast('error', 'Delete Failed', err.message);
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(dynamicQRUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      showToast('success', 'Link Copied', 'QR URL copied to clipboard');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card matching All Photos style identically */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Events</h1>
              <p className="text-xs text-slate-500">
                Gospel Fellowship Church schedule, date albums, and preserved QR upload integration
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-center">
            <button
              onClick={() => setActiveTab('qr-albums')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'qr-albums'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Event QR & Albums
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'directory'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Church Events Directory
            </button>
          </div>
        </div>

        {/* Upload page link badge matching All Photos */}
        <div>
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

      {/* Main Two-Column Layout (Identical to All Photos: 8 cols Left, 4 cols Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeTab === 'qr-albums' ? (
            /* Screenshot 2 Mode: Event QR & Photo Albums */
            <>
              {/* Form Card */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-5">
                {/* Select Event */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Select Event
                  </label>
                  <div className="relative">
                    <select
                      value={selectedEventName}
                      onChange={(e) => setSelectedEventName(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {standardEvents.map((evt) => (
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
                    Select {isAnniversary ? 'Event Album' : 'Date Album'} (For Upload)
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {currentDateAlbums.map((d) => (
                        <option key={d} value={d}>
                          {isAnniversary && yearOfPair(d) ? `${yearOfPair(d)} - ${d}` : d}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
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
                    Delete Selected Album
                  </button>
                </div>

                {/* Church Anniversary: Year and Event are separate inputs joined
                    into ONE album card. Other events keep the plain date album. */}
                {isAnniversary ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Add Year Album
                      </label>
                      <form onSubmit={handleAddYearAlbum} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. 2024"
                          value={newYearInput}
                          onChange={(e) => setNewYearInput(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={!newYearInput.trim()}
                          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                          Add Year
                        </button>
                      </form>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Add Event Album
                      </label>
                      <form onSubmit={handleAddEventAlbum} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. 2nd Year Anniversary"
                          value={newAlbumEventInput}
                          onChange={(e) => setNewAlbumEventInput(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={!newAlbumEventInput.trim()}
                          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                          Add Event
                        </button>
                      </form>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Associate Year + Event (One Album)
                      </label>
                      <form onSubmit={handlePairAlbum} className="space-y-2">
                        <div className="flex gap-2">
                          <select
                            value={pairYear}
                            onChange={(e) => setPairYear(e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Select Year</option>
                            {currentYears.map((y) => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                          <select
                            value={pairEvent}
                            onChange={(e) => setPairEvent(e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Select Event</option>
                            {currentDateAlbums.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="submit"
                          disabled={!pairYear || !pairEvent}
                          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Link2 className="w-4 h-4" />
                          Associate as One Album
                        </button>
                      </form>

                      {currentPairs.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Paired Albums
                          </p>
                          {currentPairs.map((p) => (
                            <div
                              key={`${p.year}-${p.event}`}
                              className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-indigo-900 truncate">{p.year}</p>
                                <p className="text-[10px] text-indigo-700 truncate">{p.event}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setPairYear(p.year); setPairEvent(p.event); setSelectedDate(p.event); }}
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-[10px] font-bold hover:bg-indigo-50 transition-colors"
                              >
                                Select
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleUnpairAlbum(p)}
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 text-[10px] font-bold hover:bg-rose-50 transition-colors"
                              >
                                Unpair
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Add Date Album
                    </label>
                    <form onSubmit={handleAddDateAlbum} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. August 18, 2026"
                        value={newDateInput}
                        onChange={(e) => setNewDateInput(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={!newDateInput.trim()}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        Add Date
                      </button>
                    </form>
                  </div>
                )}

                {/* Album Cover: the picture shown on the website's album card */}
                {isAnniversary && selectedDate && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Select Cover
                    </label>
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
                          <ImageIcon className="w-4 h-4" />
                          <span>{currentCover ? 'Change Cover' : 'Select Cover'}</span>
                          <input type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
                        </label>
                        {currentCover && (
                          <button
                            type="button"
                            onClick={handleClearCover}
                            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Remove Cover
                          </button>
                        )}
                        <p className="text-[11px] text-slate-500">
                          Cover for <span className="font-semibold text-slate-700">{selectedDate}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Blue Summary Pill Box matching Screenshot 2 */}
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs font-semibold">
                  <span>Selected: </span>
                  <span className="font-bold">{selectedEventName}</span>
                  <span> • </span>
                  <span>{selectedDate || 'No date selected'}</span>
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

                {/* Import from Facebook matching Screenshot 2 */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">Import from Facebook</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {selectedEventName} • {selectedDate}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Paste a link to a <span className="font-semibold text-slate-600">specific post</span> &bull; only the media in that post is imported.
                    </p>
                  </div>

                  <form onSubmit={handleImportFacebook} className="flex gap-2">
                    <input
                      type="text"
                      inputMode="url"
                      placeholder="Import Facebook Link"
                      value={fbLink}
                      onChange={(e) => setFbLink(e.target.value)}
                      disabled={isImportingFb}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={!fbLink.trim() || isImportingFb}
                      className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {isImportingFb && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                      {isImportingFb ? 'Importing...' : 'Import'}
                    </button>
                  </form>

                  {/* What the post actually contains, before anything is saved */}
                  {fbPreview && (
                    <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-indigo-900">
                          Found {fbPreview.media.length} media
                          <span className="font-semibold text-slate-500">
                            {' '}in this post ({fbPreview.media.filter((m) => m.type === 'image').length} photo
                            {fbPreview.media.filter((m) => m.type === 'image').length === 1 ? '' : 's'},{' '}
                            {fbPreview.media.filter((m) => m.type === 'video').length} video
                            {fbPreview.media.filter((m) => m.type === 'video').length === 1 ? '' : 's'})
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          {fbPreview.permalink && (
                            <a
                              href={fbPreview.permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1"
                            >
                              View post
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setFbPreview(null)}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        {fbPreview.media.map((item, idx) => (
                          <a
                            key={`${item.sourceId || item.url}-${idx}`}
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            title={item.type === 'video' ? 'Open video' : 'Open photo'}
                            className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group hover:border-indigo-300"
                          >
                            <img
                              src={item.thumbnail || item.url}
                              alt={item.title || `Facebook ${item.type} ${idx + 1}`}
                              loading="lazy"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Videos may expose a file with no poster yet.
                                (e.currentTarget as HTMLImageElement).style.opacity = '0';
                              }}
                            />
                            {item.type === 'video' && (
                              <>
                                <span className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors" />
                                <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] font-bold tracking-wider text-center py-0.5">
                                  VIDEO
                                </span>
                                <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/60 text-white text-[9px] flex items-center justify-center">
                                  &#9654;
                                </span>
                              </>
                            )}
                          </a>
                        ))}
                      </div>

                      {fbPreview.media.filter((m) => m.type === 'image').length > 0 && (
                        <p className="text-[11px] text-slate-600">
                          The {fbPreview.media.filter((m) => m.type === 'image').length} photo(s) were added to your selection below. Videos can be opened from the tiles above.
                        </p>
                      )}

                      {fbPreview.warnings && fbPreview.warnings.length > 0 && (
                        <div className="space-y-1">
                          {fbPreview.warnings.map((warning, idx) => (
                            <p key={idx} className="text-[11px] text-amber-700 leading-relaxed">
                              {warning}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

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
            </>
          ) : (
            /* Directory Mode: Church Services & Schedule */
            <div className="space-y-5">
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'All Events' },
                    { id: 'published', label: 'Published' },
                    { id: 'draft', label: 'Drafts' },
                    { id: 'archived', label: 'Archived' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        statusFilter === tab.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <div className="relative w-full sm:w-60">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search events..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    onClick={() => {
                      setEditingEvent(null);
                      setIsFormOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create</span>
                  </button>
                </div>
              </div>

              {/* Events Cards: Clean without multiple repetitive QR buttons! */}
              {loading ? (
                <div className="py-20 text-center text-slate-400">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-xs">Loading shared GFC events database...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-slate-800">No events found</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-5">
                    Create an event to start tracking schedules and attendance passes.
                  </p>
                  <button
                    onClick={() => {
                      setEditingEvent(null);
                      setIsFormOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Create Event
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {events.map((evt) => {
                    const isSelected = selectedDirectoryEvent?.id === evt.id;
                    const progressPct = Math.min(100, Math.round((evt.registeredCount / (evt.capacity || 1)) * 100));

                    return (
                      <div
                        key={evt.id}
                        onClick={() => setSelectedDirectoryEvent(evt)}
                        className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-col cursor-pointer ${
                          isSelected
                            ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                            : 'border-slate-200 hover:border-slate-300 shadow-xs'
                        }`}
                      >
                        {/* Banner & Badges */}
                        <div className="relative h-36 w-full bg-slate-100 overflow-hidden">
                          <img
                            src={evt.bannerUrl}
                            alt={evt.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20"></div>

                          <div className="absolute top-2.5 left-2.5">
                            <Badge variant="primary" size="sm">
                              {evt.category}
                            </Badge>
                          </div>

                          <div className="absolute top-2.5 right-2.5">
                            <Badge
                              variant={evt.status === 'published' ? 'success' : evt.status === 'draft' ? 'warning' : 'neutral'}
                              size="sm"
                            >
                              {evt.status.toUpperCase()}
                            </Badge>
                          </div>

                          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-white text-xs font-medium bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded-lg">
                            <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                            <span>{evt.date}</span>
                          </div>
                        </div>

                        {/* Card Content */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">
                              {evt.title}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                              {evt.description || 'No description provided.'}
                            </p>

                            <div className="mt-3 space-y-1 text-xs text-slate-600">
                              <div className="flex items-center gap-1.5 truncate">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{evt.time}</span>
                              </div>
                              <div className="flex items-center gap-1.5 truncate">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{evt.location}</span>
                              </div>
                            </div>

                            {/* Capacity bar */}
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <div className="flex justify-between items-center text-xs mb-1">
                                <span className="text-slate-500 text-[11px]">Attendance:</span>
                                <span className="font-semibold text-slate-800 text-[11px]">
                                  {evt.registeredCount} / {evt.capacity}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-indigo-600 rounded-full"
                                  style={{ width: `${progressPct}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: Clean without separate QR buttons */}
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingAttendees(evt);
                              }}
                              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                            >
                              <Users className="w-3.5 h-3.5 text-slate-500" />
                              Roster ({evt.registeredCount})
                            </button>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEvent(evt);
                                  setIsFormOpen(true);
                                }}
                                title="Edit Event"
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingEvent(evt);
                                }}
                                title="Delete Event"
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Single Authoritative GFC QR Code matching Screenshot 2 and All Photos (4 cols, sticky) */}
        <div className="lg:col-span-4 sticky top-20">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs flex flex-col items-center text-center">
            {/* Header */}
            <div className="flex items-center justify-between w-full mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">GFC QR Code</h3>
              </div>
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200/60">
                Single QR
              </span>
            </div>

            {/* Selected Context subtitle */}
            <div className="w-full text-left mb-4 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400">Current Code For</p>
              <p className="text-xs font-bold text-slate-800 truncate mt-0.5">
                {activeTab === 'qr-albums'
                  ? `${selectedEventName} (${selectedDate})`
                  : (selectedDirectoryEvent?.title || 'Selected Event')}
              </p>
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
            <div className="mt-5 w-full">
              <a
                href={dynamicQRUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-indigo-600 hover:text-indigo-800 underline break-all leading-relaxed"
              >
                {dynamicQRUrl}
              </a>
            </div>

            {/* Quick Actions Row */}
            <div className="mt-4 pt-4 border-t border-slate-100 w-full flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => downloadQRCode(qrDataUrl, `${selectedEventName.toLowerCase()}-qr.png`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Event Add/Edit Modal */}
      <EventFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingEvent(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialData={editingEvent}
      />

      {/* Attendees & Ticket QR Modal */}
      {viewingAttendees && (
        <EventAttendeesModal
          isOpen={!!viewingAttendees}
          onClose={() => setViewingAttendees(null)}
          event={viewingAttendees}
          onAttendeeUpdated={fetchEvents}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Delete Event?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-700">"{deletingEvent.title}"</span>?
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setDeletingEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Yes, Delete Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
