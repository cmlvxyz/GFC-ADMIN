/**
 * Compatibility layer for the public GFC website (Desktop/GFC).
 *
 * The website was written against the legacy backend (server.js) and expects:
 *   - GET /api/content  -> every collection in one payload, with events shaped
 *                          as { dateEntries: [{ date, photos[], coverImage }] }
 *   - generic CRUD on /api/:collection
 *   - POST /api/uploads -> base64 photo into an event's date album
 *
 * The admin stores events in a flatter shape (photos[] with albumId/albumDate),
 * so this module projects the admin data into the shape the website expects.
 */

import { dbManager, SITE_COLLECTIONS, type DatabaseSchema, type AlbumPair } from './db.ts';
import type { Photo } from '../src/types/index.ts';
import type { SiteEvent } from './siteEvents.seed.ts';

/** Parse a stored date-ish value into a display string, else null. */
function displayDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/** Photo URLs for one event, grouped by their date album. */
function groupEventPhotos(photos: Photo[], eventId: string): Map<string, Photo[]> {
  const groups = new Map<string, Photo[]>();

  for (const photo of photos) {
    if (photo.eventId !== eventId) continue;

    // Prefer the explicit album date; fall back to a "(date)" suffix on the
    // album name, then to the capture date.
    let key = displayDate(photo.albumDate);
    if (!key && photo.albumName) {
      const match = /\(([^()]+)\)\s*$/.exec(photo.albumName);
      if (match) key = displayDate(match[1]);
    }
    if (!key) key = displayDate(photo.takenAt) || 'Photos';

    const bucket = groups.get(key);
    if (bucket) bucket.push(photo);
    else groups.set(key, [photo]);
  }

  return groups;
}

/**
 * Merge admin-uploaded photos into a website event.
 *
 * The website owns the event list, its order, and its existing photo albums.
 * Admin uploads are appended to the matching date album, or added as a new
 * album, so nothing already on the site is displaced.
 */
function withAdminPhotos(event: SiteEvent, photos: Photo[]): SiteEvent {
  // Admin photos reference admin events, so match by title to bridge the two.
  const title = event.title.toLowerCase();
  const related = photos.filter(p =>
    !p.eventId || (p.eventTitle || '').toLowerCase() === title
  );
  if (related.length === 0) return event;

  // Copy the photos arrays too - a shallow copy would let the merge below push
  // into the stored seed data, so merely reading /api/content would write.
  const entries = event.dateEntries.map(e => ({ ...e, photos: [...(e.photos || [])] }));
  const byDate = new Map(entries.map(e => [e.date, e]));

  for (const [date, group] of groupEventPhotos(related, related[0]?.eventId || '')) {
    const urls = group.map(p => p.imageUrl);
    const existing = byDate.get(date);
    if (existing) {
      // Append, skipping anything already listed.
      for (const url of urls) if (!existing.photos.includes(url)) existing.photos.push(url);
      existing.coverImage = existing.photos[0];
    } else {
      const entry = { date, photos: urls, coverImage: urls[0] };
      entries.push(entry);
      byDate.set(date, entry);
    }
  }

  return {
    ...event,
    dateEntries: entries.map(e => ({ ...e, photoCount: e.photos.length })),
  };
}

/**
 * Date albums added in the admin ("Add date" in the Events tab) are the same
 * albums the website lists, so they have to reach the website payload.
 *
 * Without this, a date saved in the admin only ever existed in the admin's own
 * photo picker: the website builds its albums from the seeded dateEntries plus
 * the photos that carry an albumDate, so a date with no photo yet was invisible
 * there. An album with no photos is still real - the website shows the date
 * with "0 photos" - so it is emitted as an empty entry.
 *
 * Read from the raw document rather than getDateAlbums() so that building the
 * website payload never seeds or writes anything.
 */
