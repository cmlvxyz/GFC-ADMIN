/**
 * Facebook Graph API integration for importing the media attached to ONE
 * specific Facebook post.
 *
 * The whole point of this module is precision: when a user pastes a post
 * permalink we resolve THAT post and return exactly the photos and videos
 * attached to it. We never fall back to "the page's photos", "the page's
 * recent posts" or "the album" as a source of media - a post that cannot be
 * read produces a clear error instead of unrelated pictures.
 *
 * Requires (server-side only, never sent to the browser):
 *   FACEBOOK_GRAPH_VERSION            e.g. v26.0
 *   FACEBOOK_GFC_PAGE_ID
 *   FACEBOOK_GFC_PAGE_ACCESS_TOKEN
 * Optional second page:
 *   FACEBOOK_NEXTGEN_PAGE_ID
 *   FACEBOOK_NEXTGEN_PAGE_ACCESS_TOKEN
 * Optional extra identities for a page (Facebook serves the same post under
 * several ids; permalink.php links carry the "URL id" in ?id=):
 *   FACEBOOK_GFC_PAGE_ID_ALIASES=61590579395623,...
 */

const DEFAULT_GRAPH_VERSION = 'v26.0';
const GRAPH_HOST = 'https://graph.facebook.com';
const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Identity of a stored photo, used to keep re-imports from duplicating it.
 *
 * Facebook re-signs every CDN URL on each request (oh=/oe=/_nc_*= change), so
 * the same picture arrives under a different string every time. Comparing the
 * full URL would therefore never find a duplicate, while comparing the
 * pathname - the immutable part - always does.
 */
const FACEBOOK_CDN_HOST =
  /^https:\/\/(?:[a-z0-9-]+\.)*(?:fbcdn\.net|fbsbx\.com|cdninstagram\.com|facebook\.com|fb\.com)\//i;

/**
 * Identity of a stored photo, used to keep re-imports from duplicating it.
 *
 * Facebook re-signs every CDN URL on each request (oh=/oe=/_nc_*= change), so
 * the same picture arrives under a different string every time. Comparing the
 * full URL would therefore never find a duplicate, while comparing the
 * hostname plus path always does.
 */
export function photoStorageKey(url: unknown): string {
  const value = String(url ?? '').trim();
  if (!value) return '';

  // Inline uploads arrive as base64 data URLs, whose payload is case sensitive:
  // lowercasing them would collapse distinct photos into one and silently drop
  // a real upload, so they are compared byte for byte.
  if (!/^https?:\/\//i.test(value)) return value;

  const stripped = FACEBOOK_CDN_HOST.test(value) ? stripQuery(value) : value;
  return stripped.toLowerCase();
}

/** Subattachments are paginated by the Graph API; never trust the first page. */
const SUBATTACHMENT_PAGE_SIZE = 100;
const MAX_SUBATTACHMENT_PAGES = 20;

/**
 * Bounded walk of the page feed used ONLY to find the exact post that a
 * permalink.php?story_fbid=pfbid... link points at (see findPostByPfbid).
 */
const FEED_PAGE_SIZE = 100;
const MAX_FEED_PAGES = 6;

const PAGE_URL_MESSAGE =
  `That is a Facebook Page link, not a post link. This importer only reads media from a specific post. ` +
  `Open the post in the browser, choose "Copy link to post" (or copy the link from the address bar of that post), and paste it here.`;

export type FacebookMediaType = 'image' | 'video';

export interface FacebookMediaItem {
  type: FacebookMediaType;
  /** Best usable URL: the full-size CDN image or the video file. */
  url: string;
  /** Poster/preview image. For photos this is the image itself. */
  thumbnail: string;
  /** The exact post this item was attached to. */
  sourcePostId: string;
  sourceId?: string;
  width?: number;
  height?: number;
  title?: string;
  permalink?: string;
}

export interface FacebookImportResult {
  postId: string;
  permalink: string;
  sourceUrl: string;
  message: string;
  createdTime: string;
  albumName: string;
  media: FacebookMediaItem[];
  /** Non-fatal notes, e.g. a video whose file Facebook would not hand over. */
  warnings: string[];
}

/** An error with a user-facing message and the HTTP status the API should use. */
export class FacebookImportError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly fbCode?: number;

  constructor(message: string, options: { status?: number; code?: string; fbCode?: number } = {}) {
    super(message);
    this.name = 'FacebookImportError';
    this.status = options.status ?? 400;
    this.code = options.code ?? 'facebook_import_failed';
    this.fbCode = options.fbCode;
  }
}

/* ------------------------------------------------------------------ */
/* Configuration - read lazily so .env and test doubles are always fresh */
/* ------------------------------------------------------------------ */

export interface FacebookPageConfig {
  key: string;
  label: string;
  id: string;
  token: string;
  /** Extra identities the same page answers to (URL ids, slugs, ...). */
  aliases: string[];
}

export interface FacebookConfig {
  graphVersion: string;
  pages: FacebookPageConfig[];
}

function readFacebookConfig(): FacebookConfig {
  const graphVersion =
    (process.env.FACEBOOK_GRAPH_VERSION || '').trim() || DEFAULT_GRAPH_VERSION;

  const pages: FacebookPageConfig[] = [];

  const addPage = (key: string, label: string, idVar: string, tokenVar: string) => {
    const id = (process.env[idVar] || '').trim();
    const token = (process.env[tokenVar] || '').trim();
    if (!id || !token) return;
    const rawAliases =
      (process.env[`${idVar}_ALIASES`] || '') + ',' + (process.env[`FACEBOOK_${key.toUpperCase()}_PAGE_ID_ALIASES`] || '');
    const aliases = rawAliases
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^\d+$/.test(value) && value !== id);
    pages.push({ key, label, id, token, aliases });
  };

  addPage('gfc', 'GFC', 'FACEBOOK_GFC_PAGE_ID', 'FACEBOOK_GFC_PAGE_ACCESS_TOKEN');
  addPage('nextgen', 'NextGen', 'FACEBOOK_NEXTGEN_PAGE_ID', 'FACEBOOK_NEXTGEN_PAGE_ACCESS_TOKEN');

  return { graphVersion, pages };
}

