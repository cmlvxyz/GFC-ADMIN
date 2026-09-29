import { Router, Request, Response } from 'express';
import os from 'os';
import { dbManager, SITE_COLLECTIONS, SITE_EDITABLE } from './db.ts';

/** Run `listener` after every database write (used by the live SSE stream). */
const onSiteChange = (listener: () => void): (() => void) => dbManager.onChange(listener);
import { SITE_COPY_GROUPS, SITE_COPY_DEFAULTS } from './siteCopy.seed.ts';
import { buildSiteContent } from './compat.ts';
import { importFacebookPostMedia, FacebookImportError, photoStorageKey } from './facebook.ts';

export const apiRouter = Router();

/** Normalize any date-ish value into a YYYY-MM-DD string. */
function toDateString(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    system: 'GFC Unified Church System & Admin',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Addresses the public site is actually reachable at.
 *
 * A QR code is scanned with a phone, and on a phone "localhost" means the
 * phone itself, so a QR built from the admin's own origin never opens. The LAN
 * address is what a phone on the same Wi-Fi can reach, so it is returned here
 * for the admin UI to build scannable links.
 */
apiRouter.get('/reachable-urls', (_req: Request, res: Response) => {
  const sitePort = Number(process.env.SITE_PORT) || 3002;
  const hosts = new Set<string>(['localhost', '127.0.0.1']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const info of list || []) {
      if (info.internal || info.family !== 'IPv4') continue;
      hosts.add(info.address);
    }
  }
  res.json({
    urls: Array.from(hosts).map((host) => `http://${host}:${sitePort}`),
  });
});

// Authentication
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Find user by email or provide default admin access
  let user = dbManager.getUserByEmail(email);
  if (!user && (email.toLowerCase().includes('admin') || email.toLowerCase() === 'admin@gfc.org')) {
    user = dbManager.getUsers()[0];
  }

  if (!user) {
    // If user does not exist but credentials provided, return error
    return res.status(401).json({ error: 'Invalid user credentials. Please check your email or contact church administration.' });
  }

  // Update last login
  dbManager.updateUser(user.id, { lastLogin: new Date().toISOString() });

  const token = 'gfc_token_' + Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
  res.json({
    token,
    user,
    message: `Welcome back, ${user.name}!`,
  });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // Return primary admin as fallback for convenient session
    const defaultUser = dbManager.getUsers()[0];
    return res.json({ user: defaultUser });
  }

  const defaultUser = dbManager.getUsers()[0];
  res.json({ user: defaultUser });
});

// Dashboard Stats
apiRouter.get('/stats', (req: Request, res: Response) => {
  const stats = dbManager.getStats();
  res.json(stats);
});

// Events
apiRouter.get('/events', (req: Request, res: Response) => {
  const { status, search } = req.query;
  const events = dbManager.getEvents({
    status: typeof status === 'string' ? status : undefined,
    search: typeof search === 'string' ? search : undefined,
  });
  res.json(events);
});

