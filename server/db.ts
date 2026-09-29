import fs from 'fs';
import path from 'path';
import { storageLoad, storageSave, storageMode } from './storage.ts';
import { DEFAULT_SITE_EVENTS, type SiteEvent } from './siteEvents.seed.ts';
import { MIGRATED_LEDGER } from './ledger.seed.ts';
import { SEED_PASTORS } from './pastors.seed.ts';
import { SITE_COPY_DEFAULTS } from './siteCopy.seed.ts';
import { 
  User, GFCEvent, Attendee, Photo, Album, Announcement, ActivityLog, ChurchSettings, DashboardStats, QRVerifyResult,
  WebsiteContent, LedgerTransaction, LedgerTotals, LedgerFilter
} from '../src/types/index.ts';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const DB_FILE = path.join(DATA_DIR, 'gfc_database.json');

/**
 * A Church Anniversary album is a Year plus an Event name shown together as one
 * card, e.g. { year: '2024', event: '2nd Year Anniversary' }.
 */
export type { AlbumPair } from '../src/types/index.ts';

export interface DatabaseSchema {
  users: User[];
  events: GFCEvent[];
  attendees: Attendee[];
  photos: Photo[];
  albums: Album[];
  announcements: Announcement[];
  activityLogs: ActivityLog[];
  settings: ChurchSettings;
  eventDateAlbums: Record<string, string[]>;
  /**
   * Cover image per album, keyed by event title then album label. Year albums
   * ("Church Anniversary > 2025") and date albums use the same map, so the
   * admin can pick a cover for either without a second store.
   */
  albumCovers?: Record<string, Record<string, string>>;
  /**
   * Years offered for a Church Anniversary event, keyed by event title. A year
   * on its own is not an album: it only becomes one once it is paired with an
   * event name below, so a year never renders as a card of its own.
   */
  albumYears?: Record<string, string[]>;
  /**
   * A Year + Event pair is ONE album on the website. Keyed by event title.
   * `event` is also the album label, which is what photos, date albums and
   * album covers already use, so pairing adds a year to an existing album
   * instead of creating a second, competing one.
   */
  albumPairs?: Record<string, import('../src/types/index.ts').AlbumPair[]>;
  websiteContent?: WebsiteContent;
  transactions?: LedgerTransaction[];

  /**
   * The public website's own event grid (Desktop/GFC), in render order.
   * Separate from `events` above, which tracks internal operations such as
   * registration and QR check-in rather than what the public sees.
   */
  siteEvents?: SiteEvent[];

  /**
   * Public-site collections. The GFC website (Desktop/GFC) reads these through
   * GET /api/content, so they must exist even before the admin UI edits them.
   * Typed loosely on purpose - the website owns these shapes.
   */
  sermons?: any[];
  prayers?: any[];
  members?: any[];
  testimonials?: any[];
  aboutImages?: any[];
  ministries?: any[];
  pastors?: any[];
  songs?: any[];
  aboutInfo?: any[];
  verses?: any[];
  giveInfo?: any[];
  siteSettings?: any[];
}

/** Collections served to the public website via /api/content. */
export const SITE_COLLECTIONS = [
  'sermons', 'prayers', 'members', 'testimonials', 'aboutImages',
  'ministries', 'pastors', 'songs', 'aboutInfo', 'verses', 'giveInfo',
  'siteSettings',
] as const;

/**
 * Collections the website may read/write through the generic CRUD routes.
 * `siteEvents` is editable too, but it is served as `events` (see compat.ts),
 * not under its own key.
 */
export const SITE_EDITABLE = [...SITE_COLLECTIONS, 'siteEvents'] as const;

const DEFAULT_SETTINGS: ChurchSettings = {
  churchName: 'Gospel Fellowship Church',
  abbreviation: 'GFC',
  tagline: 'Rooted in Faith, Growing in Fellowship, Reaching in Love',
  address: 'GFC Worship Center, Limay, Bataan, Philippines',
  contactEmail: 'contact@gfc-fellowship.org',
  contactPhone: '+63 917 123 4567',
  websiteUrl: 'https://gfc-fellowship.org',
  qrCheckInEnabled: true,
  qrPhotoSharingEnabled: true,
  allowPublicPhotoUpload: true,
  requireAdminApprovalForPhotos: false,
  defaultEventCapacity: 250,
};

export const DEFAULT_WEBSITE_CONTENT: WebsiteContent = {
  churchName: 'Gospel Fellowship Church',
  tagline: 'Tithes & Offering Ledger',
  subTagline: 'Rooted in Faith, Growing in Fellowship, Reaching in Love',
  logoUrl: '/gfc-logo.png',
  bannerVerse: '“Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.”',
  bannerVerseRef: '2 Corinthians 9:7 (NIV)',
  heroHeadline: 'Worship, Community & Fellowship in Christ',
  heroDescription: 'Join Gospel Fellowship Church for inspirational Sunday services, youth gatherings, community outreach, and heartfelt fellowship in Limay, Bataan.',
  heroBadge: 'Welcome to Our Church Family',
  heroImageUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1600&q=80',
  ctaButtonText: 'Browse Church Events',
  ctaSecondaryText: 'View Fellowship Photos',
  aboutTitle: 'About Gospel Fellowship Church',
  aboutDescription: 'Gospel Fellowship Church is a Bible-believing, Christ-exalting fellowship in Limay, Bataan. We exist to declare the glorious gospel of Jesus Christ, disciple believers into spiritual maturity, and serve our local community with genuine Christian love and compassion.',
  mission: 'To preach the Word of God faithfully, cultivate a loving fellowship of believers, and make devoted disciples of Jesus Christ who impact the nation.',
  vision: 'A thriving, Spirit-filled church of passionate worshipers and servant leaders, transforming families and communities across Bataan and beyond.',
  pastorWelcomeTitle: 'A Message from Pastor Edrian Clavel',
  pastorWelcomeMessage: 'Welcome to Gospel Fellowship Church! Whether you are seeking spiritual answers, looking for a church family, or desiring deeper discipleship, you are always welcome here.',
  pastorName: 'Pastor Edrian Clavel',
  pastorRole: 'Senior Pastor',
  pastorImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  givingTitle: 'Tithes, Offerings & Stewardship',
  givingDescription: 'We worship God through faithful stewardship. Your tithes and generous love gifts support our Sunday ministries, church facilities, feeding programs, and missionary outreach.',
  givingVerse: '“Bring the whole tithe into the storehouse, that there may be food in my house.”',
  givingVerseRef: 'Malachi 3:10',
  bankAccountDetails: 'BDO Unibank - Gospel Fellowship Church\nAccount No: 0072-1082-9912',
  gcashDetails: 'GCash: 0917-888-1234 (Edrian C.)',
  serviceTimes: [
    { name: 'Sunday Grand Worship', dayTime: 'Sundays 9:00 AM - 11:30 AM', description: 'Main Worship Sanctuary with Praise & Communion' },
    { name: 'Midweek Prayer & Bible Study', dayTime: 'Wednesdays 7:00 PM - 8:30 PM', description: 'Expository Scripture Teaching & Intercession' },
    { name: 'Youth Alive Fellowship', dayTime: 'Saturdays 4:00 PM - 6:00 PM', description: 'Dynamic Youth Ministry, Mentorship & Fun' }
  ],
  contactAddress: 'GFC Worship Center, Limay, Bataan, Philippines',
  contactEmail: 'contact@gfc-fellowship.org',
  contactPhone: '+63 917 123 4567',
  facebookUrl: 'https://facebook.com/GospelFellowshipChurchLimay'
};

/**
 * Tithes & offering history. The seed data is the real ledger migrated
 * from Desktop/gfc-ledger-app; see scripts/migrate-ledger.cjs.
 */
export const DEFAULT_TRANSACTIONS: LedgerTransaction[] = MIGRATED_LEDGER;