export function isFacebookConfigured(): boolean {
  return readFacebookConfig().pages.length > 0;
}

/* ------------------------------------------------------------------ */
/* URL parsing                                                         */
/* ------------------------------------------------------------------ */

export type FacebookUrlKind = 'post' | 'photo' | 'video' | 'album' | 'share' | 'page';

export interface ParsedFacebookUrl {
  kind: FacebookUrlKind;
  raw: string;
  /** Opaque pfbid, e.g. permalink.php?story_fbid=pfbid02rv8... */
  pfbid?: string;
  /** Numeric post / photo / video object id taken from the link. */
  nodeId?: string;
  /** Identity of the owning page: the ?id= param or the first path segment. */
  ownerId?: string;
  albumId?: string;
  /** /share/r/<code> short links carry no id the Graph API can resolve. */
  shortCode?: string;
}

function isFacebookHost(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase().replace(/:\d+$/, '');
  if (host === 'fb.watch' || host === 'fb.com' || host === 'www.fb.com') return true;
  return host === 'facebook.com' || host.endsWith('.facebook.com');
}

const isPfbid = (value: string) => /^pfbid[A-Za-z0-9]+$/.test(value);
const isNumericId = (value: string) => /^\d{5,}$/.test(value);

/**
 * Turns anything Facebook hands out into the object it points at.
 * Returns null for anything that is not a Facebook link at all.
 *
 *   https://www.facebook.com/permalink.php?story_fbid=pfbid...&id=61590579395623
 *   https://www.facebook.com/{page}/posts/1234567890
 *   https://www.facebook.com/{page}/photos/1234567890
 *   https://www.facebook.com/{page}/videos/1234567890
 *   https://www.facebook.com/photo.php?fbid=1234567890
 *   https://www.facebook.com/share/p/pfbid...
 *   1074232749116315_122145897975352646
 */
export function parseFacebookUrl(input: string): ParsedFacebookUrl | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  // Bare Graph object id: PAGEID_POSTID
  const objectId = raw.match(/^(\d+)_(\d+)$/);
  if (objectId) return { kind: 'post', raw, nodeId: raw };

  // Bare pfbid or bare numeric id
  if (isPfbid(raw)) return { kind: 'post', raw, pfbid: raw };
  if (isNumericId(raw)) return { kind: 'post', raw, nodeId: raw };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!isFacebookHost(url.hostname)) return null;

  const param = (key: string) => url.searchParams.get(key) || '';
  const segments = url.pathname.split('/').filter(Boolean);
  const head = (segments[0] || '').toLowerCase();
  // permalink.php / photo.php / story.php / watch carry the object in the query.
  const page = head.replace(/\.php$/, '');
  const ownerFromPath = ['posts', 'photos', 'videos', 'permalink', 'reel'].includes(page)
    ? undefined
    : segments[0];

  // ---- permalink.php / story.php?story_fbid=pfbid...&id=<page identity>
  if (page === 'permalink' || page === 'story') {
    const storyFbid = param('story_fbid') || param('fbid');
    const ownerId = param('id') || ownerFromPath;
    if (isPfbid(storyFbid)) return { kind: 'post', raw, pfbid: storyFbid, ownerId: ownerId || undefined };
    if (isNumericId(storyFbid)) return { kind: 'post', raw, nodeId: storyFbid, ownerId: ownerId || undefined };
    if (ownerId) return { kind: 'post', raw, ownerId };
    return null;
  }

  // ---- photo.php?fbid=... (a single photo, which may be its own post)
  if (page === 'photo') {
    const fbid = param('fbid');
    if (isNumericId(fbid)) return { kind: 'photo', raw, nodeId: fbid, ownerId: param('id') || undefined };
    return null;
  }

  // ---- /share/p/<pfbid> is a real post id; /share/r/<code> is opaque.
  if (page === 'share') {
    const value = segments[1] || '';
    if (value.toLowerCase() === 'p' && isPfbid(segments[2] || '')) {
      return { kind: 'post', raw, pfbid: segments[2], ownerId: param('id') || undefined };
    }
    const code = value.includes('/') ? value : segments.slice(1).join('/');
    return { kind: 'share', raw, shortCode: code || 'unknown' };
  }

  // ---- /watch/?v=<id> or /videos/<id>
  if (page === 'watch') {
    const v = param('v');
    if (isNumericId(v)) return { kind: 'video', raw, nodeId: v, ownerId: param('id') || undefined };
    return null;
  }

  // ---- /reel/<id> (a reel link is a video of the page that posted it)
  if (page === 'reel' || page === 'reels') {
    const tail = segments[1] || '';
    if (isNumericId(tail)) return { kind: 'video', raw, nodeId: tail, ownerId: param('id') || undefined };
    return { kind: 'video', raw, ownerId: param('id') || undefined };
  }

  // ---- explicit albums: only ever the album the user actually named
  const albumFromSet = param('set').match(/(?:^|\.)a\.(\d+)/);
  const albumFromPath = url.pathname.match(/\/albums\/(\d+)/);
  const photoAlbumPath = url.pathname.match(/\/photos\/a\.(\d+)/);
  const albumId = albumFromSet?.[1] || albumFromPath?.[1] || photoAlbumPath?.[1];
  if (albumId) return { kind: 'album', raw, albumId, ownerId: param('id') || ownerFromPath };

  // ---- /{page}/posts/{id} | /{page}/photos/{id} | /{page}/videos/{id} | /{page}/reel/{id}
  const detail = segments.findIndex((segment, index) =>
    index > 0 && ['posts', 'photos', 'videos', 'reel', 'reels', 'permalink'].includes(segment.toLowerCase()),
  );
  if (detail > 0) {
    const kind = segments[detail].toLowerCase();
    const tail = segments[detail + 1] || '';
    const ownerId = segments[0];
    if (kind === 'videos' || kind === 'reel' || kind === 'reels') {
      if (isNumericId(tail)) return { kind: 'video', raw, nodeId: tail, ownerId };
      return { kind: 'video', raw, ownerId };
    }
    // A post tail is either the numeric post id or a pfbid; both name the
    // exact post. Anything else in this position is not a post link we can use.
    if (isPfbid(tail)) return { kind: 'post', raw, pfbid: tail, ownerId };
    if (isNumericId(tail)) {
      return { kind: kind === 'photos' ? 'photo' : 'post', raw, nodeId: tail, ownerId };
    }
    return { kind: 'post', raw, ownerId };
  }

  // ---- /{page} and / with nothing else: a Page (or profile) link, not a post.
  return { kind: 'page', raw, ownerId: ownerFromPath };
}