apiRouter.get('/events/:id', (req: Request, res: Response) => {
  const event = dbManager.getEventById(req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  const attendees = dbManager.getAttendees(event.id);
  res.json({ ...event, attendees });
});

apiRouter.post('/events', (req: Request, res: Response) => {
  try {
    const event = dbManager.createEvent(req.body);
    res.status(201).json(event);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create event' });
  }
});

apiRouter.put('/events/:id', (req: Request, res: Response) => {
  const updated = dbManager.updateEvent(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Event not found' });
  }
  res.json(updated);
});

apiRouter.delete('/events/:id', (req: Request, res: Response) => {
  const success = dbManager.deleteEvent(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Event not found' });
  }
  res.json({ success: true, id: req.params.id });
});

/**
 * Import the photos and videos attached to ONE Facebook post.
 *
 * Body: { url, eventName?, eventDate?, save? }
 *   - save omitted/false: preview only, nothing is written to the database.
 *   - save true: also creates the gallery records for the found media.
 *
 * All Facebook calls happen here on the server, so the Page Access Token is
 * never sent to the browser. Only a URL and the resolved media come back.
 */
apiRouter.post('/facebook/import', async (req: Request, res: Response) => {
  const { url, eventName, eventDate, save } = req.body ?? {};
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({
      success: false,
      error: 'A Facebook link is required.',
      code: 'invalid_request',
    });
  }

  try {
    const result = await importFacebookPostMedia(url);

    // Mark what is already stored, so importing the same post twice cannot
    // quietly double the gallery. Facebook re-signs the CDN URL on every read,
    // so the comparison uses the immutable part of the URL.
    const existing = new Set(dbManager.getPhotos().map((p) => photoStorageKey(p.imageUrl)));
    const seenInBatch = new Set<string>();
    const media = result.media.map((item) => {
      const key = photoStorageKey(item.url);
      const duplicate = existing.has(key) || seenInBatch.has(key);
      seenInBatch.add(key);
      return { ...item, duplicate };
    });
    const duplicateCount = media.filter((item) => item.duplicate).length;

    const response = {
      success: true,
      sourceUrl: result.sourceUrl,
      postId: result.postId,
      permalink: result.permalink,
      message: result.message,
      createdTime: result.createdTime,
      albumName: result.albumName,
      media,
      warnings: result.warnings,
      duplicateCount,
    };

    // Preview mode: return the media so the admin can see it before saving.
    if (!save) {
      return res.json({ ...response, saved: 0 });
    }

    const images = media.filter((item) => item.type === 'image' && !item.duplicate);
    const videos = media.filter((item) => item.type === 'video' && !item.duplicate);
    const created = images.map((item, index) =>
      dbManager.createPhoto({
        title: `${result.albumName} - Photo ${index + 1}`,
        description: result.message ? result.message.slice(0, 300) : undefined,
        imageUrl: item.url,
        albumName: result.albumName,
        albumDate: eventDate || undefined,
        category: 'Facebook Import',
        eventTitle: eventName || null,
        takenAt: eventDate || toDateString(result.createdTime),
        qrShareUrl: result.permalink,
        uploaderName: 'Facebook Import',
        uploaderRole: 'Automated',
      }),
    );

    // Videos are media too: keep them in the gallery as a poster card that
    // links back to the exact file, so nothing from the post is dropped.
    let videoCount = 0;
    for (const video of videos) {
      if (!video.thumbnail) continue;
      videoCount += 1;
      created.push(
        dbManager.createPhoto({
          title: `${result.albumName} - Video ${videoCount}`,
          description: `Facebook video: ${video.url}`,
          imageUrl: video.thumbnail,
          albumName: result.albumName,
          albumDate: eventDate || undefined,
          category: 'Facebook Import',
          eventTitle: eventName || null,
          takenAt: eventDate || toDateString(result.createdTime),
          qrShareUrl: result.permalink,
          uploaderName: 'Facebook Import',
          uploaderRole: 'Automated',
          tags: ['gfc', 'fellowship', 'video'],
        }),
      );
    }

    return res.json({ ...response, photos: created, saved: created.length, skipped: duplicateCount });
  } catch (err: any) {    if (err instanceof FacebookImportError) {
      // Log the real reason server-side: the browser only shows the status code,
      // which is not enough to tell a bad link from a token permission problem.
      console.error(
        `[Facebook Import] ${err.code} (fb ${err.fbCode ?? 'n/a'}) for ${url}: ${err.message}`,
      );
      return res.status(err.status).json({ success: false, error: err.message, code: err.code });
    }
    console.error(`[Facebook Import] unexpected failure for ${url}:`, err);
    return res.status(500).json({
      success: false,
      error: 'Facebook import failed. Please try again.',
      code: 'facebook_import_failed',
    });
  }
});

// Date Albums for Events
apiRouter.get('/events-meta/date-albums', (req: Request, res: Response) => {
  res.json(dbManager.getDateAlbums());
});

apiRouter.post('/events-meta/date-albums', (req: Request, res: Response) => {
  const { eventName, date } = req.body;
  if (!eventName || !date) {
    return res.status(400).json({ error: 'eventName and date are required' });
  }
  const updated = dbManager.addDateAlbum(eventName, date);
  res.json(updated);
});