function getInitialData(): DatabaseSchema {
  const now = new Date().toISOString();

  const users: User[] = [
    {
      id: 'usr-1',
      name: 'Pastor Edrian Clavel',
      email: 'admin@gfc.org',
      role: 'Super Admin',
      phone: '+63 917 888 1234',
      ministry: 'Pastoral & Executive',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      status: 'active',
      lastLogin: now,
      createdAt: '2026-01-01T08:00:00Z',
    },
    {
      id: 'usr-2',
      name: 'Sister Mary Grace Santos',
      email: 'grace@gfc.org',
      role: 'Admin',
      phone: '+63 918 555 9876',
      ministry: 'Administration & Finance',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
      status: 'active',
      lastLogin: now,
      createdAt: '2026-01-15T09:30:00Z',
    },
    {
      id: 'usr-3',
      name: 'Brother Joshua Ramos',
      email: 'media@gfc.org',
      role: 'Media Team',
      phone: '+63 920 333 4455',
      ministry: 'Creative Media & Tech',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      status: 'active',
      lastLogin: now,
      createdAt: '2026-02-01T10:00:00Z',
    },
    {
      id: 'usr-4',
      name: 'Deacon Roberto Mendoza',
      email: 'pastor@gfc.org',
      role: 'Pastor',
      phone: '+63 919 777 2211',
      ministry: 'Pastoral Care & Outreach',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      status: 'active',
      lastLogin: now,
      createdAt: '2026-02-10T11:00:00Z',
    },
  ];

  const events: GFCEvent[] = [
    {
      id: 'evt-101',
      title: 'GFC Sunday Grand Worship & Communion',
      description: 'Join the entire Gospel Fellowship Church family for powerful worship, Holy Communion, and an inspiring message of hope from God’s Word.',
      category: 'Sunday Service',
      date: '2026-10-04',
      time: '09:00 AM - 11:30 AM',
      location: 'GFC Main Sanctuary & Fellowship Hall',
      bannerUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1200&q=80',
      capacity: 350,
      registeredCount: 142,
      checkInsCount: 88,
      status: 'published',
      qrCodeValue: 'GFC:EVENT:evt-101:SEC-90812',
      qrTicketSecret: 'SEC-90812',
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-25T10:00:00Z',
    },
    {
      id: 'evt-102',
      title: 'GFC Youth Ignite Summit 2026',
      description: 'A dedicated gathering for high school and university students featuring dynamic live worship, breakout sessions, games, and leadership workshops.',
      category: 'Youth Ministry',
      date: '2026-10-10',
      time: '01:00 PM - 06:00 PM',
      location: 'GFC Activity Center, 2nd Floor',
      bannerUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
      capacity: 180,
      registeredCount: 95,
      checkInsCount: 0,
      status: 'published',
      qrCodeValue: 'GFC:EVENT:evt-102:SEC-41723',
      qrTicketSecret: 'SEC-41723',
      createdAt: '2026-09-05T08:00:00Z',
      updatedAt: '2026-09-20T12:00:00Z',
    },
    {
      id: 'evt-103',
      title: 'Night of Praise & Intercessory Prayer',
      description: 'An evening set apart for heartfelt unhurried praise, intercession for our nation, healing prayers, and community fellowship.',
      category: 'Worship Night',
      date: '2026-10-16',
      time: '06:30 PM - 09:00 PM',
      location: 'GFC Worship Center',
      bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
      capacity: 250,
      registeredCount: 68,
      checkInsCount: 0,
      status: 'published',
      qrCodeValue: 'GFC:EVENT:evt-103:SEC-77391',
      qrTicketSecret: 'SEC-77391',
      createdAt: '2026-09-10T08:00:00Z',
      updatedAt: '2026-09-22T14:00:00Z',
    },
    {
      id: 'evt-104',
      title: 'GFC Barangay Limay Community Outreach & Feeding',
      description: 'Serving over 300 children and families with hot meals, school supplies, free medical check-ups, and the love of Christ.',
      category: 'Outreach & Missions',
      date: '2026-10-24',
      time: '08:00 AM - 01:00 PM',
      location: 'Barangay SF II Limay Covered Court',
      bannerUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
      capacity: 300,
      registeredCount: 110,
      checkInsCount: 0,
      status: 'published',
      qrCodeValue: 'GFC:EVENT:evt-104:SEC-52904',
      qrTicketSecret: 'SEC-52904',
      createdAt: '2026-09-12T08:00:00Z',
      updatedAt: '2026-09-24T16:00:00Z',
    },
    {
      id: 'evt-105',
      title: 'Discipleship Leadership Retreat & Planning',
      description: 'Quarterly strategic leadership alignment for cell leaders, ministry heads, and pastoral staff.',
      category: 'Special Event',
      date: '2026-11-07',
      time: '08:00 AM - 05:00 PM',
      location: 'Bataan Highland Retreat Camp',
      bannerUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
      capacity: 60,
      registeredCount: 22,
      checkInsCount: 0,
      status: 'draft',
      qrCodeValue: 'GFC:EVENT:evt-105:SEC-11849',
      qrTicketSecret: 'SEC-11849',
      createdAt: '2026-09-18T08:00:00Z',
      updatedAt: '2026-09-18T08:00:00Z',
    },
  ];

  const attendees: Attendee[] = [
    {
      id: 'att-1',
      eventId: 'evt-101',
      eventTitle: 'GFC Sunday Grand Worship & Communion',
      attendeeName: 'Manuel D. Cruz',
      attendeeEmail: 'manuel.cruz@gmail.com',
      attendeePhone: '+63 917 111 2222',
      ticketCode: 'GFC-EVT101-78912',
      qrData: JSON.stringify({
        type: 'gfc_event_ticket',
        eventId: 'evt-101',
        ticketCode: 'GFC-EVT101-78912',
        name: 'Manuel D. Cruz',
        secret: 'SEC-90812'
      }),
      status: 'checked_in',
      checkedInAt: '2026-09-27T08:45:00Z',
      registeredAt: '2026-09-20T10:00:00Z',
    },
    {
      id: 'att-2',
      eventId: 'evt-101',
      eventTitle: 'GFC Sunday Grand Worship & Communion',
      attendeeName: 'Clarissa Bautista',
      attendeeEmail: 'clarissa.b@yahoo.com',
      attendeePhone: '+63 920 444 8899',
      ticketCode: 'GFC-EVT101-44120',
      qrData: JSON.stringify({
        type: 'gfc_event_ticket',
        eventId: 'evt-101',
        ticketCode: 'GFC-EVT101-44120',
        name: 'Clarissa Bautista',
        secret: 'SEC-90812'
      }),
      status: 'checked_in',
      checkedInAt: '2026-09-27T08:52:10Z',
      registeredAt: '2026-09-21T11:20:00Z',
    },
    {
      id: 'att-3',
      eventId: 'evt-101',
      eventTitle: 'GFC Sunday Grand Worship & Communion',
      attendeeName: 'Rafael Santiago',
      attendeeEmail: 'rafael.santi@gmail.com',
      attendeePhone: '+63 918 333 5566',
      ticketCode: 'GFC-EVT101-99231',
      qrData: JSON.stringify({
        type: 'gfc_event_ticket',
        eventId: 'evt-101',
        ticketCode: 'GFC-EVT101-99231',
        name: 'Rafael Santiago',
        secret: 'SEC-90812'
      }),
      status: 'confirmed',
      checkedInAt: null,
      registeredAt: '2026-09-22T14:15:00Z',
    },
    {
      id: 'att-4',
      eventId: 'evt-102',
      eventTitle: 'GFC Youth Ignite Summit 2026',
      attendeeName: 'Bea Angela Torres',
      attendeeEmail: 'bea.torres@outlook.com',
      attendeePhone: '+63 995 888 7766',
      ticketCode: 'GFC-EVT102-12093',
      qrData: JSON.stringify({
        type: 'gfc_event_ticket',
        eventId: 'evt-102',
        ticketCode: 'GFC-EVT102-12093',
        name: 'Bea Angela Torres',
        secret: 'SEC-41723'
      }),
      status: 'confirmed',
      checkedInAt: null,
      registeredAt: '2026-09-23T15:30:00Z',
    },
    {
      id: 'att-5',
      eventId: 'evt-104',
      eventTitle: 'GFC Barangay Limay Community Outreach & Feeding',
      attendeeName: 'Leandro P. Castillo',
      attendeeEmail: 'leandro.castillo@apcas.edu.ph',
      attendeePhone: '+63 922 654 3210',
      ticketCode: 'GFC-EVT104-33819',
      qrData: JSON.stringify({
        type: 'gfc_event_ticket',
        eventId: 'evt-104',
        ticketCode: 'GFC-EVT104-33819',
        name: 'Leandro P. Castillo',
        secret: 'SEC-52904'
      }),
      status: 'confirmed',
      checkedInAt: null,
      registeredAt: '2026-09-24T09:00:00Z',
    }
  ];

  const albums: Album[] = [
    {
      id: 'alb-1',
      title: 'Sunday Worship Services 2026',
      description: 'Photos and memorable moments from our weekly Sunday family celebrations and worship services.',
      coverUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=800&q=80',
      photoCount: 4,
      eventId: 'evt-101',
      qrAlbumUrl: 'https://gfc.org/gallery/albums/alb-1',
      qrCodeValue: 'GFC:ALBUM:alb-1:Worship2026',
      createdAt: '2026-01-05T08:00:00Z',
    },
    {
      id: 'alb-2',
      title: 'GFC Youth Ministry & Camp',
      description: 'Vibrant youth fellowship, discipleship campfires, acoustic worship, and games.',
      coverUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
      photoCount: 3,
      eventId: 'evt-102',
      qrAlbumUrl: 'https://gfc.org/gallery/albums/alb-2',
      qrCodeValue: 'GFC:ALBUM:alb-2:YouthIgnite',
      createdAt: '2026-02-12T08:00:00Z',
    },
    {
      id: 'alb-3',
      title: 'Community Outreach & Missions',
      description: 'Reaching out to Limay and surrounding barangays through feeding, relief, and medical programs.',
      coverUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
      photoCount: 3,
      eventId: 'evt-104',
      qrAlbumUrl: 'https://gfc.org/gallery/albums/alb-3',
      qrCodeValue: 'GFC:ALBUM:alb-3:MissionsLimay',
      createdAt: '2026-03-01T08:00:00Z',
    },
    {
      id: 'alb-4',
      title: 'Water Baptism & New Believers',
      description: 'Celebrating public declarations of faith and new beginnings in Jesus Christ.',
      coverUrl: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
      photoCount: 2,
      eventId: null,
      qrAlbumUrl: 'https://gfc.org/gallery/albums/alb-4',
      qrCodeValue: 'GFC:ALBUM:alb-4:Baptism2026',
      createdAt: '2026-04-10T08:00:00Z',
    }
  ];

  const photos: Photo[] = [];

  const announcements: Announcement[] = [
    {
      id: 'ann-1',
      title: 'Sunday Worship Service Schedule Adjustment',
      content: 'Starting October 2026, our Sunday Morning Celebration begins promptly at 9:00 AM. Please arrive 15 minutes early for prayer and QR check-in.',
      category: 'Schedule',
      priority: 'important',
      author: 'Pastor Edrian Clavel',
      publishedAt: '2026-09-22T08:00:00Z',
      isActive: true,
    },
    {
      id: 'ann-2',
      title: 'Volunteer Call: Media Team & QR Entrance Greeters',
      content: 'We invite members passionate about photography, video livestream, sound, and QR welcome check-ins to attend our brief workshop this Saturday.',
      category: 'Ministry',
      priority: 'normal',
      author: 'Brother Joshua Ramos',
      publishedAt: '2026-09-24T10:00:00Z',
      isActive: true,
    },
    {
      id: 'ann-3',
      title: 'Community Relief Drive for Coastal Families',
      content: 'Accepting canned goods, bottled drinking water, and clean clothes for distribution at the upcoming Limay Outreach.',
      category: 'Urgent',
      priority: 'urgent',
      author: 'Sister Mary Grace Santos',
      publishedAt: '2026-09-26T09:30:00Z',
      isActive: true,
    }
  ];

  const activityLogs: ActivityLog[] = [
    {
      id: 'log-1',
      action: 'Create Event',
      entityType: 'event',
      entityId: 'evt-101',
      details: 'Created "GFC Sunday Grand Worship & Communion" and generated event QR code & ticket secrets.',
      performedBy: 'Pastor Edrian Clavel',
      role: 'Super Admin',
      timestamp: '2026-09-01T08:00:00Z',
    },
    {
      id: 'log-2',
      action: 'Upload Photo',
      entityType: 'photo',
      entityId: 'pho-1',
      details: 'Uploaded photo "Worship Team in Spirit and in Truth" to album "Sunday Worship Services 2026".',
      performedBy: 'Brother Joshua Ramos',
      role: 'Media Team',
      timestamp: '2026-09-20T11:00:00Z',
    },
    {
      id: 'log-3',
      action: 'QR Check-in Scanned',
      entityType: 'qr_checkin',
      entityId: 'att-1',
      details: 'Validated QR Ticket for attendee Manuel D. Cruz at entrance scanner.',
      performedBy: 'Sister Mary Grace Santos',
      role: 'Admin',
      timestamp: '2026-09-27T08:45:00Z',
    },
    {
      id: 'log-4',
      action: 'QR Check-in Scanned',
      entityType: 'qr_checkin',
      entityId: 'att-2',
      details: 'Validated QR Ticket for attendee Clarissa Bautista at entrance scanner.',
      performedBy: 'Sister Mary Grace Santos',
      role: 'Admin',
      timestamp: '2026-09-27T08:52:10Z',
    },
  ];

  return {
    users,
    events,
    attendees,
    photos,
    albums,
    announcements,
    activityLogs,
    settings: DEFAULT_SETTINGS,
    eventDateAlbums: {
      'SUNDAY SERVICE': ['June 14, 2026', 'August 18, 2026', 'September 20, 2026', 'October 04, 2026'],
      'YOUTH FELLOWSHIP': ['June 20, 2026', 'July 15, 2026', 'August 28, 2026', 'October 10, 2026'],
      'MIDWEEK SERVICE': ['June 17, 2026', 'July 22, 2026', 'August 19, 2026'],
      'COMMUNITY OUTREACH': ['August 15, 2026', 'October 24, 2026'],
      'SPECIAL EVENT': ['November 07, 2026'],
    },
    websiteContent: DEFAULT_WEBSITE_CONTENT,
    transactions: DEFAULT_TRANSACTIONS,
  };
}