/* ------------------------------------------------------------------ */
/* Graph API transport                                                 */
/* ------------------------------------------------------------------ */

/** Nothing derived from a Facebook error may ever echo a token back. */
function redactSecrets(value: string, config?: FacebookConfig): string {
  let out = String(value || '');
  out = out.replace(/([?&]access_token=)[^&\s"']+/gi, '$1[redacted]');
  for (const configuredPage of config?.pages ?? []) {
    if (configuredPage.token.length > 8) {
      out = out.split(configuredPage.token).join('[redacted]');
    }
  }
  return out;
}

function toFacebookImportError(
  error: { code?: number; error_subcode?: number; type?: string; message?: string },
  httpStatus: number,
  config?: FacebookConfig,
): FacebookImportError {
  const code = Number(error?.code) || 0;
  const subcode = Number(error?.error_subcode) || 0;
  const detail = redactSecrets(error?.message || '', config).trim();
  const suffix = detail && !/unsupported get request/i.test(detail) ? ` (Facebook said: ${detail})` : '';

  // Invalid / expired / malformed token.
  if (code === 190 || code === 102 || code === 463) {
    // Facebook reports the exact moment a token stops working. Surfacing it
    // turns "invalid or expired" into a fact the admin can act on.
    const expiresAt = Number((error as any)?.error_data?.expires_time);
    const when = Number.isFinite(expiresAt) && expiresAt > 0
      ? new Date(expiresAt * 1000).toISOString()
      : '';
    return new FacebookImportError(
      `The Facebook Page token is no longer valid${when ? ` (it expired on ${when})` : ''}. `
      + 'A new Page Access Token is needed before importing again - see README "Facebook import".',
      { status: 401, code: 'facebook_token_invalid', fbCode: code },
    );
  }
  // Rate limiting.
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80007) {
    return new FacebookImportError(
      'Facebook is rate-limiting this app right now. Please wait a moment and try again.',
      { status: 429, code: 'facebook_rate_limited', fbCode: code },
    );
  }
  // Missing permission / app not authorised for this content.
  if (code === 200 || code === 10 || subcode === 10 || code === 368) {
    return new FacebookImportError(
      `The Facebook Page token is not allowed to read this post${suffix}. Grant the page token public_content / pages_read_engagement access, then try again.`,
      { status: 403, code: 'facebook_permission_denied', fbCode: code },
    );
  }
  // Object missing, private, or not visible to this token.
  if (code === 100 || code === 803 || code === 1) {
    return new FacebookImportError(
      `That Facebook post could not be found. It may have been deleted, or it may be private / not published, and the connected Page token cannot read it.${suffix}`,
      { status: 404, code: 'facebook_post_not_found', fbCode: code },
    );
  }
  return new FacebookImportError(
    `Facebook could not complete the request${suffix}.`.trim(),
    { status: httpStatus >= 500 || httpStatus === 0 ? 502 : 400, code: 'facebook_api_error', fbCode: code || undefined },
  );
}

async function graphRequest<T = any>(
  config: FacebookConfig,
  target: string,
  params: Record<string, string | number | undefined>,
  page?: FacebookPageConfig,
): Promise<T> {
  const url = new URL(
    target.startsWith('http') ? target : `${GRAPH_HOST}/${config.graphVersion}/${target}`,
  );
  // Defence in depth: refuse to ever send credentials anywhere but Graph.
  if (!isGraphHost(url.hostname)) {
    throw new FacebookImportError('Refusing to contact a non-Facebook host.', {
      status: 500,
      code: 'facebook_bad_host',
    });
  }
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  if (page?.token) url.searchParams.set('access_token', page.token);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (data?.error) throw toFacebookImportError(data.error, response.status, config);
    if (!data) {
      throw new FacebookImportError(
        `Facebook returned an unreadable response (HTTP ${response.status}). Please try again.`,
        { status: 502, code: 'facebook_bad_response' },
      );
    }
    return data as T;
  } catch (err: any) {
    if (err instanceof FacebookImportError) throw err;
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      throw new FacebookImportError('Facebook took too long to answer. Please try again.', {
        status: 504,
        code: 'facebook_timeout',
      });
    }
    throw new FacebookImportError('Could not reach the Facebook Graph API. Please try again.', {
      status: 502,
      code: 'facebook_network',
    });
  } finally {
    clearTimeout(timer);
  }
}