apiRouter.delete('/events-meta/date-albums', (req: Request, res: Response) => {
  const { eventName, date } = req.body;
  if (!eventName || !date) {
    return res.status(400).json({ error: 'eventName and date are required' });
  }
  const updated = dbManager.deleteDateAlbum(eventName, date);
  res.json(updated);
});

// Church Anniversary: a Year and an Event name that are shown together as one
// album card. The pair only labels the album, the photos stay where they are.
apiRouter.get('/events-meta/album-years', (req: Request, res: Response) => {
  res.json(dbManager.getAlbumYears());
});

apiRouter.post('/events-meta/album-years', (req: Request, res: Response) => {
  const { eventName, year } = req.body || {};
  if (!eventName || !year) {
    return res.status(400).json({ error: 'eventName and year are required' });
  }
  const value = String(year).trim();
  // A year is a number, possibly a range like 2024-2025, but never prose: a
  // mistyped "Chrirstmas" must not become an album.
  if (value.length > 20 || !/\d/.test(value)) {
    return res.status(400).json({ error: 'year must contain a number, e.g. 2024' });
  }
  res.json(dbManager.addAlbumYear(eventName, value));
});

apiRouter.get('/events-meta/album-pairs', (req: Request, res: Response) => {
  res.json(dbManager.getAlbumPairs());
});

apiRouter.post('/events-meta/album-pairs', (req: Request, res: Response) => {
  const { eventName, year, event } = req.body || {};
  if (!eventName || !year || !event) {
    return res.status(400).json({ error: 'eventName, year and event are required' });
  }
  const value = String(event).trim();
  if (!value || value.length > 80) {
    return res.status(400).json({ error: 'event must be 1-80 characters' });
  }
  res.json(dbManager.setAlbumPair(eventName, String(year).trim(), value));
});

apiRouter.delete('/events-meta/album-pairs', (req: Request, res: Response) => {
  const { eventName, year, event } = req.body || {};
  if (!eventName || !year || !event) {
    return res.status(400).json({ error: 'eventName, year and event are required' });
  }
  res.json(dbManager.deleteAlbumPair(eventName, String(year).trim(), String(event).trim()));
});

// Cover image of one album, used by year albums ("Church Anniversary > 2025")
// as well as ordinary date albums.
apiRouter.get('/events-meta/album-covers', (req: Request, res: Response) => {
  res.json(dbManager.getAlbumCovers());
});

apiRouter.post('/events-meta/album-covers', (req: Request, res: Response) => {
  const { eventName, album, coverUrl } = req.body || {};
  if (!eventName || !album) {
    return res.status(400).json({ error: 'eventName and album are required' });
  }
  const value = String(coverUrl || '').trim();
  if (value && !isSafeImageUrl(value)) {
    return res.status(400).json({ error: 'coverUrl must be an http(s) or data:image URL' });
  }
  res.json(dbManager.setAlbumCover(eventName, String(album), value));
});

/**
 * A cover is rendered back into the admin UI and the public site, so only real
 * image sources are accepted. This keeps a stored cover from becoming a
 * javascript:/data: script vector.
 */
