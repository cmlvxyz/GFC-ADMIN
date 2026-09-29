import { useEffect, useState } from 'react';
import { api } from './api.ts';
import type { SiteEvent } from '../../server/siteEvents.seed.ts';

export interface SiteEventOption {
  id: string;
  title: string;
  tag: string;
  image?: string;
  albumType?: 'date' | 'year';
  /** Album dates for this event, as shown on the website. */
  dates: string[];
  /** Photos per album date, so the picker can show counts. */
  photoCount: number;
}

const toOption = (e: SiteEvent): SiteEventOption => ({
  id: e.id,
  title: e.title,
  tag: e.tag,
  image: e.image,
  albumType: e.albumType,
  dates: (e.dateEntries || []).map(d => d.date),
  photoCount: (e.dateEntries || []).reduce((a, d) => a + (d.photos?.length || 0), 0),
});

/**
 * The website's event list, for "Select event" pickers.
 *
 * Falls back to an empty list rather than a hardcoded copy: a stale hardcoded
 * list previously offered events the website has never had.
 */
export function useSiteEvents(): { events: SiteEventOption[]; loading: boolean; error: string | null } {
  const [events, setEvents] = useState<SiteEventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getSiteEvents()
      .then(list => { if (!cancelled) setEvents(list.map(toOption)); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { events, loading, error };
}

/** Slug used by the public /upload?event=... link. */
export const eventSlug = (title: string): string =>
  title.toLowerCase().replace(/\s+/g, '');

/**
 * Anniversary-style events group photos by year ("1st Year Anniversary")
 * rather than by calendar date. Same rule the website uses in
 * Desktop/GFC/src/pages/QRCodePage.tsx.
 */
export const isYearAlbumEvent = (
  e?: { id?: string; title?: string; albumType?: string } | null
): boolean => {
  if (!e) return false;
  if (e.albumType === 'year') return true;
  return String(e.id ?? '') === 'anniversary' || /anniversary/i.test(String(e.title ?? ''));
};

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th" ... */
export const ordinal = (n: number): string => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

/**
 * The album choices to offer for an event, derived live from that event's
 * saved date albums so anything added in the Events tab shows up here without
 * a code change.
 *
 * Year events (the anniversary) offer one more ordinal than the number of
 * existing year albums, which is the upcoming celebration to plan for.
 */
export const albumOptions = (e?: SiteEventOption | null): string[] => {
  if (!e) return [];
  if (isYearAlbumEvent(e)) {
    const highest = e.dates.reduce((max, d) => {
      const m = String(d).trim().match(/^(\d+)/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const total = Math.max(highest, e.dates.length) + 1;
    return Array.from({ length: total }, (_, i) => `${ordinal(i + 1)} Year Anniversary`);
  }
  return e.dates;
};