class GFCDBManager {
  private db: DatabaseSchema;
  private dbMode: 'turso' | 'json' = 'json';
  /** Notified after each write; see onChange(). */
  private changeListeners = new Set<() => void>();

  constructor() {
    this.db = this.loadDatabase();
  }

  private loadDatabase(): DatabaseSchema {
    // Synchronous seed only. The real data load happens in init(), which must
    // be awaited before the server accepts requests.
    return this.normalize(getInitialData(), true);
  }

  /**
   * @param quiet Suppresses the seeding log. The constructor builds a
   *   throwaway default schema before the real data is loaded, and reporting
   *   keys "seeded" there is misleading - it is never persisted.
   */
  private normalize(parsed: any, quiet = false): DatabaseSchema {
    if (parsed && Array.isArray(parsed.events) && Array.isArray(parsed.photos)) {
      if (!parsed.websiteContent) parsed.websiteContent = DEFAULT_WEBSITE_CONTENT;
      if (!Array.isArray(parsed.transactions)) parsed.transactions = DEFAULT_TRANSACTIONS;
      if (!Array.isArray(parsed.siteEvents)) parsed.siteEvents = DEFAULT_SITE_EVENTS;
      for (const key of SITE_COLLECTIONS) {
        if (!Array.isArray(parsed[key])) parsed[key] = [];
      }
      // The leader roster is seeded rather than left empty, so the website
      // reads it from the database instead of a hardcoded list.
      if (parsed.pastors!.length === 0) parsed.pastors = SEED_PASTORS as any[];

      // Every piece of website copy lives in siteSettings so it can be edited
      // from the admin. Missing keys are added with their shipped default;
      // values already in the database are never overwritten.
      const settings = parsed.siteSettings as any[];
      const have = new Set(settings.map(s => s.key));
      let added = 0;
      for (const [key, value] of Object.entries(SITE_COPY_DEFAULTS)) {
        if (have.has(key)) continue;
        settings.push({ id: `set-${key}`, key, value });
        added++;
      }
      if (added > 0 && !quiet) {
        console.log(`[GFC DB] Seeded ${added} new website copy keys`);
      }

      return parsed as DatabaseSchema;
    }
    return getInitialData();
  }