function isSafeImageUrl(value: string): boolean {
  if (/^https?:\/\//i.test(value)) return true;
  // Inline uploads: allow raster image types only, never svg+xml.
  if (!/^data:image\//i.test(value)) return false;
  return !/^data:image\/svg\+xml/i.test(value);
}

// Event Registration & Ticket QR
apiRouter.post('/events/:id/register', (req: Request, res: Response) => {
  const { attendeeName, attendeeEmail, attendeePhone } = req.body;
  if (!attendeeName || !attendeeEmail) {
    return res.status(400).json({ error: 'Name and email are required for registration' });
  }

  const attendee = dbManager.registerAttendee(req.params.id, attendeeName, attendeeEmail, attendeePhone);
  if (!attendee) {
    return res.status(404).json({ error: 'Event not found or registration closed' });
  }

  res.status(201).json({
    attendee,
    message: 'Registration successful! Your QR Ticket has been generated.',
  });
});

apiRouter.get('/events/:id/attendees', (req: Request, res: Response) => {
  const attendees = dbManager.getAttendees(req.params.id);
  res.json(attendees);
});

// QR Code Validation Endpoint (Used by Event Entrance Scanner)
apiRouter.post('/events/verify-qr', (req: Request, res: Response) => {
  const { qrPayload, targetEventId } = req.body;
  if (!qrPayload) {
    return res.status(400).json({ error: 'QR Code payload is required' });
  }

  const result = dbManager.verifyAndCheckInQR(qrPayload, targetEventId);
  res.json(result);
});

// Photos & All Photos
apiRouter.get('/photos', (req: Request, res: Response) => {
  const { albumId, eventId, search, featured } = req.query;
  const photos = dbManager.getPhotos({
    albumId: typeof albumId === 'string' ? albumId : undefined,
    eventId: typeof eventId === 'string' ? eventId : undefined,
    search: typeof search === 'string' ? search : undefined,
    featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
  });
  res.json(photos);
});

apiRouter.get('/photos/:id', (req: Request, res: Response) => {
  const photo = dbManager.getPhotoById(req.params.id);
  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  res.json(photo);
});

apiRouter.get('/photos/:id/qr', (req: Request, res: Response) => {
  const photo = dbManager.getPhotoById(req.params.id);
  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  res.json({
    id: photo.id,
    title: photo.title,
    qrCodeValue: photo.qrCodeValue,
    qrShareUrl: photo.qrShareUrl,
    imageUrl: photo.imageUrl,
  });
});

apiRouter.post('/photos', (req: Request, res: Response) => {
  try {
    // Last line of defence against a doubled gallery: importing the same post
    // twice (or clicking Save twice) must not store the same picture again.
    const incoming = photoStorageKey(req.body?.imageUrl);
    if (incoming) {
      const already = dbManager
        .getPhotos()
        .find((p) => photoStorageKey(p.imageUrl) === incoming);
      if (already) {
        return res.status(409).json({
          error: 'That photo is already in the gallery.',
          code: 'duplicate_photo',
          duplicate: true,
          existingId: already.id,
        });
      }
    }
    const photo = dbManager.createPhoto(req.body);
    res.status(201).json(photo);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to upload photo' });
  }
});

apiRouter.put('/photos/:id', (req: Request, res: Response) => {
  const updated = dbManager.updatePhoto(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  res.json(updated);
});

apiRouter.delete('/photos/:id', (req: Request, res: Response) => {
  const success = dbManager.deletePhoto(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  res.json({ success: true, id: req.params.id });
});

// Albums
apiRouter.get('/albums', (req: Request, res: Response) => {
  const albums = dbManager.getAlbums();
  res.json(albums);
});

apiRouter.post('/albums', (req: Request, res: Response) => {
  const album = dbManager.createAlbum(req.body);
  res.status(201).json(album);
});

apiRouter.delete('/albums/:id', (req: Request, res: Response) => {
  const success = dbManager.deleteAlbum(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Album not found' });
  }
  res.json({ success: true });
});

// Users / Staff / Members
apiRouter.get('/users', (req: Request, res: Response) => {
  res.json(dbManager.getUsers());
});

apiRouter.post('/users', (req: Request, res: Response) => {
  const user = dbManager.createUser(req.body);
  res.status(201).json(user);
});

apiRouter.put('/users/:id', (req: Request, res: Response) => {
  const updated = dbManager.updateUser(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json(updated);
});

apiRouter.delete('/users/:id', (req: Request, res: Response) => {
  const success = dbManager.deleteUser(req.params.id);
  if (!success) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
});

// Announcements
apiRouter.get('/announcements', (req: Request, res: Response) => {
  const activeOnly = req.query.active === 'true';
  res.json(dbManager.getAnnouncements(activeOnly));
});

apiRouter.post('/announcements', (req: Request, res: Response) => {
  const ann = dbManager.createAnnouncement(req.body);
  res.status(201).json(ann);
});

apiRouter.put('/announcements/:id', (req: Request, res: Response) => {
  const updated = dbManager.updateAnnouncement(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Announcement not found' });
  res.json(updated);
});

apiRouter.delete('/announcements/:id', (req: Request, res: Response) => {
  const success = dbManager.deleteAnnouncement(req.params.id);
  if (!success) return res.status(404).json({ error: 'Announcement not found' });
  res.json({ success: true });
});

// Activity Logs
apiRouter.get('/activity-logs', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  res.json(dbManager.getActivityLogs(limit));
});

// Settings
apiRouter.get('/settings', (req: Request, res: Response) => {
  res.json(dbManager.getSettings());
});

apiRouter.put('/settings', (req: Request, res: Response) => {
  const updated = dbManager.updateSettings(req.body);
  res.json(updated);
});

// Every string the public website renders, grouped and labelled for editing.
apiRouter.get('/site-copy', (_req: Request, res: Response) => {
  const stored = new Map(
    (dbManager.getSiteCollection('siteSettings') as any[]).map(s => [s.key, s.value]),
  );
  const groups = SITE_COPY_GROUPS.map(g => ({
    id: g.id,
    title: g.title,
    blurb: g.blurb,
    fields: g.fields.map(field => ({
      key: field.key,
      label: field.label,
      multiline: !!field.multiline,
      // A blank value falls back to the shipped default on the website.
      value: stored.get(field.key) ?? '',
      isDefault: !stored.has(field.key) || stored.get(field.key) === field.value,
    })),
  }));
  res.json({ groups, total: groups.reduce((n, g) => n + g.fields.length, 0) });
});

apiRouter.put('/site-copy', (req: Request, res: Response) => {
  const updates = req.body?.values;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return res.status(400).json({ error: 'Send { values: { "key": "text" } }' });
  }
  const known = new Set(Object.keys(SITE_COPY_DEFAULTS));
  const unknown = Object.keys(updates).filter(k => !known.has(k));
  if (unknown.length) {
    return res.status(400).json({ error: `Unknown key(s): ${unknown.join(', ')}` });
  }
  const applied: string[] = [];
  for (const [key, raw] of Object.entries(updates)) {
    const value = String(raw ?? '');
    // Store an empty string as "use the default" so the DB never drifts from
    // the code when a field is cleared.
    dbManager.setSiteSettingValue(key, value.trim() === '' ? SITE_COPY_DEFAULTS[key] : value);
    applied.push(key);
  }
  res.json({ saved: applied.length, keys: applied });
});

// Website Content & CMS (Editable Church Descriptions, Texts, Banners, Verses)
apiRouter.get('/website-content', (req: Request, res: Response) => {
  res.json(dbManager.getWebsiteContent());
});

apiRouter.put('/website-content', (req: Request, res: Response) => {
  try {
    const updated = dbManager.updateWebsiteContent(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update website content' });
  }
});

// Tithes & Offering Ledger (Transactions, Filter, Excel/CSV Export)
apiRouter.get('/transactions', (req: Request, res: Response) => {
  const { type, year, month, date, from, to } = req.query;
  const filter = type ? {
    type: type as any,
    year: typeof year === 'string' ? year : undefined,
    month: typeof month === 'string' ? month : undefined,
    date: typeof date === 'string' ? date : undefined,
    from: typeof from === 'string' ? from : undefined,
    to: typeof to === 'string' ? to : undefined,
  } : undefined;

  const result = dbManager.getTransactions(filter);
  res.json(result);
});

apiRouter.post('/transactions', (req: Request, res: Response) => {
  try {
    const tx = dbManager.addTransaction(req.body);
    const summary = dbManager.getTransactions();
    res.status(201).json({
      transaction: tx,
      totals: summary.totals,
      message: 'Transaction successfully recorded in GFC Ledger',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to record transaction' });
  }
});

apiRouter.delete('/transactions/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Valid numeric transaction id required' });
  }
  const deleted = dbManager.deleteTransaction(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  const summary = dbManager.getTransactions();
  res.json({ success: true, id, totals: summary.totals });
});

apiRouter.delete('/transactions-clear', (req: Request, res: Response) => {
  dbManager.clearAllTransactions();
  res.json({ success: true, message: 'All transactions cleared' });
});

apiRouter.post('/transactions/sample', (req: Request, res: Response) => {
  const list = dbManager.seedSampleTransactions();
  const summary = dbManager.getTransactions();
  res.json({
    message: 'GFC Sample Ledger reloaded successfully',
    transactions: list,
    totals: summary.totals,
  });
});

apiRouter.get('/transactions/export-csv', (req: Request, res: Response) => {
  const { type, year, month, date, from, to } = req.query;
  const filter = type ? {
    type: type as any,
    year: typeof year === 'string' ? year : undefined,
    month: typeof month === 'string' ? month : undefined,
    date: typeof date === 'string' ? date : undefined,
    from: typeof from === 'string' ? from : undefined,
    to: typeof to === 'string' ? to : undefined,
  } : undefined;

  const csv = dbManager.exportCSV(filter);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="GFC_Tithes_Offering_Ledger.csv"');
  res.send(csv);
});

// Database Reset (for testing / demo recovery)
apiRouter.post('/database/reset', (req: Request, res: Response) => {
  dbManager.resetDatabase();
  res.json({ success: true, message: 'Database reset to initial sample state.' });
});

// ============================================================
//  PUBLIC WEBSITE COMPATIBILITY (GFC website - Desktop/GFC)
//  The website was built against the legacy backend and calls
//  /api/content, /api/uploads and /api/photo. These routes are
//  registered LAST so they never shadow the admin routes above.
// ============================================================

/** Collections the website may read/write through the generic routes. */
const isSiteCollection = (key: string): boolean =>
  (SITE_EDITABLE as readonly string[]).includes(key);

// All site content in one payload (what the website boots from)
apiRouter.get('/content', (req: Request, res: Response) => {
  res.json(buildSiteContent());
});

apiRouter.delete('/content', (req: Request, res: Response) => {
  for (const key of SITE_COLLECTIONS) dbManager.setSiteCollection(key, []);
  dbManager.logActivity('Reset', 'settings', 'content', 'Cleared website collections');
  res.json({ success: true });
});

apiRouter.post('/bootstrap', (req: Request, res: Response) => {
  for (const key of SITE_COLLECTIONS) {
    if (Array.isArray(req.body?.[key])) dbManager.setSiteCollection(key, req.body[key]);
  }
  res.status(201).json(buildSiteContent());
});

// Photo upload from the website's public upload page.
// Body: { image: dataURL, eventId, date?, dateIndex? }
apiRouter.post('/uploads', (req: Request, res: Response) => {
  const { image, eventId, date, dateIndex } = req.body || {};

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ message: 'image (data URL) is required' });
  }
  if (!eventId) {
    return res.status(400).json({ message: 'eventId is required' });
  }

  // The website sends a site event id (e.g. "sunday"), not an admin event id.
  const siteEvents = dbManager.getSiteEvents();
  const siteEvent = siteEvents.find(e => e.id === eventId);
  if (!siteEvent) {
    return res.status(404).json({ message: 'Event not found' });
  }

  // Resolve which date album this belongs to.
  let albumDate = typeof date === 'string' && date.trim() ? date.trim() : '';
  if (!albumDate) {
    const existing = siteEvent.dateEntries || [];
    albumDate = existing[Number(dateIndex) || 0]?.date || '';
  }

  const photo = dbManager.createPhoto({
    title: `${siteEvent.title}${albumDate ? ` - ${albumDate}` : ''}`,
    category: 'Sunday Worship',
    albumName: albumDate ? `${siteEvent.title} (${albumDate})` : siteEvent.title,
    albumDate: albumDate || undefined,
    eventId: siteEvent.id,
    eventTitle: siteEvent.title,
    imageUrl: image,
    uploaderName: 'Public Upload',
    uploaderRole: 'Guest',
    takenAt: new Date().toISOString().split('T')[0],
  });

  res.status(201).json({ success: true, photo, message: 'Photo uploaded' });
});

// Image proxy, so the website never has to deal with cross-origin image hosts.
apiRouter.get('/photo', async (req: Request, res: Response) => {
  const url = typeof req.query.u === 'string' ? req.query.u : '';
  if (!url) return res.status(400).json({ message: 'Missing u parameter' });

  const isRemote = /^https?:\/\//i.test(url);
  const isLocal = url.startsWith('/');
  if (!isRemote && !isLocal) {
    return res.status(400).json({ message: 'Invalid image URL' });
  }

  try {
    if (isLocal) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(url.replace(/^\/+/, ''), { root: process.cwd() + '/public' });
    }

    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(upstream.status).end();

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err: any) {
    res.status(502).json({ message: 'Could not load image' });
  }
});