function withDateAlbums(event: SiteEvent, albums: Record<string, string[]>): SiteEvent {
  const key = (event.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const dates = Object.entries(albums || {}).find(
    ([title]) => String(title || '').trim().toLowerCase().replace(/\s+/g, ' ') === key,
  )?.[1];
  if (!dates || dates.length === 0) return event;

  const present = new Set(
    event.dateEntries.map((entry) => String(entry?.date || '').trim().toLowerCase().replace(/\s+/g, ' ')),
  );
  const added = dates.filter((date) => {
    const normalized = String(date || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return normalized.length > 0 && !present.has(normalized);
  });
  if (added.length === 0) return event;

  return {
    ...event,
    dateEntries: [
      ...event.dateEntries,
      ...added.map((date) => ({ date: String(date).trim(), photos: [], photoCount: 0 })),
    ],
  };
}

/**
 * Church Anniversary albums are a Year plus an Event name shown as ONE card.
 *
 * The pair annotates the album instead of creating a new one: `event` is the
 * same string the album, its photos and its cover are already keyed by, so
 * pairing can never duplicate a card or orphan a photo. A year that was added
 * but never paired deliberately produces nothing, otherwise every year would
 * show up as a card of its own next to its event.
 *
 * A pair whose album does not exist yet is emitted empty (0 photos) so the
 * album is visible right after it is created, matching how date albums behave.
 */
function withAlbumPairs(event: SiteEvent, pairs: Record<string, AlbumPair[]>): SiteEvent {
  const normalize = (value: unknown) =>
    String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const key = normalize(event.title);
  const list = Object.entries(pairs || {}).find(([title]) => normalize(title) === key)?.[1];
  if (!Array.isArray(list) || list.length === 0) return event;

  const byDate = new Map(event.dateEntries.map((entry) => [normalize(entry?.date), entry]));
  const entries = [...event.dateEntries];
  let changed = false;

  for (const pair of list) {
    const eventName = String(pair?.event || '').trim();
    const year = String(pair?.year || '').trim();
    if (!eventName || !year) continue;

    const existing = byDate.get(normalize(eventName));
    if (existing) {
      if (existing.albumYear === year && existing.albumEvent === eventName) continue;
      const index = entries.indexOf(existing);
      entries[index] = { ...existing, albumYear: year, albumEvent: eventName };
    } else {
      const entry = { date: eventName, photos: [], photoCount: 0, albumYear: year, albumEvent: eventName };
      entries.push(entry);
      byDate.set(normalize(eventName), entry);
    }
    changed = true;
  }

  return changed ? { ...event, dateEntries: entries } : event;
}

/**
 * Cover picked in the admin for a specific date/year album of an event.
 *
 * The website already renders entry.coverImage, but withAdminPhotos() fills that
 * field with the first photo of the album, which is not necessarily the cover
 * the admin chose. This runs last so the picked cover wins, while albums without
 * a picked cover keep the first-photo behaviour.
 *
 * Read from the raw document so building the website payload never writes.
 */
function withAlbumCovers(event: SiteEvent, covers: Record<string, Record<string, string>>): SiteEvent {
  const normalize = (value: unknown) =>
    String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const key = normalize(event.title);
  const byAlbum = Object.entries(covers || {}).find(([title]) => normalize(title) === key)?.[1];
  if (!byAlbum || Object.keys(byAlbum).length === 0) return event;

  const picked = new Map<string, string>(
    Object.entries(byAlbum)
      .map(([album, url]): [string, string] => [normalize(album), String(url || '').trim()])
      .filter(([, url]) => url.length > 0),
  );
  if (picked.size === 0) return event;

  let changed = false;
  const dateEntries = event.dateEntries.map((entry) => {
    const cover = picked.get(normalize(entry?.date));
    if (!cover) return entry;
    changed = true;
    return { ...entry, coverImage: cover };
  });

  return changed ? { ...event, dateEntries } : event;
}

/** Full payload for GET /api/content. */
export function buildSiteContent(): Record<string, unknown> {
  const db = dbManager.getRaw() as DatabaseSchema;
  const photos = db.photos || [];

  const attendees = (db.attendees || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    facebookName: a.facebookName,
    contact: a.contact,
    age: a.age != null ? String(a.age) : undefined,
    registeredAt: a.registeredAt,
  }));

  const announcements = (db.announcements || []).map((a: any) => ({
    id: a.id,
    title: a.title,
    details: (a as any).details || (a as any).content || '',
    date: (a as any).publishedAt || (a as any).date,
    category: (a as any).category,
    isPinned: (a as any).isPinned,
  }));

  const content: Record<string, unknown> = {
    version: 1,
    initialized: true,
    // The website's own event grid, in its original order, with the photos and
    // the album dates the admin has added folded in.
    events: dbManager
      .getSiteEvents()
      .map((e) =>
        withAlbumCovers(
          withAlbumPairs(
            withDateAlbums(withAdminPhotos(e, photos), (db.eventDateAlbums || {}) as Record<string, string[]>),
            (db.albumPairs || {}) as Record<string, AlbumPair[]>,
          ),
          (db.albumCovers || {}) as Record<string, Record<string, string>>,
        ),
      ),
    attendees,
    announcements,
  };

  for (const key of SITE_COLLECTIONS) {
    content[key] = db[key] || [];
  }

  return content;
}