function isGraphHost(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase().replace(/:\d+$/, '');
  return host === 'graph.facebook.com' || host.endsWith('.graph.facebook.com');
}

/** Follows a `paging.next` cursor. The cursor already carries the token. */
async function graphNextPage<T = any>(config: FacebookConfig, nextUrl: string): Promise<T | null> {
  if (!nextUrl || !isGraphHost(safeHost(nextUrl))) return null;
  try {
    return await graphRequest<T>(config, nextUrl, {});
  } catch {
    return null;
  }
}

function safeHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/* Field sets                                                          */
/* ------------------------------------------------------------------ */

/**
 * Attachment `media` cannot be field-expanded: the Graph API rejects
 * `media{...}` on an attachment with "(#100) Tried accessing nonexisting
 * field". It always comes back whole, which is all we need - a photo media
 * object carries `image.src`, a video media object carries `source`/`picture`.
 * What *is* expandable is the attachment and subattachment itself, so take
 * `type` and `target` from there: `target.id` is the photo/video object id.
 */
const POST_FIELDS =
  `id,message,created_time,permalink_url,story,full_picture,` +
  `attachments{id,type,target,media,` +
  `subattachments.limit(${SUBATTACHMENT_PAGE_SIZE}){id,type,target,media}}`;
const PHOTO_FIELDS = 'id,created_time,source,name,images,from{type,id}';
const VIDEO_FIELDS = 'id,created_time,title,description,source,picture,thumbnails{url,width,height},permalink_url';
const ALBUM_PHOTO_FIELDS = 'id,created_time,source,name,images';
/** Identifiers only: enough to recognise a post, with none of its media. */
const FEED_SCAN_FIELDS = 'id,permalink_url,story';

/** Field sets to try, in order, when reading the resolved object. */
function fieldSetsFor(kind: FacebookUrlKind): string[] {
  switch (kind) {
    case 'photo':
      return [PHOTO_FIELDS, POST_FIELDS];
    case 'video':
      return [VIDEO_FIELDS];
    default:
      // A pfbid tells us nothing about the node type, so try the shapes in turn.
      return [POST_FIELDS, VIDEO_FIELDS, PHOTO_FIELDS];
  }
}

/* ------------------------------------------------------------------ */
/* Post resolution                                                     */
/* ------------------------------------------------------------------ */

/**
 * Identities a post may be addressable by: the Graph page id, its configured
 * aliases, and the numeric `?id=`/`/posts/` id taken from the pasted link.
 *
 * The id in the link is only a hint. A vanity id such as
 * `122142918375352646` is not a Graph object id our Page token can read, so
 * trying it costs a slow round trip and always fails; it is kept only as a
 * last resort, after the identities we actually hold a token for.
 */
function ownerIdsFor(parsed: ParsedFacebookUrl, page: FacebookPageConfig): string[] {
  const configured = [page.id, ...page.aliases].filter((id) => /^\d+$/.test(id));
  const fromUrl = parsed.ownerId && /^\d+$/.test(parsed.ownerId) ? parsed.ownerId : '';
  if (!fromUrl) return unique(configured);
  return unique(configured.includes(fromUrl) ? configured : [...configured, fromUrl]);
}

/** Prefers the configured page that the URL actually points at. */
function orderedPages(parsed: ParsedFacebookUrl, config: FacebookConfig): FacebookPageConfig[] {
  const owner = (parsed.ownerId || '').toLowerCase();
  if (!owner) return config.pages;
  const matches = config.pages.filter((page) =>
    [page.id, ...page.aliases].some((id) => id.toLowerCase() === owner) ||
    page.key.toLowerCase() === owner ||
    page.label.toLowerCase().replace(/\s+/g, '') === owner,
  );
  return matches.length ? [...matches, ...config.pages.filter((p) => !matches.includes(p))] : config.pages;
}

function nodeIdCandidates(parsed: ParsedFacebookUrl, page: FacebookPageConfig): string[] {
  const owners = ownerIdsFor(parsed, page);
  const candidates: string[] = [];
  const add = (id: string) => { if (id) candidates.push(id); };

  // A post is only addressable as "<owner id>_<post id>"; a bare post id or
  // pfbid is not a Graph id (the API answers those with "(#12) singular
  // statuses API is deprecated"). A photo or a video, by contrast, is
  // addressable on its own, so its id is tried directly too.
  if (parsed.nodeId && !parsed.nodeId.includes('_')) {
    for (const owner of owners) add(`${owner}_${parsed.nodeId}`);
    if (parsed.kind === 'photo' || parsed.kind === 'video') add(parsed.nodeId);
  } else if (parsed.nodeId) {
    add(parsed.nodeId);
  }
  if (parsed.pfbid) {
    for (const owner of owners) add(`${owner}_${parsed.pfbid}`);
  }
  return unique(candidates);
}

function postMatchesPfbid(node: any, pfbid: string): boolean {
  if (!node || !pfbid) return false;
  const id = String(node.id || '');
  const permalink = String(node.permalink_url || '');
  const story = String(node.story || '');
  return (
    id.includes(pfbid) ||
    permalink.includes(`story_fbid=${pfbid}`) ||
    permalink.includes(pfbid) ||
    story.includes(pfbid)
  );
}

/**
 * True for failures that are about the app (token, permissions, quota) rather
 * than about the requested object, so trying another id cannot help.
 */
