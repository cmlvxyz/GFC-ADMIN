export type Role = 'Super Admin' | 'Admin' | 'Media Team' | 'Pastor' | 'Member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  ministry?: string;
  avatarUrl?: string;
  status: 'active' | 'inactive';
  lastLogin?: string;
  createdAt: string;
}

export type EventCategory = 
  | 'Sunday Service' 
  | 'Youth Ministry' 
  | 'Worship Night' 
  | 'Outreach & Missions' 
  | 'Bible Study' 
  | 'Special Event';

export type EventStatus = 'published' | 'draft' | 'archived';

/**
 * A Church Anniversary album is a Year plus an Event name shown together as one
 * card, e.g. { year: '2024', event: '2nd Year Anniversary' }.
 *
 * `event` doubles as the album label that photos, date albums and album covers
 * are already keyed by, which is what lets a pair label an existing album
 * instead of creating a competing one.
 */
export interface AlbumPair {
  year: string;
  event: string;
}

export interface GFCEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  date: string;
  time: string;
  location: string;
  bannerUrl: string;
  capacity: number;
  registeredCount: number;
  checkInsCount: number;
  status: EventStatus;
  qrCodeValue: string;
  qrTicketSecret: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attendee {
  id: string;
  eventId: string;
  eventTitle: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
  /** Facebook profile of the person, as given when registering. */
  attendeeFacebook?: string;
  /** Album the person attended: a date, or "3rd Year Anniversary". */
  albumDate?: string;
  ticketCode: string;
  qrData: string;
  status: 'confirmed' | 'checked_in' | 'cancelled';
  checkedInAt?: string | null;
  registeredAt: string;
}

export interface Photo {
  id: string;
  title: string;
  description?: string;
  category: string;
  albumId: string;
  albumName: string;
  eventId?: string | null;
  eventTitle?: string | null;
  imageUrl: string;
  uploaderName: string;
  uploaderRole: string;
  qrShareUrl: string;
  qrCodeValue: string;
  viewsCount: number;
  downloadsCount: number;
  isFeatured: boolean;
  tags: string[];
  takenAt: string;
  /** Date album this photo belongs to (e.g. "August 18, 2026"). */
  albumDate?: string;
  createdAt: string;
}

export interface Album {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  photoCount: number;
  eventId?: string | null;
  qrAlbumUrl: string;
  qrCodeValue: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'General' | 'Urgent' | 'Ministry' | 'Schedule';
  priority: 'normal' | 'important' | 'urgent';
  author: string;
  publishedAt: string;
  isActive: boolean;
}

export interface ActivityLog {
  id: string;
  action: string;
  entityType: 'event' | 'photo' | 'qr_checkin' | 'user' | 'announcement' | 'settings' | 'attendee' | 'member' | 'leader';
  entityId: string;
  details: string;
  performedBy: string;
  role: string;
  timestamp: string;
}

export interface ChurchSettings {
  churchName: string;
  abbreviation: string;
  tagline: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  qrCheckInEnabled: boolean;
  qrPhotoSharingEnabled: boolean;
  allowPublicPhotoUpload: boolean;
  requireAdminApprovalForPhotos: boolean;
  defaultEventCapacity: number;
}

export interface WebsiteContent {
  churchName: string;
  tagline: string;
  subTagline: string;
  logoUrl: string;
  bannerVerse: string;
  bannerVerseRef: string;
  heroHeadline: string;
  heroDescription: string;
  heroBadge: string;
  heroImageUrl: string;
  ctaButtonText: string;
  ctaSecondaryText: string;
  aboutTitle: string;
  aboutDescription: string;
  mission: string;
  vision: string;
  pastorWelcomeTitle: string;
  pastorWelcomeMessage: string;
  pastorName: string;
  pastorRole: string;
  pastorImageUrl: string;
  givingTitle: string;
  givingDescription: string;
  givingVerse: string;
  givingVerseRef: string;
  bankAccountDetails: string;
  gcashDetails: string;
  serviceTimes: {
    name: string;
    dayTime: string;
    description: string;
  }[];
  contactAddress: string;
  contactEmail: string;
  contactPhone: string;
  facebookUrl: string;
}

export interface LedgerTransaction {
  id: number;
  date: string;
  pasok: number;
  labas: number;
  purpose: string;
  forPastor: boolean;
  balance: number;
  createdAt: string;
}

export interface LedgerTotals {
  totalIn: number;
  totalOut: number;
  balance: number;
  endingBalance: number;
  count: number;
}

export interface LedgerFilter {
  type: 'all' | 'year' | 'month' | 'date' | 'range';
  year?: string;
  month?: string;
  date?: string;
  from?: string;
  to?: string;
  label?: string;
}

export interface DashboardStats {
  totalEvents: number;
  upcomingEvents: number;
  publishedEvents: number;
  totalPhotos: number;
  featuredPhotos: number;
  totalAttendees: number;
  totalCheckIns: number;
  totalMembers: number;
  totalLeaders: number;
  totalAdminAccounts: number;
  totalLedgerBalance?: number;
  totalLedgerIn?: number;
  totalLedgerOut?: number;
}

export interface QRVerifyResult {
  valid: boolean;
  status: 'success' | 'already_checked_in' | 'invalid_ticket' | 'event_mismatch' | 'error';
  message: string;
  attendee?: Attendee;
  event?: GFCEvent;
  checkedInAt?: string;
}

/** One editable string the public website renders. */
export interface SiteCopyField {
  key: string;
  label: string;
  multiline: boolean;
  value: string;
  isDefault: boolean;
}

/** A themed set of website text, e.g. Navbar or Prayer Page. */
export interface SiteCopyGroup {
  id: string;
  title: string;
  blurb: string;
  fields: SiteCopyField[];
}