  /**
   * Load persisted data. Must be awaited before the server starts listening.
   * Falls back to the built-in seed when the store is empty.
   */
  public async init(): Promise<void> {
    this.dbMode = await storageMode();
    const loaded = await storageLoad();

    if (loaded) {
      this.db = this.normalize(loaded);
      console.log('[GFC DB] Data loaded');
    } else {
      this.db = this.loadDatabase();
      await storageSave(this.db);
      console.log('[GFC DB] Empty store - seeded with initial data');
    }

    console.log(`[GFC DB] Storage: ${this.dbMode === 'turso' ? 'Turso/libsql' : `JSON file (${DB_FILE})`}`);
  }

  private saveToDisk(data: DatabaseSchema): void {
    void storageSave(data);
  }

  private persist(): void {
    this.saveToDisk(this.db);
    this.notifyChange();
  }

  /**
   * Subscribers are notified after every write so the public site can refresh
   * immediately instead of waiting for its next poll. Returns an unsubscribe.
   */
  public onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => { this.changeListeners.delete(listener); };
  }

  private notifyChange(): void {
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch { /* a broken listener must not block the write */ }
    }
  }

  public resetDatabase(): DatabaseSchema {
    this.db = getInitialData();
    this.persist();
    return this.db;
  }

  public logActivity(action: string, entityType: ActivityLog['entityType'], entityId: string, details: string, performedBy = 'Admin User', role = 'Admin'): void {
    const log: ActivityLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      action,
      entityType,
      entityId,
      details,
      performedBy,
      role,
      timestamp: new Date().toISOString(),
    };
    this.db.activityLogs.unshift(log);
    // Keep last 150 logs
    if (this.db.activityLogs.length > 150) {
      this.db.activityLogs = this.db.activityLogs.slice(0, 150);
    }
    this.persist();
  }

  /* --- STATS --- */
  public getStats(): DashboardStats {
    const nowStr = new Date().toISOString().split('T')[0];
    const upcomingEvents = this.db.events.filter(e => e.date >= nowStr && e.status === 'published').length;
    const publishedEvents = this.db.events.filter(e => e.status === 'published').length;
    const featuredPhotos = this.db.photos.filter(p => p.isFeatured).length;
    const totalAttendees = this.db.attendees.length;
    const totalCheckIns = this.db.attendees.filter(a => a.status === 'checked_in').length;
    const txList = this.db.transactions || [];
    const totals = this.computeTotals(txList);

    return {
      totalEvents: this.db.events.length,
      upcomingEvents,
      publishedEvents,
      totalPhotos: this.db.photos.length,
      featuredPhotos,
      totalAttendees,
      totalCheckIns,
      totalMembers: this.db.members?.length ?? 0,
      totalLeaders: this.db.pastors?.length ?? 0,
      totalAdminAccounts: this.db.users.length,
      totalLedgerBalance: totals.balance,
      totalLedgerIn: totals.totalIn,
      totalLedgerOut: totals.totalOut,
    };
  }

  /* --- USERS --- */
  public getUsers(): User[] {
    return this.db.users;
  }

  public getUserById(id: string): User | undefined {
    return this.db.users.find(u => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    return this.db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(userData: Omit<User, 'id' | 'createdAt'>): User {
    const newUser: User = {
      ...userData,
      id: 'usr-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    this.db.users.push(newUser);
    this.logActivity('Create User', 'user', newUser.id, `Created user account for ${newUser.name} (${newUser.role})`);
    this.persist();
    return newUser;
  }

  public updateUser(id: string, updates: Partial<User>): User | null {
    const idx = this.db.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    this.db.users[idx] = { ...this.db.users[idx], ...updates };
    this.logActivity('Update User', 'user', id, `Updated account profile for ${this.db.users[idx].name}`);
    this.persist();
    return this.db.users[idx];
  }

  public deleteUser(id: string): boolean {
    const user = this.getUserById(id);
    if (!user) return false;
    this.db.users = this.db.users.filter(u => u.id !== id);
    this.logActivity('Delete User', 'user', id, `Deleted user account ${user.name}`);
    this.persist();
    return true;
  }

  /* --- CHURCH PEOPLE: attendees -> members -> leaders --- */

  public getMembers(): any[] { return this.db.members ?? []; }

  /**
   * The church's leader roster. This is `pastors` - the very same list the
   * public website renders - so the admin and the site never disagree.
   */
  public getPastors(): any[] { return this.db.pastors ?? []; }

  /**
   * Move an attendee into the member roster. Idempotent: if someone matching
   * the attendee already exists as a member, the existing record is returned
   * instead of creating a duplicate.
   */
  public promoteAttendeeToMember(attendeeId: string): any {
    const attendee = this.getAttendees().find(a => a.id === attendeeId);
    if (!attendee) throw new Error('Attendee not found');

    const name = attendee.attendeeName;
    const existing = this.getMembers().find(m => m.name?.toLowerCase() === name?.toLowerCase());
    if (existing) return existing;

    const member = {
      id: 'mem-' + Date.now(),
      name,
      email: attendee.attendeeEmail ?? '',
      phone: attendee.attendeePhone ?? '',
      joinedAt: new Date().toISOString(),
      status: 'active',
      source: `attendee:${attendeeId}`,
      note: '',
    };
    this.db.members = [...(this.db.members ?? []), member];
    this.logActivity('Promote to Member', 'member', member.id, `Moved ${name} from attendees to members`);
    this.persist();
    return member;
  }

  /** Move a member into the leader roster. */
  public promoteMemberToLeader(memberId: string): any {
    const member = this.getMembers().find(m => m.id === memberId);
    if (!member) throw new Error('Member not found');

    const name = member.name;
    // One roster only: `pastors` is the same list the public website renders,
    // so a promotion shows up on the site without a second copy to maintain.
    const existing = this.getPastors().find(l => l.name?.toLowerCase() === name?.toLowerCase());
    if (existing) return existing;

    const leader = {
      id: 'ldr-' + Date.now(),
      name,
      role: member.role || 'Leader',
      facebook: member.facebook ?? '',
      image: member.image ?? '',
    };
    this.db.pastors = [...(this.db.pastors ?? []), leader];
    this.logActivity('Promote to Leader', 'leader', leader.id, `Moved ${name} from members to leaders`);
    this.persist();
    return leader;
  }

  /* --- EVENTS --- */
  public getEvents(options?: { status?: string; search?: string }): GFCEvent[] {
    let result = [...this.db.events];
    if (options?.status && options.status !== 'all') {
      result = result.filter(e => e.status === options.status);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      result = result.filter(e => 
        e.title.toLowerCase().includes(q) || 
        e.description.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    }
    // Sort descending by date
    return result.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  public getEventById(id: string): GFCEvent | undefined {
    return this.db.events.find(e => e.id === id);
  }

  public createEvent(data: Partial<GFCEvent>): GFCEvent {
    const eventId = 'evt-' + Date.now();
    const qrSecret = 'SEC-' + Math.floor(10000 + Math.random() * 90000);
    const newEvent: GFCEvent = {
      id: eventId,
      title: data.title || 'Untitled GFC Event',
      description: data.description || '',
      category: data.category || 'Sunday Service',
      date: data.date || new Date().toISOString().split('T')[0],
      time: data.time || '09:00 AM - 11:30 AM',
      location: data.location || 'GFC Main Sanctuary',
      bannerUrl: data.bannerUrl || 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1200&q=80',
      capacity: Number(data.capacity) || 250,
      registeredCount: 0,
      checkInsCount: 0,
      status: data.status || 'published',
      qrCodeValue: `GFC:EVENT:${eventId}:${qrSecret}`,
      qrTicketSecret: qrSecret,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.db.events.unshift(newEvent);
    this.logActivity('Create Event', 'event', newEvent.id, `Created event "${newEvent.title}" with QR verification secret`);
    this.persist();
    return newEvent;
  }

  public updateEvent(id: string, updates: Partial<GFCEvent>): GFCEvent | null {
    const idx = this.db.events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    
    // Preserve existing QR code value and secret if not explicitly provided
    const existing = this.db.events[idx];
    this.db.events[idx] = {
      ...existing,
      ...updates,
      qrCodeValue: updates.qrCodeValue || existing.qrCodeValue,
      qrTicketSecret: updates.qrTicketSecret || existing.qrTicketSecret,
      updatedAt: new Date().toISOString(),
    };

    this.logActivity('Update Event', 'event', id, `Updated details for event "${this.db.events[idx].title}"`);
    this.persist();
    return this.db.events[idx];
  }

  public deleteEvent(id: string): boolean {
    const event = this.getEventById(id);
    if (!event) return false;

    this.db.events = this.db.events.filter(e => e.id !== id);
    // Delete associated attendees
    this.db.attendees = this.db.attendees.filter(a => a.eventId !== id);
    this.logActivity('Delete Event', 'event', id, `Deleted event "${event.title}" and its registered attendees`);
    this.persist();
    return true;
  }

  /* --- ATTENDEES & QR CHECK-IN --- */
  public getAttendees(eventId?: string): Attendee[] {
    if (eventId) {
      return this.db.attendees.filter(a => a.eventId === eventId);
    }
    return this.db.attendees;
  }

  public registerAttendee(eventId: string, attendeeName: string, attendeeEmail: string, attendeePhone?: string): Attendee | null {
    const event = this.getEventById(eventId);
    if (!event) return null;

    const ticketCode = `GFC-${event.id.toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const qrData = JSON.stringify({
      type: 'gfc_event_ticket',
      eventId: event.id,
      ticketCode,
      name: attendeeName,
      secret: event.qrTicketSecret,
    });

    const newAttendee: Attendee = {
      id: 'att-' + Date.now(),
      eventId: event.id,
      eventTitle: event.title,
      attendeeName,
      attendeeEmail,
      attendeePhone: attendeePhone || '',
      ticketCode,
      qrData,
      status: 'confirmed',
      checkedInAt: null,
      registeredAt: new Date().toISOString(),
    };

    this.db.attendees.unshift(newAttendee);
    event.registeredCount = (event.registeredCount || 0) + 1;
    this.logActivity('Register Attendee', 'event', event.id, `Issued QR Ticket ${ticketCode} for ${attendeeName} (${event.title})`);
    this.persist();
    return newAttendee;
  }

  /**
   * Scans and verifies a QR code payload.
   * Supports:
   * 1) Standard JSON ticket string: {"type":"gfc_event_ticket","eventId":"...","ticketCode":"...","secret":"..."}
   * 2) Ticket code string: "GFC-EVT101-78912"
   * 3) Event check-in code string: "GFC:EVENT:evt-101:SEC-90812"
   */
  public verifyAndCheckInQR(scannedPayload: string, targetEventId?: string): QRVerifyResult {
    const trimmed = scannedPayload.trim();

    // Check case 1: JSON payload
    try {
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const data = JSON.parse(trimmed);
        if (data.type === 'gfc_event_ticket' || data.ticketCode) {
          const attendee = this.db.attendees.find(a => a.ticketCode === data.ticketCode);
          if (!attendee) {
            return {
              valid: false,
              status: 'invalid_ticket',
              message: `Ticket code "${data.ticketCode}" was not found in the database.`,
            };
          }

          const event = this.getEventById(attendee.eventId);
          if (targetEventId && attendee.eventId !== targetEventId) {
            return {
              valid: false,
              status: 'event_mismatch',
              message: `This ticket is registered for "${event?.title || attendee.eventId}", not the currently selected event.`,
              attendee,
              event,
            };
          }

          if (attendee.status === 'checked_in') {
            return {
              valid: false,
              status: 'already_checked_in',
              message: `Attendee "${attendee.attendeeName}" was already checked in at ${attendee.checkedInAt ? new Date(attendee.checkedInAt).toLocaleTimeString() : 'an earlier time'}.`,
              attendee,
              event,
              checkedInAt: attendee.checkedInAt || undefined,
            };
          }

          // Check in!
          const nowStr = new Date().toISOString();
          attendee.status = 'checked_in';
          attendee.checkedInAt = nowStr;
          if (event) {
            event.checkInsCount = (event.checkInsCount || 0) + 1;
          }

          this.logActivity('QR Check-in Scanned', 'qr_checkin', attendee.id, `Checked in ${attendee.attendeeName} (Ticket: ${attendee.ticketCode}) for "${event?.title}"`);
          this.persist();

          return {
            valid: true,
            status: 'success',
            message: `Successfully verified and checked in: ${attendee.attendeeName}!`,
            attendee,
            event,
            checkedInAt: nowStr,
          };
        }
      }
    } catch {
      // not JSON, continue to fallback checks
    }

    // Check case 2: Scanned direct ticket code e.g. GFC-EVT101-78912
    const attendeeByCode = this.db.attendees.find(a => 
      a.ticketCode.toUpperCase() === trimmed.toUpperCase() ||
      trimmed.toUpperCase().includes(a.ticketCode.toUpperCase())
    );

    if (attendeeByCode) {
      const event = this.getEventById(attendeeByCode.eventId);
      if (targetEventId && attendeeByCode.eventId !== targetEventId) {
        return {
          valid: false,
          status: 'event_mismatch',
          message: `Ticket is for "${event?.title || attendeeByCode.eventId}", not the selected event.`,
          attendee: attendeeByCode,
          event,
        };
      }

      if (attendeeByCode.status === 'checked_in') {
        return {
          valid: false,
          status: 'already_checked_in',
          message: `Attendee "${attendeeByCode.attendeeName}" was already checked in.`,
          attendee: attendeeByCode,
          event,
          checkedInAt: attendeeByCode.checkedInAt || undefined,
        };
      }

      const nowStr = new Date().toISOString();
      attendeeByCode.status = 'checked_in';
      attendeeByCode.checkedInAt = nowStr;
      if (event) {
        event.checkInsCount = (event.checkInsCount || 0) + 1;
      }

      this.logActivity('QR Check-in Scanned', 'qr_checkin', attendeeByCode.id, `Checked in ${attendeeByCode.attendeeName} (${attendeeByCode.ticketCode})`);
      this.persist();

      return {
        valid: true,
        status: 'success',
        message: `Verified and checked in: ${attendeeByCode.attendeeName}!`,
        attendee: attendeeByCode,
        event,
        checkedInAt: nowStr,
      };
    }

    // Check case 3: Scanned master event QR code e.g. GFC:EVENT:evt-101:SEC-90812
    if (trimmed.startsWith('GFC:EVENT:')) {
      const parts = trimmed.split(':');
      const eventId = parts[2];
      const secret = parts[3];
      const event = this.getEventById(eventId);
      if (event && (!secret || event.qrTicketSecret === secret)) {
        return {
          valid: true,
          status: 'success',
          message: `Valid GFC Event QR Code: "${event.title}" (${event.date}).`,
          event,
        };
      }
    }

    return {
      valid: false,
      status: 'invalid_ticket',
      message: 'Scanned QR Code was not recognized as a valid GFC ticket or event code.',
    };
  }

  /* --- PHOTOS & ALL PHOTOS --- */
  public getPhotos(options?: { albumId?: string; eventId?: string; search?: string; featured?: boolean }): Photo[] {
    let result = [...this.db.photos];
    if (options?.albumId && options.albumId !== 'all') {
      result = result.filter(p => p.albumId === options.albumId);
    }
    if (options?.eventId && options.eventId !== 'all') {
      result = result.filter(p => p.eventId === options.eventId);
    }
    if (options?.featured !== undefined) {
      result = result.filter(p => p.isFeatured === options.featured);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)) ||
        p.uploaderName.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  public getPhotoById(id: string): Photo | undefined {
    return this.db.photos.find(p => p.id === id);
  }

  public createPhoto(data: Partial<Photo>): Photo {
    const photoId = 'pho-' + Date.now();
    const qrShareUrl = data.qrShareUrl || `https://gfc.org/photos/${photoId}`;
    const qrCodeValue = data.qrCodeValue || `GFC:PHOTO:${photoId}:${(data.title || 'ChurchPhoto').replace(/\s+/g, '')}`;

    let albumName = data.albumName || 'General Fellowship';
    if (data.albumId) {
      const alb = this.getAlbumById(data.albumId);
      if (alb) {
        albumName = alb.title;
        alb.photoCount = (alb.photoCount || 0) + 1;
      }
    }

    let eventTitle = data.eventTitle || null;
    if (!eventTitle && data.eventId) {
      const evt = this.getEventById(data.eventId);
      if (evt) eventTitle = evt.title;
    }

    const newPhoto: Photo = {
      id: photoId,
      title: data.title || 'Untitled GFC Photo',
      description: data.description || '',
      category: data.category || 'Sunday Worship',
      albumId: data.albumId || 'alb-1',
      albumName,
      eventId: data.eventId || null,
      eventTitle,
      imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1200&q=80',
      uploaderName: data.uploaderName || 'Admin User',
      uploaderRole: data.uploaderRole || 'Admin',
      qrShareUrl,
      qrCodeValue,
      viewsCount: 0,
      downloadsCount: 0,
      isFeatured: !!data.isFeatured,
      tags: Array.isArray(data.tags) ? data.tags : ['gfc', 'fellowship'],
      takenAt: data.takenAt || new Date().toISOString().split('T')[0],
      albumDate: data.albumDate,
      createdAt: new Date().toISOString(),
    };

    this.db.photos.unshift(newPhoto);
    this.logActivity('Upload Photo', 'photo', newPhoto.id, `Uploaded photo "${newPhoto.title}" to album "${albumName}" with QR Share code`);
    this.persist();
    return newPhoto;
  }

  public updatePhoto(id: string, updates: Partial<Photo>): Photo | null {
    const idx = this.db.photos.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const existing = this.db.photos[idx];
    
    // If album changed, adjust counts
    if (updates.albumId && updates.albumId !== existing.albumId) {
      const oldAlb = this.getAlbumById(existing.albumId);
      if (oldAlb && oldAlb.photoCount > 0) oldAlb.photoCount--;
      const newAlb = this.getAlbumById(updates.albumId);
      if (newAlb) {
        newAlb.photoCount = (newAlb.photoCount || 0) + 1;
        updates.albumName = newAlb.title;
      }
    }

    if (updates.eventId && updates.eventId !== existing.eventId) {
      const evt = this.getEventById(updates.eventId);
      updates.eventTitle = evt ? evt.title : null;
    }

    this.db.photos[idx] = {
      ...existing,
      ...updates,
      // preserve QR code values
      qrShareUrl: updates.qrShareUrl || existing.qrShareUrl,
      qrCodeValue: updates.qrCodeValue || existing.qrCodeValue,
    };

    this.logActivity('Update Photo', 'photo', id, `Updated photo metadata for "${this.db.photos[idx].title}"`);
    this.persist();
    return this.db.photos[idx];
  }

  public deletePhoto(id: string): boolean {
    const photo = this.getPhotoById(id);
    if (!photo) return false;

    const alb = this.getAlbumById(photo.albumId);
    if (alb && alb.photoCount > 0) {
      alb.photoCount--;
    }

    this.db.photos = this.db.photos.filter(p => p.id !== id);
    this.logActivity('Delete Photo', 'photo', id, `Deleted photo "${photo.title}"`);
    this.persist();
    return true;
  }

  /* --- ALBUMS --- */
  public getAlbums(): Album[] {
    return this.db.albums;
  }

  public getAlbumById(id: string): Album | undefined {
    return this.db.albums.find(a => a.id === id);
  }

  public createAlbum(data: Partial<Album>): Album {
    const albumId = 'alb-' + Date.now();
    const newAlbum: Album = {
      id: albumId,
      title: data.title || 'New Album',
      description: data.description || '',
      coverUrl: data.coverUrl || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
      photoCount: 0,
      eventId: data.eventId || null,
      qrAlbumUrl: `https://gfc.org/gallery/albums/${albumId}`,
      qrCodeValue: `GFC:ALBUM:${albumId}:${(data.title || 'Album').replace(/\s+/g, '')}`,
      createdAt: new Date().toISOString(),
    };
    this.db.albums.push(newAlbum);
    this.logActivity('Create Album', 'photo', newAlbum.id, `Created album "${newAlbum.title}" with QR album link`);
    this.persist();
    return newAlbum;
  }

  public deleteAlbum(id: string): boolean {
    const alb = this.getAlbumById(id);
    if (!alb) return false;
    this.db.albums = this.db.albums.filter(a => a.id !== id);
    this.logActivity('Delete Album', 'photo', id, `Deleted album "${alb.title}"`);
    this.persist();
    return true;
  }

  /* --- ANNOUNCEMENTS --- */
  public getAnnouncements(activeOnly = false): Announcement[] {
    let list = [...this.db.announcements];
    if (activeOnly) {
      list = list.filter(a => a.isActive);
    }
    return list.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }

  public createAnnouncement(data: Partial<Announcement>): Announcement {
    const newAnn: Announcement = {
      id: 'ann-' + Date.now(),
      title: data.title || 'Announcement',
      content: data.content || '',
      category: data.category || 'General',
      priority: data.priority || 'normal',
      author: data.author || 'GFC Leadership',
      publishedAt: new Date().toISOString(),
      isActive: data.isActive !== undefined ? data.isActive : true,
    };
    this.db.announcements.unshift(newAnn);
    this.logActivity('Create Announcement', 'announcement', newAnn.id, `Published announcement "${newAnn.title}"`);
    this.persist();
    return newAnn;
  }

  public updateAnnouncement(id: string, updates: Partial<Announcement>): Announcement | null {
    const idx = this.db.announcements.findIndex(a => a.id === id);
    if (idx === -1) return null;
    this.db.announcements[idx] = { ...this.db.announcements[idx], ...updates };
    this.logActivity('Update Announcement', 'announcement', id, `Updated announcement "${this.db.announcements[idx].title}"`);
    this.persist();
    return this.db.announcements[idx];
  }

  public deleteAnnouncement(id: string): boolean {
    const ann = this.db.announcements.find(a => a.id === id);
    if (!ann) return false;
    this.db.announcements = this.db.announcements.filter(a => a.id !== id);
    this.logActivity('Delete Announcement', 'announcement', id, `Removed announcement "${ann.title}"`);
    this.persist();
    return true;
  }

  /* --- ACTIVITY LOGS --- */
  public getActivityLogs(limit = 100): ActivityLog[] {
    return this.db.activityLogs.slice(0, limit);
  }

  /* --- SETTINGS --- */
  public getSettings(): ChurchSettings {
    return this.db.settings;
  }

  /** Raw schema access, used by the website compatibility layer. */
  public getRaw(): DatabaseSchema {
    return this.db;
  }

  public getSiteCollection(key: string): any[] {
    const list = (this.db as any)[key];
    return Array.isArray(list) ? list : [];
  }

  /** The website's public event grid, in render order. */
  public getSiteEvents(): SiteEvent[] {
    if (!Array.isArray(this.db.siteEvents)) this.db.siteEvents = DEFAULT_SITE_EVENTS;
    return this.db.siteEvents;
  }

  public setSiteCollection(key: string, value: any[]): any[] {
    (this.db as any)[key] = Array.isArray(value) ? value : [];
    this.persist();
    return (this.db as any)[key];
  }

  /**
   * Upsert one website copy value without touching the rest of the settings.
   */
  public setSiteSettingValue(key: string, value: string): any {
    const settings = this.db.siteSettings as any[];
    const existing = settings.find(s => s.key === key);
    if (existing) {
      existing.value = value;
    } else {
      settings.push({ id: `set-${key}`, key, value });
    }
    this.persist();
    return { key, value };
  }

  public createSiteRecord(key: string, record: any): any {
    const list = this.getSiteCollection(key);
    const id = record?.id || `${key.slice(0, 3)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const created = { ...record, id };
    list.push(created);
    this.setSiteCollection(key, list);
    return created;
  }

  public updateSiteRecord(key: string, id: string, patch: any): any | null {
    const list = this.getSiteCollection(key);
    const idx = list.findIndex((r: any) => r && r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch, id };
    this.setSiteCollection(key, list);
    return list[idx];
  }

  public deleteSiteRecord(key: string, id: string): boolean {
    const list = this.getSiteCollection(key);
    const next = list.filter((r: any) => !(r && r.id === id));
    if (next.length === list.length) return false;
    this.setSiteCollection(key, next);
    return true;
  }

  public updateSettings(updates: Partial<ChurchSettings>): ChurchSettings {
    this.db.settings = { ...this.db.settings, ...updates };
    this.logActivity('Update Settings', 'settings', 'config', 'Updated church administration settings');
    this.persist();
    return this.db.settings;
  }

  /* --- EVENT DATE ALBUMS --- */
  public getDateAlbums(): Record<string, string[]> {
    if (!this.db.eventDateAlbums) {
      this.db.eventDateAlbums = {
        'SUNDAY SERVICE': ['June 14, 2026', 'August 18, 2026', 'September 20, 2026', 'October 04, 2026'],
        'YOUTH FELLOWSHIP': ['June 20, 2026', 'July 15, 2026', 'August 28, 2026', 'October 10, 2026'],
        'MIDWEEK SERVICE': ['June 17, 2026', 'July 22, 2026', 'August 19, 2026'],
        'COMMUNITY OUTREACH': ['August 15, 2026', 'October 24, 2026'],
        'SPECIAL EVENT': ['November 07, 2026'],
      };
      this.persist();
    }
    return this.db.eventDateAlbums;
  }

  /**
   * Date-album keys must match the website event titles exactly. Historically
   * these were stored uppercased ("SUNDAY SERVICE") while the events are Title
   * Case ("Sunday Service"), which made saved dates invisible in the UI.
   * Resolve to the canonical site event title when one exists, and fall back to
   * a normalized lookup so legacy keys keep working.
   */
  private resolveDateAlbumKey(
    albums: Record<string, string[]>,
    eventName: string,
  ): { key: string; legacyKeys: string[] } {
    const normalize = (value: string): string =>
      String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

    const siteTitles = (this.db.siteEvents || []).map((e) => e.title);
    const wanted = normalize(eventName);

    // Prefer the exact website event title (canonical form).
    const canonical = siteTitles.find((t) => t === eventName);
    if (canonical) return { key: canonical, legacyKeys: [] };

    // Otherwise match a site event ignoring case/whitespace.
    const loose = siteTitles.find((t) => normalize(t) === wanted);
    if (loose) return { key: loose, legacyKeys: [] };

    // No matching website event: keep the caller's casing and absorb any
    // differently-cased duplicates that already exist.
    const legacyKeys = Object.keys(albums).filter((k) => normalize(k) === wanted);
    return { key: eventName.trim(), legacyKeys };
  }

  /** Merge any legacy-cased keys into the canonical key. */
  private mergeLegacyDateAlbumKeys(
    albums: Record<string, string[]>,
    key: string,
    legacyKeys: string[],
  ): void {
    for (const legacy of legacyKeys) {
      if (legacy === key) continue;
      albums[key] = Array.from(new Set([...(albums[key] || []), ...(albums[legacy] || [])]));
      delete albums[legacy];
    }
  }

  public addDateAlbum(eventName: string, date: string): Record<string, string[]> {
    const albums = this.getDateAlbums();
    const { key, legacyKeys } = this.resolveDateAlbumKey(albums, eventName);
    this.mergeLegacyDateAlbumKeys(albums, key, legacyKeys);
    if (!albums[key]) {
      albums[key] = [];
    }
    if (!albums[key].includes(date)) {
      albums[key].unshift(date);
      this.logActivity('Create Date Album', 'event', key, `Added date album "${date}" to event "${key}"`);
      this.persist();
    }
    return albums;
  }

  public deleteDateAlbum(eventName: string, date: string): Record<string, string[]> {
    const albums = this.getDateAlbums();
    const { key, legacyKeys } = this.resolveDateAlbumKey(albums, eventName);
    this.mergeLegacyDateAlbumKeys(albums, key, legacyKeys);
    if (albums[key]) {
      albums[key] = albums[key].filter((d) => d !== date);
      this.logActivity('Delete Date Album', 'event', key, `Deleted date album "${date}" from event "${key}"`);
      this.persist();
    }
    // A cover with no album left would never be shown again, so drop it.
    this.clearAlbumCover(key, date);
    return albums;
  }

  /* --- CHURCH ANNIVERSARY: YEAR + EVENT ALBUMS --- */

  public getAlbumYears(): Record<string, string[]> {
    if (!this.db.albumYears) this.db.albumYears = {};
    return this.db.albumYears;
  }

  /** Remember a year that can later be paired with an event name. */
  public addAlbumYear(eventName: string, year: string): Record<string, string[]> {
    const years = this.getAlbumYears();
    const { key, legacyKeys } = this.resolveDateAlbumKey(this.getDateAlbums(), eventName);
    const normalized = year.trim();
    if (!normalized) return years;

    for (const legacy of legacyKeys) {
      if (Array.isArray(years[legacy])) years[key].concat(years[legacy]);
      delete years[legacy];
    }

    if (!years[key]) years[key] = [];
    if (!years[key].includes(normalized)) {
      years[key].push(normalized);
      this.logActivity('Create Year Album', 'event', key, `Added year album "${normalized}" to event "${key}"`);
      this.persist();
    }
    return years;
  }

  public getAlbumPairs(): Record<string, import('../src/types/index.ts').AlbumPair[]> {
    if (!this.db.albumPairs) this.db.albumPairs = {};
    return this.db.albumPairs;
  }

  /**
   * Join a year and an event name into one album. Pairing only adds the year to
   * that album: the photos, the album label and the cover are untouched, so this
   * can never duplicate or drop a photo.
   */
  public setAlbumPair(eventName: string, year: string, event: string): Record<string, import('../src/types/index.ts').AlbumPair[]> {
    const pairs = this.getAlbumPairs();
    const { key, legacyKeys } = this.resolveDateAlbumKey(this.getDateAlbums(), eventName);
    const normalizedYear = year.trim();
    const normalizedEvent = event.trim();
    if (!normalizedYear || !normalizedEvent) return pairs;

    for (const legacy of legacyKeys) {
      if (Array.isArray(pairs[legacy])) pairs[key] = (pairs[key] || []).concat(pairs[legacy]);
      delete pairs[legacy];
    }

    if (!pairs[key]) pairs[key] = [];
    const index = pairs[key].findIndex(
      (p) => p.year.toLowerCase() === normalizedYear.toLowerCase()
        && p.event.toLowerCase() === normalizedEvent.toLowerCase(),
    );

    if (index === -1) {
      pairs[key].push({ year: normalizedYear, event: normalizedEvent });
      this.logActivity('Create Event Album', 'event', key, `Paired "${normalizedYear}" with "${normalizedEvent}" on event "${key}"`);
    } else {
      pairs[key][index] = { year: normalizedYear, event: normalizedEvent };
    }

    this.persist();
    return pairs;
  }

  /**
   * Remove only the Year + Event link. The album, its photos and its cover stay,
   * so unpairing is always reversible.
   */
  public deleteAlbumPair(eventName: string, year: string, event: string): Record<string, import('../src/types/index.ts').AlbumPair[]> {
    const pairs = this.getAlbumPairs();
    const { key, legacyKeys } = this.resolveDateAlbumKey(this.getDateAlbums(), eventName);
    const keys = [key, ...legacyKeys];
    let changed = false;

    for (const k of keys) {
      if (!Array.isArray(pairs[k])) continue;
      const before = pairs[k].length;
      pairs[k] = pairs[k].filter(
        (p) => !(p.year.toLowerCase() === year.trim().toLowerCase()
          && p.event.toLowerCase() === event.trim().toLowerCase()),
      );
      if (pairs[k].length !== before) changed = true;
    }

    if (changed) {
      this.logActivity('Delete Event Album', 'event', key, `Unpaired "${year}" from "${event}" on event "${key}"`);
      this.persist();
    }
    return pairs;
  }

  /* --- ALBUM COVERS --- */
  public getAlbumCovers(): Record<string, Record<string, string>> {
    if (!this.db.albumCovers) this.db.albumCovers = {};
    return this.db.albumCovers;
  }

  /** Cover for one album, or an empty string when none was chosen yet. */
  public getAlbumCover(eventName: string, album: string): string {
    const covers = this.getAlbumCovers();
    const { key } = this.resolveDateAlbumKey(this.getDateAlbums(), eventName);
    return covers[key]?.[album] || '';
  }

  /**
   * Store the cover of one album. Passing an empty url clears it, which keeps
   * the map from growing stale entries nobody can reach.
   */
  public setAlbumCover(eventName: string, album: string, coverUrl: string): Record<string, Record<string, string>> {
    const covers = this.getAlbumCovers();
    const { key } = this.resolveDateAlbumKey(this.getDateAlbums(), eventName);
    if (!key || !album) return covers;

    if (!coverUrl) {
      this.clearAlbumCover(key, album);
      return covers;
    }

    if (!covers[key]) covers[key] = {};
    covers[key][album] = coverUrl;
    this.logActivity('Update Album Cover', 'event', key, `Set cover for "${album}" of event "${key}"`);
    this.persist();
    return covers;
  }

  private clearAlbumCover(eventName: string, album: string): void {
    const covers = this.getAlbumCovers();
    if (!covers[eventName] || !covers[eventName][album]) return;
    delete covers[eventName][album];
    if (Object.keys(covers[eventName]).length === 0) delete covers[eventName];
    this.persist();
  }

  /* --- WEBSITE CONTENT MANAGEMENT --- */
  public getWebsiteContent(): WebsiteContent {
    if (!this.db.websiteContent) {
      this.db.websiteContent = DEFAULT_WEBSITE_CONTENT;
      this.persist();
    }
    return this.db.websiteContent;
  }

  public updateWebsiteContent(updates: Partial<WebsiteContent>): WebsiteContent {
    const current = this.getWebsiteContent();
    this.db.websiteContent = {
      ...current,
      ...updates,
      serviceTimes: updates.serviceTimes || current.serviceTimes,
    };
    this.logActivity('Update Website Content', 'settings', 'website', 'Updated church website content & descriptions');
    this.persist();
    return this.db.websiteContent;
  }

  /* --- TITHES & OFFERING LEDGER --- */
  private recomputeBalances(): void {
    if (!Array.isArray(this.db.transactions)) {
      this.db.transactions = [...DEFAULT_TRANSACTIONS];
    }

    // Sort chronologically by date then id
    this.db.transactions.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.id - b.id;
    });

    let running = 0;
    for (const tx of this.db.transactions) {
      running += (Number(tx.pasok) || 0) - (Number(tx.labas) || 0);
      tx.balance = Math.round((running + Number.EPSILON) * 100) / 100;
    }
  }

  public computeTotals(rows: LedgerTransaction[]): LedgerTotals {
    let inSum = 0;
    let outSum = 0;
    for (const r of rows) {
      inSum += Number(r.pasok) || 0;
      outSum += Number(r.labas) || 0;
    }
    const balance = Math.round((inSum - outSum + Number.EPSILON) * 100) / 100;
    const endingBalance = rows.length > 0 ? rows[rows.length - 1].balance : 0;
    return {
      totalIn: Math.round((inSum + Number.EPSILON) * 100) / 100,
      totalOut: Math.round((outSum + Number.EPSILON) * 100) / 100,
      balance,
      endingBalance,
      count: rows.length,
    };
  }

  public getTransactions(filter?: LedgerFilter): { transactions: LedgerTransaction[]; totals: LedgerTotals } {
    this.recomputeBalances();
    let rows = [...this.db.transactions!];

    if (filter) {
      if (filter.type === 'year' && filter.year) {
        const y = String(filter.year).trim();
        rows = rows.filter((r) => r.date.startsWith(y));
      } else if (filter.type === 'month' && filter.month) {
        const m = String(filter.month).trim();
        rows = rows.filter((r) => r.date.startsWith(m));
      } else if (filter.type === 'date' && filter.date) {
        const d = String(filter.date).trim();
        rows = rows.filter((r) => r.date === d);
      } else if (filter.type === 'range') {
        const from = filter.from || '0000-00-00';
        const to = filter.to || '9999-99-99';
        rows = rows.filter((r) => r.date >= from && r.date <= to);
      }
    }

    return {
      transactions: rows,
      totals: this.computeTotals(rows),
    };
  }

  public addTransaction(data: {
    date: string;
    pasok: number | string;
    labas: number | string;
    purpose?: string;
    forPastor?: boolean;
  }): LedgerTransaction {
    this.recomputeBalances();

    const dateStr = String(data.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new Error('Invalid or missing date (format: YYYY-MM-DD).');
    }

    const pasokNum = Math.max(0, Number(data.pasok) || 0);
    const labasNum = Math.max(0, Number(data.labas) || 0);

    if (pasokNum === 0 && labasNum === 0) {
      throw new Error('Please enter either an Amount In or an Amount Out.');
    }

    const nextId = (this.db.transactions!.reduce((max, t) => Math.max(max, t.id), 0) || 0) + 1;
    const newTx: LedgerTransaction = {
      id: nextId,
      date: dateStr,
      pasok: Math.round((pasokNum + Number.EPSILON) * 100) / 100,
      labas: Math.round((labasNum + Number.EPSILON) * 100) / 100,
      purpose: (data.purpose || '').trim(),
      forPastor: Boolean(data.forPastor),
      balance: 0,
      createdAt: new Date().toISOString(),
    };

    this.db.transactions!.push(newTx);
    this.recomputeBalances();
    this.logActivity('Add Ledger Entry', 'settings', String(newTx.id), `Added transaction on ${newTx.date}: +₱${newTx.pasok} / -₱${newTx.labas} (${newTx.purpose || 'General'})`);
    this.persist();

    return this.db.transactions!.find((t) => t.id === newTx.id) || newTx;
  }

  public deleteTransaction(id: number): boolean {
    this.recomputeBalances();
    const existing = this.db.transactions!.find((t) => t.id === id);
    if (!existing) return false;

    this.db.transactions = this.db.transactions!.filter((t) => t.id !== id);
    this.recomputeBalances();
    this.logActivity('Delete Ledger Entry', 'settings', String(id), `Deleted transaction id ${id} from ${existing.date}`);
    this.persist();
    return true;
  }

  public clearAllTransactions(): void {
    this.db.transactions = [];
    this.logActivity('Clear Ledger', 'settings', 'all', 'Cleared all ledger transactions');
    this.persist();
  }

  public seedSampleTransactions(): LedgerTransaction[] {
    this.db.transactions = [...DEFAULT_TRANSACTIONS];
    this.recomputeBalances();
    this.logActivity('Seed Sample Ledger', 'settings', 'sample', 'Reloaded standard GFC sample ledger records');
    this.persist();
    return this.db.transactions;
  }

  public exportCSV(filter?: LedgerFilter): string {
    const { transactions } = this.getTransactions(filter);
    const lines = ['Date,Amount In (PHP),Amount Out (PHP),Purpose,For Pastor,Balance (PHP)'];
    for (const r of transactions) {
      const cleanPurpose = `"${(r.purpose || '').replace(/"/g, '""')}"`;
      lines.push(`${r.date},${r.pasok},${r.labas},${cleanPurpose},${r.forPastor ? 'Yes' : 'No'},${r.balance}`);
    }
    return '\uFEFF' + lines.join('\n');
  }
}

export const dbManager = new GFCDBManager();