function isAppWideFailure(err: FacebookImportError): boolean {
  return (
    err.fbCode === 190 ||
    err.fbCode === 200 ||
    err.fbCode === 463 ||
    err.fbCode === 4 ||
    err.fbCode === 17 ||
    err.fbCode === 32 ||
    err.fbCode === 613 ||
    err.fbCode === 80007 ||
    err.code === 'facebook_token_invalid' ||
    err.code === 'facebook_permission_denied' ||
    err.code === 'facebook_rate_limited'
  );
}

/**
 * Guard against the Graph API answering a request for an object id it does
 * not recognise with a DIFFERENT, perfectly valid object. This really happens:
 * a composite "<page id>_<pfbid>" for an unknown pfbid comes back as some
 * unrelated post. Media is only ever used when the node returned provably is
 * the post that was pasted, otherwise the importer would show exactly the
 * "unrelated media" this is meant to prevent.
 */
function nodeMatchesRequest(node: any, parsed: ParsedFacebookUrl): boolean {
  if (!node || typeof node !== 'object') return false;
  const id = String(node.id || '');
  const permalink = String(node.permalink_url || '');
  const story = String(node.story || '');

  if (parsed.pfbid) {
    return `${id} ${permalink} ${story}`.includes(parsed.pfbid);
  }

  const wanted = parsed.nodeId;
  if (!wanted) return false;
  if (wanted.includes('_')) return id === wanted;
  if (id === wanted) return true;
  if (id.endsWith(`_${wanted}`)) return true;
  if (permalink.includes(wanted)) return true;
  if (String(node.from?.id || '') === wanted) return true;
  // A photo.php?fbid= link: the post that carries that photo is also valid.
  const attachmentIds: string[] = [];
  for (const attachment of node?.attachments?.data || []) {
    attachmentIds.push(String(attachment?.id || ''), String(attachment?.media?.id || ''));
    for (const sub of attachment?.subattachments?.data || []) {
      attachmentIds.push(String(sub?.id || ''), String(sub?.media?.id || ''));
    }
  }
  return attachmentIds.includes(wanted);
}

/**
 * Looks the pasted post up inside the owning page's feed.
 *
 * This is an index lookup, not a media source: it only ever returns a post
 * that provably is the one that was pasted, and if nothing matches we fail
 * with an error. No other post is ever read, and no media is ever taken from
 * a post that was not an exact match. It exists because a Page token can read
 * a post through the feed edge that it may not be allowed to read directly.
 */
async function findPostInFeed(
  parsed: ParsedFacebookUrl,
  config: FacebookConfig,
): Promise<{ node: any; page: FacebookPageConfig } | null> {
  if (!parsed.pfbid && !parsed.nodeId) return null;
  const matches = (item: any) =>
    parsed.pfbid ? postMatchesPfbid(item, parsed.pfbid) : nodeMatchesRequest(item, parsed);

  for (const page of orderedPages(parsed, config)) {
    // Only the ids we hold a token for: the page feed and a vanity-id feed
    // list the same posts, so a second pass would just cost time.
    for (const ownerId of [page.id, ...page.aliases]) {
      let cursor: any = null;
      // The feed is used as an index to find WHICH post is being asked for, so
      // the scan asks only for identifiers. Reading the media of 100 posts we
      // are going to throw away is both slow and wasteful.
      try {
        cursor = await graphRequest<any>(config, `${ownerId}/posts`, {
          fields: FEED_SCAN_FIELDS,
          limit: FEED_PAGE_SIZE,
        }, page);
      } catch (err: any) {
        if (err instanceof FacebookImportError && isAppWideFailure(err)) throw err;
        continue;
      }
      for (let pageNumber = 0; cursor && pageNumber < MAX_FEED_PAGES; pageNumber += 1) {
        const found = (cursor.data || []).find(matches);
        if (found) {
          // Re-read that one post, and only that post, for its media.
          const id = String(found.id || '');
          if (id) {
            try {
              const node = await graphRequest<any>(config, id, { fields: POST_FIELDS }, page);
              if (node && typeof node === 'object' && nodeMatchesRequest(node, parsed)) {
                return { node, page };
              }
            } catch (err: any) {
              if (err instanceof FacebookImportError && isAppWideFailure(err)) throw err;
            }
          }
          return null;
        }
        if (!cursor.paging?.next) break;
        cursor = await graphNextPage(config, cursor.paging.next);
      }
    }
  }
  return null;
}

async function resolvePostNode(
  parsed: ParsedFacebookUrl,
  config: FacebookConfig,
): Promise<{ node: any; page: FacebookPageConfig }> {
  const fieldSets = fieldSetsFor(parsed.kind);
  let permissionError: FacebookImportError | null = null;

  for (const page of orderedPages(parsed, config)) {
    for (const candidate of nodeIdCandidates(parsed, page)) {
      for (const fields of fieldSets) {
        try {
          const node = await graphRequest<any>(config, candidate, { fields }, page);
          if (node && typeof node === 'object') {
            if (nodeMatchesRequest(node, parsed)) return { node, page };
            // Facebook answered with a different object: do not use it, and do
            // not keep re-reading the same wrong id with other field sets.
            break;
          }
        } catch (err: any) {
          if (err instanceof FacebookImportError) {
            // A broken token or a global rate limit will not improve with
            // another candidate id, so surface it immediately.
            if (err.fbCode === 190 || err.fbCode === 463 || err.code === 'facebook_token_invalid' || err.code === 'facebook_rate_limited') {
              throw err;
            }
            // A missing permission is worth reporting over a generic
            // "not found", because the post may well be there.
            if (err.code === 'facebook_permission_denied' || err.fbCode === 10) {
              permissionError = err;
              break;
            }
            // "This object does not exist" is final for this id: the other
            // field sets describe the same object, so retrying them only makes
            // a failed lookup slower. Move on to the next candidate id.
            if (err.fbCode === 100 || err.fbCode === 803 || err.fbCode === 1 || err.fbCode === 12) {
              break;
            }
            continue;
          }
        }
      }
    }
  }

  // The post could not be read directly. A Page token is often still allowed
  // to read the very same post through the page feed, so look it up there by
  // its exact identifier before giving up.
  const inFeed = await findPostInFeed(parsed, config);
  if (inFeed) return inFeed;

  if (permissionError) throw permissionError;

  throw new FacebookImportError(
    'That Facebook post could not be found. It may have been deleted, or it may be private / not published, and the connected Page token cannot read it. Paste the link to the specific post (not the page).',
    { status: 404, code: 'facebook_post_not_found' },
  );
}