// Live activity feed consumed by the website (SSE).
apiRouter.get('/activities/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(': connected\n\n');

  /**
   * Push an event the moment something changes, instead of only on a timer.
   *
   * The public site refreshes on `type: 'allPhotos' | 'events'` with a lower
   * case `action`, so the activity log (which spells actions like "Delete
   * Photo" and calls the field entityType) is translated here. Without this the
   * site ignored every push and only caught up on the next poll.
   */
  const STREAM_TOPICS: Record<string, string> = {
    photo: 'allPhotos',
    event: 'events',
  };

  const lastSentId = { value: '' };
  const sendLatest = () => {
    const latest = dbManager.getActivityLogs(1)[0] || null;
    if (!latest) return;
    if (latest.id === lastSentId.value) return;
    lastSentId.value = latest.id;
    const topic = STREAM_TOPICS[latest.entityType] || latest.entityType;
    const action = String(latest.action || '').toLowerCase().split(' ')[0] || 'updated';
    res.write(`data: ${JSON.stringify({ type: 'activity', data: { ...latest, type: topic, action } })}\n\n`);
  };

  const send = () => {
    try {
      sendLatest();
    } catch { /* connection already gone */ }
  };

  send();
  // Also push on every write, so a delete shows up on the site immediately.
  const unsubscribe = onSiteChange(send);
  // Safety net in case a push is ever missed.
  const timer = setInterval(send, 10000);

  req.on('close', () => {
    clearInterval(timer);
    unsubscribe();
    res.end();
  });
});

