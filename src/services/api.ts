import type { 
  User, GFCEvent, Attendee, Photo, Album, Announcement, ActivityLog, ChurchSettings, DashboardStats, QRVerifyResult,
  WebsiteContent, LedgerTransaction, LedgerTotals, LedgerFilter, SiteCopyGroup, AlbumPair
} from '../types/index.ts';
import type { SiteEvent } from '../../server/siteEvents.seed.ts';

export type FacebookMediaType = 'image' | 'video';

export interface FacebookMediaItem {
  type: FacebookMediaType;
  url: string;
  thumbnail: string;
  sourcePostId: string;
  sourceId?: string;
  width?: number;
  height?: number;
  title?: string;
  permalink?: string;
  /** True when this exact picture is already stored in the gallery. */
  duplicate?: boolean;
}

export interface FacebookImportResult {
  success: boolean;
  /** The Facebook URL exactly as it was pasted in. */
  sourceUrl: string;
  postId: string;
  permalink: string;
  message: string;
  createdTime: string;
  albumName: string;
  media: FacebookMediaItem[];
  warnings?: string[];
  saved?: number;
  /** How many of the media items are already in the gallery. */
  duplicateCount?: number;
  skipped?: number;
}

const API_BASE = '/api';

class GFCApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('gfc_auth_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('gfc_auth_token', token);
    } else {
      localStorage.removeItem('gfc_auth_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      let code: string | undefined;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMessage = errorData.error;
        if (errorData.code) code = errorData.code as string;
      } catch {
        // ignore parse error
      }
      // The machine-readable code is kept on the error so callers can react to
      // specific cases (e.g. duplicate_photo) instead of matching on the text.
      throw Object.assign(new Error(errorMessage), { status: response.status, code });
    }

    return response.json();
  }

  // --- Authentication ---
  public async login(email: string, password?: string): Promise<{ token: string; user: User; message: string }> {
    const res = await this.request<{ token: string; user: User; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  public async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  public logout(): void {
    this.setToken(null);
  }

  // --- Stats ---
  public async getStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/stats');
  }

  // --- Events ---
  public async getEvents(options?: { status?: string; search?: string }): Promise<GFCEvent[]> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.search) params.append('search', options.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<GFCEvent[]>(`/events${qs}`);
  }

  /**
   * The church website's own event list (what the public sees), in render
   * order. Use this for any "Select event" picker so the admin offers the
   * same choices as the website rather than a separate hardcoded list.
   */
  public async getSiteEvents(): Promise<SiteEvent[]> {
    return this.request<SiteEvent[]>('/siteEvents');
  }

  /* --- Generic collection CRUD (verses, prayers, siteEvents, ...) --- */

  public async getCollection<T = any>(key: string): Promise<T[]> {
    return this.request<T[]>(`/${key}`);
  }

  public async addToCollection<T = any>(key: string, record: Partial<T>): Promise<T> {
    return this.request<T>(`/${key}`, { method: 'POST', body: JSON.stringify(record) });
  }

  public async updateInCollection<T = any>(key: string, id: string, updates: Partial<T>): Promise<T> {
    return this.request<T>(`/${key}/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  }

  public async removeFromCollection(key: string, id: string): Promise<any> {
    return this.request(`/${key}/${id}`, { method: 'DELETE' });
  }

  public async getEventById(id: string): Promise<GFCEvent & { attendees: Attendee[] }> {
    return this.request<GFCEvent & { attendees: Attendee[] }>(`/events/${id}`);
  }

  public async createEvent(data: Partial<GFCEvent>): Promise<GFCEvent> {
    return this.request<GFCEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateEvent(id: string, data: Partial<GFCEvent>): Promise<GFCEvent> {
    return this.request<GFCEvent>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async deleteEvent(id: string): Promise<{ success: boolean; id: string }> {
    return this.request<{ success: boolean; id: string }>(`/events/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Date Albums for Events ---
  public async getDateAlbums(): Promise<Record<string, string[]>> {
    return this.request<Record<string, string[]>>('/events-meta/date-albums');
  }

  /**
   * Read the photos and videos attached to ONE Facebook post without saving
   * anything, so the admin can see exactly what that post contains first.
   */
  public async previewFacebookPhotos(url: string): Promise<FacebookImportResult> {
    return this.request<FacebookImportResult>('/facebook/import', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  /**
   * Import the media of a Facebook post and save the found photos/videos to
   * the shared database. Prefer previewFacebookPhotos + the normal save
   * flow so the admin reviews the media before it is stored.
   */
  public async importFacebookPhotos(
    url: string,
    eventName?: string,
    eventDate?: string,
  ): Promise<FacebookImportResult & { saved: number }> {
    return this.request<FacebookImportResult & { saved: number }>('/facebook/import', {
      method: 'POST',
      body: JSON.stringify({ url, eventName, eventDate, save: true }),
    });
  }

  public async addDateAlbum(eventName: string, date: string): Promise<Record<string, string[]>> {
    return this.request<Record<string, string[]>>('/events-meta/date-albums', {
      method: 'POST',
      body: JSON.stringify({ eventName, date }),
    });
  }

  public async deleteDateAlbum(eventName: string, date: string): Promise<Record<string, string[]>> {
    return this.request<Record<string, string[]>>('/events-meta/date-albums', {
      method: 'DELETE',
      body: JSON.stringify({ eventName, date }),
    });
  }

  /** Every album cover, keyed by event title then album label. */
  public async getAlbumCovers(): Promise<Record<string, Record<string, string>>> {
    return this.request<Record<string, Record<string, string>>>('/events-meta/album-covers');
  }

  /**
   * Church Anniversary albums are a Year plus an Event name joined into one
   * card. A year on its own is not an album, so it is only stored until it is
   * paired.
   */
  public async getAlbumYears(): Promise<Record<string, string[]>> {
    return this.request<Record<string, string[]>>('/events-meta/album-years');
  }

  public async addAlbumYear(eventName: string, year: string): Promise<Record<string, string[]>> {
    return this.request<Record<string, string[]>>('/events-meta/album-years', {
      method: 'POST',
      body: JSON.stringify({ eventName, year }),
    });
  }

  public async getAlbumPairs(): Promise<Record<string, AlbumPair[]>> {
    return this.request<Record<string, AlbumPair[]>>('/events-meta/album-pairs');
  }

  public async setAlbumPair(
    eventName: string,
    year: string,
    event: string,
  ): Promise<Record<string, AlbumPair[]>> {
    return this.request<Record<string, AlbumPair[]>>('/events-meta/album-pairs', {
      method: 'POST',
      body: JSON.stringify({ eventName, year, event }),
    });
  }

  /** Removes only the Year + Event link; the album, photos and cover stay. */
  public async deleteAlbumPair(
    eventName: string,
    year: string,
    event: string,
  ): Promise<Record<string, AlbumPair[]>> {
    return this.request<Record<string, AlbumPair[]>>('/events-meta/album-pairs', {
      method: 'DELETE',
      body: JSON.stringify({ eventName, year, event }),
    });
  }

  /**
   * Origins the public site can be opened at, including the LAN address. A QR
   * code has to use the LAN one: a phone cannot reach "localhost".
   */
  public async getReachableUrls(): Promise<string[]> {
    const res = await this.request<{ urls: string[] }>('/reachable-urls');
    return res.urls || [];
  }

  /** Set (or clear, with an empty url) the cover of one album. */
  public async setAlbumCover(
    eventName: string,
    album: string,
    coverUrl: string,
  ): Promise<Record<string, Record<string, string>>> {
    return this.request<Record<string, Record<string, string>>>('/events-meta/album-covers', {
      method: 'POST',
      body: JSON.stringify({ eventName, album, coverUrl }),
    });
  }

  // --- Registration & Attendee QR ---
  public async registerAttendee(
    eventId: string,
    attendeeName: string,
    attendeeEmail: string,
    attendeePhone?: string
  ): Promise<{ attendee: Attendee; message: string }> {
    return this.request<{ attendee: Attendee; message: string }>(`/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify({ attendeeName, attendeeEmail, attendeePhone }),
    });
  }

  public async getEventAttendees(eventId: string): Promise<Attendee[]> {
    return this.request<Attendee[]>(`/events/${eventId}/attendees`);
  }

  /**
   * QR Ticket Verification & Check-In
   */
  public async verifyQRCode(qrPayload: string, targetEventId?: string): Promise<QRVerifyResult> {
    return this.request<QRVerifyResult>('/events/verify-qr', {
      method: 'POST',
      body: JSON.stringify({ qrPayload, targetEventId }),
    });
  }

  // --- Photos & All Photos ---
  public async getPhotos(options?: {
    albumId?: string;
    eventId?: string;
    search?: string;
    featured?: boolean;
  }): Promise<Photo[]> {
    const params = new URLSearchParams();
    if (options?.albumId) params.append('albumId', options.albumId);
    if (options?.eventId) params.append('eventId', options.eventId);
    if (options?.search) params.append('search', options.search);
    if (options?.featured !== undefined) params.append('featured', String(options.featured));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<Photo[]>(`/photos${qs}`);
  }

  public async getPhotoById(id: string): Promise<Photo> {
    return this.request<Photo>(`/photos/${id}`);
  }

  public async createPhoto(data: Partial<Photo>): Promise<Photo> {
    return this.request<Photo>('/photos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updatePhoto(id: string, data: Partial<Photo>): Promise<Photo> {
    return this.request<Photo>(`/photos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async deletePhoto(id: string): Promise<{ success: boolean; id: string }> {
    return this.request<{ success: boolean; id: string }>(`/photos/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Albums ---
  public async getAlbums(): Promise<Album[]> {
    return this.request<Album[]>('/albums');
  }

  public async createAlbum(data: Partial<Album>): Promise<Album> {
    return this.request<Album>('/albums', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async deleteAlbum(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/albums/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Users ---
  public async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  public async createUser(data: Partial<User>): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateUser(id: string, data: Partial<User>): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async deleteUser(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Announcements ---
  public async getAnnouncements(activeOnly = false): Promise<Announcement[]> {
    return this.request<Announcement[]>(`/announcements?active=${activeOnly}`);
  }

  public async createAnnouncement(data: Partial<Announcement>): Promise<Announcement> {
    return this.request<Announcement>('/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateAnnouncement(id: string, data: Partial<Announcement>): Promise<Announcement> {
    return this.request<Announcement>(`/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async deleteAnnouncement(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/announcements/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Activity Logs ---
  public async getActivityLogs(limit = 100): Promise<ActivityLog[]> {
    return this.request<ActivityLog[]>(`/activity-logs?limit=${limit}`);
  }

  // --- Settings ---
  public async getSettings(): Promise<ChurchSettings> {
    return this.request<ChurchSettings>('/settings');
  }

  public async updateSettings(data: Partial<ChurchSettings>): Promise<ChurchSettings> {
    return this.request<ChurchSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // --- Website Content & CMS ---
  public async getWebsiteContent(): Promise<WebsiteContent> {
    return this.request<WebsiteContent>('/website-content');
  }

  public async updateWebsiteContent(data: Partial<WebsiteContent>): Promise<WebsiteContent> {
    return this.request<WebsiteContent>('/website-content', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // --- Website Text: every string the public site renders ---
  public async getSiteCopy(): Promise<{ groups: SiteCopyGroup[]; total: number }> {
    return this.request<{ groups: SiteCopyGroup[]; total: number }>('/site-copy');
  }

  public async saveSiteCopy(values: Record<string, string>): Promise<{ saved: number; keys: string[] }> {
    return this.request<{ saved: number; keys: string[] }>('/site-copy', {
      method: 'PUT',
      body: JSON.stringify({ values }),
    });
  }

  /* --- Church People: attendees -> members -> leaders --- */

  public async getAttendees(): Promise<any[]> {
    return this.request<any[]>('/people/attendees');
  }

  public async getMembers(): Promise<any[]> {
    return this.request<any[]>('/people/members');
  }

  public async getLeaders(): Promise<any[]> {
    return this.request<any[]>('/people/leaders');
  }

  public async addAttendee(data: { name: string; email?: string; phone?: string; facebook?: string; albumDate?: string; eventId?: string; eventTitle?: string }): Promise<any> {
    return this.request('/people/attendees', { method: 'POST', body: JSON.stringify(data) });
  }

  public async addMember(data: { name: string; email?: string; phone?: string }): Promise<any> {
    return this.request('/people/members', { method: 'POST', body: JSON.stringify(data) });
  }

  public async addLeader(data: { name: string; email?: string; phone?: string; role?: string }): Promise<any> {
    return this.request('/people/leaders', { method: 'POST', body: JSON.stringify(data) });
  }

  /** Move an attendee into the member roster. */
  public async promoteAttendee(attendeeId: string): Promise<any> {
    return this.request(`/people/attendees/${attendeeId}/promote`, { method: 'POST' });
  }

  /** Move a member into the leader roster. */
  public async promoteMember(memberId: string): Promise<any> {
    return this.request(`/people/members/${memberId}/promote`, { method: 'POST' });
  }

  public async removePerson(kind: 'attendees' | 'members' | 'leaders', id: string): Promise<any> {
    return this.request(`/people/${kind}/${id}`, { method: 'DELETE' });
  }

  // --- Tithes & Offering Ledger ---
  public async getTransactions(filter?: LedgerFilter): Promise<{ transactions: LedgerTransaction[]; totals: LedgerTotals }> {
    const params = new URLSearchParams();
    if (filter) {
      if (filter.type) params.append('type', filter.type);
      if (filter.year) params.append('year', filter.year);
      if (filter.month) params.append('month', filter.month);
      if (filter.date) params.append('date', filter.date);
      if (filter.from) params.append('from', filter.from);
      if (filter.to) params.append('to', filter.to);
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ transactions: LedgerTransaction[]; totals: LedgerTotals }>(`/transactions${qs}`);
  }

  public async addTransaction(data: {
    date: string;
    pasok: number | string;
    labas: number | string;
    purpose?: string;
    forPastor?: boolean;
  }): Promise<{ transaction: LedgerTransaction; totals: LedgerTotals; message: string }> {
    return this.request<{ transaction: LedgerTransaction; totals: LedgerTotals; message: string }>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async deleteTransaction(id: number): Promise<{ success: boolean; id: number; totals: LedgerTotals }> {
    return this.request<{ success: boolean; id: number; totals: LedgerTotals }>(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  public async clearTransactions(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/transactions-clear', {
      method: 'DELETE',
    });
  }

  public async seedSampleTransactions(): Promise<{ message: string; transactions: LedgerTransaction[]; totals: LedgerTotals }> {
    return this.request<{ message: string; transactions: LedgerTransaction[]; totals: LedgerTotals }>('/transactions/sample', {
      method: 'POST',
    });
  }

  public getExportCsvUrl(filter?: LedgerFilter): string {
    const params = new URLSearchParams();
    if (filter) {
      if (filter.type) params.append('type', filter.type);
      if (filter.year) params.append('year', filter.year);
      if (filter.month) params.append('month', filter.month);
      if (filter.date) params.append('date', filter.date);
      if (filter.from) params.append('from', filter.from);
      if (filter.to) params.append('to', filter.to);
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    return `${API_BASE}/transactions/export-csv${qs}`;
  }

  // --- Reset Database ---
  public async resetDatabase(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/database/reset', {
      method: 'POST',
    });
  }
}

export const api = new GFCApiClient();
