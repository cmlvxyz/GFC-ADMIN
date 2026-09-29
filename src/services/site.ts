/**
 * Where the public church website lives.
 *
 * Priority:
 *   1. VITE_SITE_URL          - set explicitly (.env / Render)
 *   2. localhost / LAN IP     - the GFC dev server runs on :3002
 *   3. current origin         - production, where one server serves the site
 */

export const SITE_BASE = ((): string => {
  const fromEnv = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (typeof window === 'undefined') return 'http://localhost:3002';

  const host = window.location.hostname;
  const isLocalhost = !host || host === 'localhost' || host === '127.0.0.1';
  const isLanIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (isLocalhost || isLanIp) return `http://${host}:3002`;

  return window.location.origin;
})();

/** Absolute URL of a site path, e.g. siteUrl('/') -> http://localhost:3002/ */
export const siteUrl = (path = '/'): string => `${SITE_BASE}${path.startsWith('/') ? path : `/${path}`}`;

/** Open the public website in a new tab. */
export const openSite = (path = '/'): void => {
  window.open(siteUrl(path), '_blank', 'noopener,noreferrer');
};

/**
 * Open the public website, and if it is not running (dev only) emit an event
 * so the UI can explain how to start it. In production the site is served from
 * the same origin, so there is nothing to check.
 */
export const openSiteOrExplain = async (path = '/'): Promise<void> => {
  const target = siteUrl(path);
  window.open(target, '_blank', 'noopener,noreferrer');

  if (!import.meta.env.DEV) return;

  try {
    await fetch(siteUrl('/'), { method: 'HEAD', mode: 'no-cors' });
  } catch {
    window.dispatchEvent(new CustomEvent('gfc:site-unreachable', { detail: { url: target } }));
  }
};

/** Resolve a possibly-relative image path to something the browser can load. */
export const resolveAssetUrl = (u: string): string => {
  if (!u) return u;
  if (u.startsWith('data:') || /^https?:\/\//i.test(u) || u.startsWith('blob:')) return u;
  return siteUrl(u);
};