apiRouter.get('/activities', (req: Request, res: Response) => {
  res.json({ activities: dbManager.getActivityLogs(Number(req.query.limit) || 100) });
});

apiRouter.delete('/activities', (req: Request, res: Response) => {
  const raw = dbManager.getRaw() as any;
  raw.activityLogs = [];
  dbManager.setSiteCollection('siteSettings', dbManager.getSiteCollection('siteSettings'));
  res.json({ success: true });
});

// ---- Church People: attendees -> members -> leaders ----
// Registered before the generic routes below, otherwise `/:collection/:id`
// would swallow these paths.
apiRouter.get('/people/attendees', (_req: Request, res: Response) => {
  res.json(dbManager.getAttendees());
});

apiRouter.get('/people/members', (_req: Request, res: Response) => {
  res.json(dbManager.getMembers());
});

apiRouter.get('/people/leaders', (_req: Request, res: Response) => {
  res.json(dbManager.getPastors());
});

apiRouter.post('/people/attendees', (req: Request, res: Response) => {
  const { name, email, phone, facebook, albumDate, eventId, eventTitle } = req.body ?? {};
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const attendee = {
    id: 'att-' + Date.now(),
    eventId: eventId ?? '',
    eventTitle: eventTitle ?? '',
    attendeeName: name,
    attendeeEmail: email ?? '',
    attendeePhone: phone ?? '',
    attendeeFacebook: facebook ?? '',
    albumDate: albumDate ?? '',
    ticketCode: 'GFC-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    status: 'confirmed',
    checkedInAt: null,
    createdAt: new Date().toISOString(),
  };
  const list = dbManager.getSiteCollection('attendees');
  dbManager.setSiteCollection('attendees', [attendee, ...list]);
  dbManager.logActivity('Add Attendee', 'attendee', attendee.id, `Added attendee ${name}`);
  res.status(201).json(attendee);
});