/* ------------------------------------------------------------------ */
/* Media extraction                                                    */
/* ------------------------------------------------------------------ */

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

/**
 * Facebook CDN images are served from "/s<w>x<h>/" (downscaled) paths; the
 * "/p<w>x<h>/" variant of the same object is the original file. The signed
 * query string is part of the URL and must be kept.
 */
function upgradeCdnPath(url: string): string {
  if (!url || !isHttpUrl(url)) return url;
  return url.replace(/\/s(\d+x\d+)\//, '/p$1/');
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

/** Key used to detect the same Facebook image arriving twice in one post. */
function canonicalMediaKey(item: { sourceId?: string; url?: string; thumbnail?: string }): string {
  if (item.sourceId) return `id:${item.sourceId}`;
  const raw = stripQuery(item.url || item.thumbnail || '');
  return `url:${raw}`;
}

function stripQuery(url: string): string {
  if (!url) return '';
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

/**
 * Decides whether one media item is a photo or a video.
 *
 * `hint` comes from the attachment/subattachment `type` field, which is the
 * most reliable signal we get: an attachment `media` object cannot be field
 * expanded, so it arrives without its own `type`. A video is therefore also
 * recognised by its shape (a playable file rather than an image).
 */
function classifyMedia(media: any, parent: any, hint?: string): FacebookMediaType {
  const declared = String(hint || media?.type || '').toLowerCase();
  if (declared === 'video' || declared === 'video_array') return 'video';
  if (declared === 'photo' || declared === 'image' || declared === 'album' || declared === 'photo_array') {
    return 'image';
  }
  if (isHttpUrl(media?.source) && /\.(mp4|m4v|mov|webm)(\?|$)/i.test(media.source)) return 'video';
  const parentType = String(parent?.type || '').toLowerCase();
  if (parentType === 'video' || parentType === 'video_array') return 'video';
  return 'image';
}

function bestImageFromPhotoNode(node: any): { url: string; width?: number; height?: number } {
  const images = Array.isArray(node?.images) ? node.images.filter((image: any) => isHttpUrl(image?.source)) : [];
  const best = images.reduce(
    (largest: any, image: any) =>
      Number(image?.width || 0) > Number(largest?.width || 0) ? image : largest,
    images[0] || null,
  );
  if (best?.source) return { url: best.source, width: best.width, height: best.height };
  if (isHttpUrl(node?.source)) return { url: node.source };
  if (isHttpUrl(node?.image?.src)) return { url: node.image.src, width: node.image.width, height: node.image.height };
  return { url: '' };
}

/**
 * Builds a media item from one attachment `media` node. Returns null when the
 * node carries nothing we can actually display - Facebook sometimes hands
 * back links, notes or file cards that are not media.
 */
async function mediaFromAttachment(
  media: any,
  parent: any,
  context: { postId: string; config: FacebookConfig; page: FacebookPageConfig },
  warnings: string[],
  hint: { type?: unknown; id?: unknown } = {},
): Promise<FacebookMediaItem | null> {
  if (!media || typeof media !== 'object') return null;
  const type = classifyMedia(media, parent, typeof hint.type === 'string' ? hint.type : undefined);
  // `target.id` is the photo/video object id; attachment media has no `id`.
  const sourceId = String(hint.id || media.id || '') || undefined;

  if (type === 'video') {
    const poster =
      firstHttpUrl([media.picture, media.thumbnail_image?.url, media.image?.src]) || '';
    const direct = isHttpUrl(media.source) ? media.source : '';
    let url = direct;
    let permalink = isHttpUrl(media.permalink_url) ? media.permalink_url : undefined;
    let thumbnail = poster;

    // A video attachment only carries a stub; the playable file and poster
    // come from reading the video object itself. This is a targeted read of
    // the exact video attached to this post, not a browse of the page.
    if ((!url || !thumbnail) && sourceId) {
      const hydrated = await hydrateVideo(sourceId, context, warnings);
      if (hydrated) {
        url = url || hydrated.source;
        permalink = permalink || hydrated.permalink;
        thumbnail = thumbnail || hydrated.picture;
      }
    }
    if (!url) {
      if (permalink) {
        warnings.push(
          'Facebook did not provide a downloadable file for one video; it links to the video on facebook.com instead.',
        );
        return {
          type: 'video',
          url: permalink,
          thumbnail,
          sourcePostId: context.postId,
          sourceId,
          title: media.title || undefined,
          permalink,
        };
      }
      warnings.push('One video attached to the post could not be read and was skipped.');
      return null;
    }
    return {
      type: 'video',
      url,
      thumbnail,
      sourcePostId: context.postId,
      sourceId,
      title: media.title || undefined,
      permalink,
    };
  }

  const imageUrl = upgradeCdnPath(firstHttpUrl([media.image?.src, media.source]) || '');
  if (!imageUrl) return null;
  return {
    type: 'image',
    url: imageUrl,
    thumbnail: imageUrl,
    sourcePostId: context.postId,
    sourceId,
    width: media.image?.width,
    height: media.image?.height,
    permalink: isHttpUrl(media.permalink_url) ? media.permalink_url : undefined,
  };
}

function firstHttpUrl(candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (isHttpUrl(candidate)) return candidate.trim();
  }
  return '';
}

async function hydrateVideo(
  videoId: string,
  context: { config: FacebookConfig; page: FacebookPageConfig },
  warnings: string[],
): Promise<{ source: string; picture: string; permalink?: string } | null> {
  for (const fields of [VIDEO_FIELDS, 'id,source,picture,permalink_url']) {
    try {
      const node = await graphRequest<any>(context.config, videoId, { fields }, context.page);
      return {
        source: isHttpUrl(node?.source) ? node.source : '',
        picture: firstHttpUrl([node?.picture, node?.thumbnails?.data?.[0]?.url]),
        permalink: isHttpUrl(node?.permalink_url) ? node.permalink_url : undefined,
      };
    } catch (err: any) {
      if (err instanceof FacebookImportError && err.fbCode === 190) throw err;
    }
  }
  warnings.push('One video attached to the post could not be read through the Facebook API and was skipped.');
  return null;
}

/** Follows subattachment pagination so a 20-photo post returns 20 photos. */
async function collectSubattachments(
  subattachments: any,
  context: { postId: string; config: FacebookConfig; page: FacebookPageConfig },
  warnings: string[],
): Promise<any[]> {
  const collected: any[] = [...(subattachments?.data || [])];
  let nextUrl = subattachments?.paging?.next || null;
  for (let hops = 0; nextUrl && hops < MAX_SUBATTACHMENT_PAGES; hops += 1) {
    const page: any = await graphNextPage(context.config, nextUrl);
    if (!page) break;
    collected.push(...(page.data || []));
    nextUrl = page.paging?.next || null;
  }
  return collected;
}

/**
 * Walks a single post node and returns its media in the order Facebook lists
 * it: each attachment's own media first, then that attachment's
 * subattachments. Nothing that is not attached to this node is visited.
 */
export async function extractMediaFromPostNode(
  node: any,
  context: {
    postId: string;
    config: FacebookConfig;
    page: FacebookPageConfig;
  },
): Promise<{ media: FacebookMediaItem[]; warnings: string[] }> {
  const warnings: string[] = [];
  const collected: FacebookMediaItem[] = [];
  const seen = new Set<string>();

  const push = (item: FacebookMediaItem | null) => {
    if (!item) return;
    if (!isHttpUrl(item.url)) return;
    const key = canonicalMediaKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    collected.push(item);
  };

  const attachments = node?.attachments?.data || [];
  for (const attachment of attachments) {
    const subattachments = await collectSubattachments(attachment?.subattachments, context, warnings);
    // For a multi-item attachment ("album", "video_array", ...) the
    // attachment's own `media` is a copy of the first subattachment, so
    // taking both would list the first photo twice. Subattachments are the
    // authoritative, complete list; only a single-item attachment is read
    // from its own `media`.
    if (subattachments.length) {
      for (const subattachment of subattachments) {
        push(
          await mediaFromAttachment(
            subattachment?.media || subattachment,
            attachment,
            context,
            warnings,
            { type: subattachment?.type ?? attachment?.type, id: subattachment?.target?.id },
          ),
        );
      }
      continue;
    }
    push(
      await mediaFromAttachment(attachment?.media, attachment, context, warnings, {
        type: attachment?.type,
        id: attachment?.target?.id,
      }),
    );
  }

  // A bare photo node (photo.php?fbid=...) has no attachments at all.
  if (!collected.length && !node?.attachments && node?.images) {
    const best = bestImageFromPhotoNode(node);
    if (best.url) {
      push({
        type: 'image',
        url: upgradeCdnPath(best.url),
        thumbnail: upgradeCdnPath(best.url),
        sourcePostId: context.postId,
        sourceId: String(node.id || '') || undefined,
        width: best.width,
        height: best.height,
      });
    }
  }

  // A bare video node.
  if (!collected.length && !node?.attachments && (node?.source || node?.picture)) {
    const source = isHttpUrl(node.source) ? node.source : '';
    const picture = firstHttpUrl([node.picture, node.thumbnails?.data?.[0]?.url]);
    if (source) {
      push({
        type: 'video',
        url: source,
        thumbnail: picture,
        sourcePostId: context.postId,
        sourceId: String(node.id || '') || undefined,
        title: node.title || undefined,
        permalink: isHttpUrl(node.permalink_url) ? node.permalink_url : undefined,
      });
    } else if (isHttpUrl(node.permalink_url)) {
      warnings.push('Facebook did not provide a downloadable file for this video; it links to the video on facebook.com instead.');
      push({
        type: 'video',
        url: node.permalink_url,
        thumbnail: picture,
        sourcePostId: context.postId,
        sourceId: String(node.id || '') || undefined,
        permalink: node.permalink_url,
      });
    }
  }

  // Last resort for a text post whose single image is only exposed as the
  // post's own picture. Never added when the attachments already gave us the
  // media, because that picture is just a copy of the first photo.
  if (!collected.length && isHttpUrl(node?.full_picture)) {
    const url = upgradeCdnPath(node.full_picture);
    push({
      type: 'image',
      url,
      thumbnail: url,
      sourcePostId: context.postId,
    });
  }

  return { media: collected, warnings };
}

/* ------------------------------------------------------------------ */
/* Albums (only ever the album the user explicitly linked to)          */
/* ------------------------------------------------------------------ */

async function importAlbum(albumId: string, parsed: ParsedFacebookUrl, config: FacebookConfig) {
  const warnings: string[] = [];
  const media: FacebookMediaItem[] = [];
  const seen = new Set<string>();

  for (const pageConfig of orderedPages(parsed, config)) {
    let cursor: any = null;
    try {
      cursor = await graphRequest<any>(
        config,
        `${albumId}/photos`,
        { fields: ALBUM_PHOTO_FIELDS, limit: SUBATTACHMENT_PAGE_SIZE },
        pageConfig,
      );
    } catch (err: any) {
      if (err instanceof FacebookImportError && isAppWideFailure(err)) throw err;
      continue;
    }

    for (let hop = 0; cursor && hop < MAX_SUBATTACHMENT_PAGES; hop += 1) {
      for (const photo of cursor.data || []) {
        const best = bestImageFromPhotoNode(photo);
        if (!best.url) continue;
        const key = canonicalMediaKey({ sourceId: String(photo.id || '') || undefined, url: best.url });
        if (seen.has(key)) continue;
        seen.add(key);
        const url = upgradeCdnPath(best.url);
        media.push({
          type: 'image',
          url,
          thumbnail: url,
          sourcePostId: String(photo.id || albumId),
          sourceId: String(photo.id || '') || undefined,
          width: best.width,
          height: best.height,
        });
      }
      if (!cursor.paging?.next) break;
      cursor = await graphNextPage(config, cursor.paging.next);
    }
    if (media.length) break;
  }

  return { media, warnings };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/** Kept for callers that only ask whether Facebook is set up. */
export function describeFacebookConfiguration(): { configured: boolean; pages: string[] } {
  const config = readFacebookConfig();
  return { configured: config.pages.length > 0, pages: config.pages.map((page) => page.label) };
}

/**
 * Resolve a user-supplied Facebook URL to ONE post and return exactly the
 * photos and videos attached to it. Throws a FacebookImportError with a
 * user-facing message for anything that goes wrong.
 */
export async function importFacebookPostMedia(inputUrl: string): Promise<FacebookImportResult> {
  const config = readFacebookConfig();
  if (!config.pages.length) {
    throw new FacebookImportError(
      'Facebook importing is not configured on this server. An administrator must set FACEBOOK_GFC_PAGE_ID and FACEBOOK_GFC_PAGE_ACCESS_TOKEN.',
      { status: 503, code: 'facebook_not_configured' },
    );
  }

  const sourceUrl = String(inputUrl ?? '').trim();
  if (!sourceUrl) {
    throw new FacebookImportError('A Facebook link is required.', {
      status: 400,
      code: 'invalid_request',
    });
  }

  const parsed = parseFacebookUrl(sourceUrl);
  if (!parsed) {
    throw new FacebookImportError(
      'That does not look like a Facebook link. Paste a link to a Facebook post, e.g. https://www.facebook.com/permalink.php?story_fbid=... or https://www.facebook.com/yourpage/posts/123456789.',
      { status: 400, code: 'invalid_facebook_url' },
    );
  }

  if (parsed.kind === 'page') {
    throw new FacebookImportError(PAGE_URL_MESSAGE, {
      status: 400,
      code: 'facebook_not_a_post',
    });
  }

  if (parsed.kind === 'share') {
    throw new FacebookImportError(
      'That is a Facebook /share/ short link, which Facebook does not expose through the Graph API. Open the post in the browser, choose "Copy link", and paste the full post link instead.',
      { status: 400, code: 'facebook_unresolvable_share' },
    );
  }

  if (parsed.kind === 'album') {
    const { media, warnings } = await importAlbum(parsed.albumId!, parsed, config);
    if (!media.length) {
      throw new FacebookImportError(
        'That Facebook album could not be read, or it is empty. Paste a link to a specific post instead.',
        { status: 404, code: 'facebook_no_media' },
      );
    }
    return {
      postId: parsed.albumId!,
      permalink: sourceUrl,
      sourceUrl,
      message: '',
      createdTime: '',
      albumName: 'Facebook Import',
      media,
      warnings,
    };
  }

  const { node, page } = await resolvePostNode(parsed, config);
  const postId = String(node?.id || parsed.nodeId || parsed.pfbid || '');
  const { media, warnings } = await extractMediaFromPostNode(node, {
    postId,
    config,
    page,
  });

  if (!media.length) {
    throw new FacebookImportError(
      'That post was found, but it has no photos or videos attached to it.',
      { status: 404, code: 'facebook_no_media' },
    );
  }

  const createdTime = String(node?.created_time || '');
  return {
    postId,
    permalink: isHttpUrl(node?.permalink_url) ? node.permalink_url : sourceUrl,
    sourceUrl,
    message: String(node?.message || ''),
    createdTime,
    albumName: deriveAlbumName(node?.message, createdTime),
    media,
    warnings,
  };
}

/** Derive an album name from the post text or its publish date. */
function deriveAlbumName(message: string, createdTime: string): string {
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Prefer a date-like first line, e.g. "September 17, 2026"
  const firstLine = String(message || '').trim().split(/\r?\n/)[0] || '';
  const m = firstLine.match(/([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (m) return `${m[1]} ${m[2]}, ${m[3]}`;

  if (createdTime) {
    const d = new Date(createdTime);
    if (!Number.isNaN(d.getTime())) {
      return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
  }

  return 'Facebook Import';
}