apiRouter.post('/people/members', (req: Request, res: Response) => {
  const { name, email, phone } = req.body ?? {};
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const member = {
    id: 'mem-' + Date.now(),
    name,
    email: email ?? '',
    phone: phone ?? '',
    joinedAt: new Date().toISOString(),
    status: 'active',
    source: 'manual',
    note: '',
  };
  dbManager.setSiteCollection('members', [member, ...dbManager.getMembers()]);
  dbManager.logActivity('Add Member', 'member', member.id, `Added member ${name}`);
  res.status(201).json(member);
});

apiRouter.post('/people/leaders', (req: Request, res: Response) => {
  const { name, email, phone, role } = req.body ?? {};
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const leader = {
    id: 'ldr-' + Date.now(),
    name,
    role: role ?? 'Leader',
    facebook: '',
    image: '',
  };
  dbManager.setSiteCollection('pastors', [leader, ...dbManager.getPastors()]);
  dbManager.logActivity('Add Leader', 'leader', leader.id, `Added leader ${name}`);
  res.status(201).json(leader);
});

/** attendee -> member */
apiRouter.post('/people/attendees/:id/promote', (req: Request, res: Response) => {
  try {
    res.status(201).json(dbManager.promoteAttendeeToMember(req.params.id));
  } catch (err: any) {
    res.status(404).json({ message: err.message });
  }
});

/** member -> leader */
apiRouter.post('/people/members/:id/promote', (req: Request, res: Response) => {
  try {
    res.status(201).json(dbManager.promoteMemberToLeader(req.params.id));
  } catch (err: any) {
    res.status(404).json({ message: err.message });
  }
});

apiRouter.delete('/people/:kind/:id', (req: Request, res: Response) => {
  const { kind, id } = req.params;
  const key = kind === 'attendees' ? 'attendees' : kind === 'members' ? 'members' : kind === 'leaders' ? 'pastors' : null;
  if (!key) return res.status(404).json({ message: 'Not found' });
  const entityType: 'attendee' | 'member' | 'leader' = kind === 'attendees' ? 'attendee' : kind === 'members' ? 'member' : 'leader';
  const next = dbManager.getSiteCollection(key).filter((r: any) => r.id !== id);
  dbManager.setSiteCollection(key, next);
  dbManager.logActivity('Delete', entityType, id, `Removed ${kind.slice(0, -1)} ${id}`);
  res.json({ success: true });
});

// Generic CRUD for the website's own collections. Registered last on purpose.
apiRouter.get('/:collection', (req: Request, res: Response) => {
  const { collection } = req.params;
  if (!isSiteCollection(collection)) return res.status(404).json({ message: 'Not found' });
  res.json(dbManager.getSiteCollection(collection));
});

apiRouter.post('/:collection', (req: Request, res: Response) => {
  const { collection } = req.params;
  if (!isSiteCollection(collection)) return res.status(404).json({ message: 'Not found' });
  res.status(201).json(dbManager.createSiteRecord(collection, req.body));
});

apiRouter.patch('/:collection/:id', (req: Request, res: Response) => {
  const { collection, id } = req.params;
  if (!isSiteCollection(collection)) return res.status(404).json({ message: 'Not found' });
  const updated = dbManager.updateSiteRecord(collection, id, req.body);
  if (!updated) return res.status(404).json({ message: 'Record not found' });
  res.json(updated);
});

apiRouter.put('/:collection/:id', (req: Request, res: Response) => {
  const { collection, id } = req.params;
  if (!isSiteCollection(collection)) return res.status(404).json({ message: 'Not found' });
  const updated = dbManager.updateSiteRecord(collection, id, req.body);
  if (!updated) return res.status(404).json({ message: 'Record not found' });
  res.json(updated);
});

apiRouter.delete('/:collection/:id', (req: Request, res: Response) => {
  const { collection, id } = req.params;
  if (!isSiteCollection(collection)) return res.status(404).json({ message: 'Not found' });
  const ok = dbManager.deleteSiteRecord(collection, id);
  if (!ok) return res.status(404).json({ message: 'Record not found' });
  res.json({ success: true });
});
