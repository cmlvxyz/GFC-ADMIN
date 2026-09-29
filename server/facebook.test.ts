/**
 * Tests for the Facebook post media importer.
 *
 * The Graph API is replaced with a stub fetch, so these tests never touch
 * Facebook and never need a real token. Run with:  npm test
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  importFacebookPostMedia,
  parseFacebookUrl,
  FacebookImportError,
  photoStorageKey,
} from './facebook.ts';

const PAGE_ID = '1074232749116315';
const PAGE_OWNER_ID = '61590579395623';
const TOKEN = 'EAAG-test-page-access-token-DO-NOT-LEAK';
const VERSION = 'v26.0';

const PFBID = 'pfbid02rv8UPGj8Tta5f2VD3eoAcuLcjNJ4UWNGGZjm7wpNKUzZhnsSAafeqb4iaVqAJuhAl';
const PERMALINK_URL = `https://www.facebook.com/permalink.php?story_fbid=${PFBID}&id=${PAGE_OWNER_ID}`;

const CDN = (name: string) =>
  `https://scontent.xx.fbcdn.net/v/t39.30819-6/${name}.jpg?stp=dst-jpg&_nc_cat=1&oe=${TOKEN.length}aBcDeF`;

const POST_ID = `${PAGE_ID}_900100000000001`;

/**
 * These builders mirror the shape the real Graph API returns for
 * `attachments{id,type,media,subattachments{id,type,target,media}}`:
 * an attachment `media` cannot be field expanded, so it has no `type`/`id`
 * of its own, and on a multi-photo post it repeats the first subattachment.
 */
const photoMedia = (id: string) => ({
  image: { src: CDN(id), width: 1080, height: 720 },
});

const videoMedia = (id: string) => ({
  source: `https://video.xx.fbcdn.net/v/${id}.mp4`,
  picture: CDN(`${id}-poster`),
  permalink_url: `https://www.facebook.com/reel/${id}`,
});

const photoSub = (id: string) => ({ type: 'photo', target: { id, url: `https://www.facebook.com/photo/?fbid=${id}` }, media: photoMedia(id) });
const videoSub = (id: string) => ({ type: 'video', target: { id, url: `https://www.facebook.com/reel/${id}` }, media: videoMedia(id) });
/** A video attachment, as Facebook really returns it: a stub with no file. */
const videoStubSub = (id: string) => ({ type: 'video', target: { id }, media: { permalink_url: `https://www.facebook.com/reel/${id}` } });

/** A single-photo post. */
const singlePhoto = (id: string) => ({ type: 'photo', target: { id }, media: photoMedia(id) });

/** A multi-photo post: the attachment repeats the first subattachment. */
const photoAlbum = (...ids: string[]) => ({
  type: 'album',
  media: photoMedia(ids[0]),
  subattachments: { data: ids.map(photoSub) },
});

/** Graph error payload, as Facebook returns it. */
const fbError = (code: number, message: string, subcode = 0) => ({
  error: { message, type: 'GraphMethodException', code, error_subcode: subcode },
});

const NOT_FOUND = fbError(100, 'Unsupported get request. Object with ID does not exist');

let requested: string[] = [];
const realFetch = globalThis.fetch;

/** Routes Graph requests to canned responses. */
function stubFetch(handler: (url: URL) => unknown) {
  globalThis.fetch = (async (input: any) => {
    const url = new URL(String(input));
    requested.push(url.toString());
    const body = handler(url);
    return {
      ok: !(body as any)?.error,
      status: (body as any)?.error ? 400 : 200,
      text: async () => JSON.stringify(body),
    } as any;
  }) as any;
}

beforeEach(() => {
  requested = [];
  process.env.FACEBOOK_GRAPH_VERSION = VERSION;
  process.env.FACEBOOK_GFC_PAGE_ID = PAGE_ID;
  process.env.FACEBOOK_GFC_PAGE_ACCESS_TOKEN = TOKEN;
  delete process.env.FACEBOOK_NEXTGEN_PAGE_ID;
  delete process.env.FACEBOOK_NEXTGEN_PAGE_ACCESS_TOKEN;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

async function expectFailure(promise: Promise<unknown>): Promise<FacebookImportError> {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof FacebookImportError, `expected FacebookImportError, got ${err}`);
    return err;
  }
  throw new Error('expected the import to fail, but it succeeded');
}

/* ------------------------------------------------------------------ */

describe('parseFacebookUrl', () => {
  test('reads a permalink.php post link without asking for a post id', () => {
    const parsed = parseFacebookUrl(PERMALINK_URL);
    assert.equal(parsed?.kind, 'post');
    assert.equal(parsed?.pfbid, PFBID);
    assert.equal(parsed?.ownerId, PAGE_OWNER_ID);
  });

  test('reads /{page}/posts/{id} links', () => {
    const parsed = parseFacebookUrl('https://www.facebook.com/gospelfellowshipchurch/posts/1234567890');
    assert.equal(parsed?.kind, 'post');
    assert.equal(parsed?.nodeId, '1234567890');
    assert.equal(parsed?.ownerId, 'gospelfellowshipchurch');
  });

  test('reads /{page}/posts/{pfbid} links', () => {
    const parsed = parseFacebookUrl(`https://www.facebook.com/gfc/posts/${PFBID}`);
    assert.equal(parsed?.kind, 'post');
    assert.equal(parsed?.pfbid, PFBID);
    assert.equal(parsed?.ownerId, 'gfc');
  });

  test('reads reel and video links as videos', () => {
    for (const url of [
      'https://www.facebook.com/reel/10153231379946729',
      'https://www.facebook.com/gfc/reel/10153231379946729',
      'https://www.facebook.com/gfc/reels/10153231379946729',
      'https://www.facebook.com/watch/?v=10153231379946729',
    ]) {
      const parsed = parseFacebookUrl(url);
      assert.equal(parsed?.kind, 'video', url);
      assert.equal(parsed?.nodeId, '10153231379946729', url);
    }
  });

  test('reads /share/p/{pfbid} links', () => {
    const parsed = parseFacebookUrl(`https://www.facebook.com/share/p/${PFBID}/`);
    assert.equal(parsed?.kind, 'post');
    assert.equal(parsed?.pfbid, PFBID);
  });

  test('flags /share/r short codes as unresolvable shares', () => {
    const parsed = parseFacebookUrl('https://www.facebook.com/share/r/abcXYZ');
    assert.equal(parsed?.kind, 'share');
  });

  test('flags a bare page link as a page, not a post', () => {
    assert.equal(parseFacebookUrl('https://www.facebook.com/gospelfellowshipchurch')?.kind, 'page');
    assert.equal(parseFacebookUrl('https://www.facebook.com/')?.kind, 'page');
  });

  test('rejects non-Facebook links', () => {
    assert.equal(parseFacebookUrl('https://example.com/permalink.php?story_fbid=1&id=2'), null);
    assert.equal(parseFacebookUrl('not a link'), null);
  });

  test('reads photo.php and video links', () => {
    assert.equal(parseFacebookUrl('https://www.facebook.com/photo.php?fbid=1234567890')?.kind, 'photo');
    assert.equal(parseFacebookUrl('https://www.facebook.com/gfc/videos/1234567890')?.kind, 'video');
  });
});

/* ------------------------------------------------------------------ */

describe('importFacebookPostMedia - TEST 1: a post with several photos', () => {
  test('returns exactly the photos of that post, and nothing else', async () => {
    const post = {
      id: POST_ID,
      message: 'Sunday Worship\nThank you everyone',
      created_time: '2026-09-20T09:00:00+0000',
      permalink_url: PERMALINK_URL,
      // The post picture is a copy of the first photo and must not be added twice.
      full_picture: CDN('photo1'),
      attachments: { data: [photoAlbum('photo1', 'photo2', 'photo3', 'photo4')] },
    };
    stubFetch((url) => {
      if (url.pathname.includes(PFBID)) return post;
      if (url.pathname.endsWith('/posts')) return fbError(100, 'no feed match');
      return NOT_FOUND;
    });

    const result = await importFacebookPostMedia(PERMALINK_URL);
    assert.equal(result.media.length, 4);
    assert.deepEqual(
      result.media.map((m) => m.sourceId),
      ['photo1', 'photo2', 'photo3', 'photo4'],
    );
    assert.ok(result.media.every((m) => m.type === 'image'));
    assert.ok(result.media.every((m) => m.sourcePostId === POST_ID));
    // The album label follows the post text, else its publish date.
    assert.equal(result.albumName, 'September 20, 2026');
  });
});

/* ------------------------------------------------------------------ */

describe('importFacebookPostMedia - TEST 2: a post with photos and a video', () => {
  test('keeps both types, in the order Facebook lists them', async () => {
    const post = {
      id: POST_ID,
      message: 'Service recap',
      created_time: '2026-09-20T09:00:00+0000',
      permalink_url: PERMALINK_URL,
      full_picture: CDN('photo1'),
      attachments: {
        data: [
          {
            type: 'album',
            media: photoMedia('photo1'),
            subattachments: {
              // The video arrives as a stub: no file, only the object to read.
              data: [photoSub('photo1'), photoSub('photo2'), videoStubSub('video1'), photoSub('photo3')],
            },
          },
        ],
      },
    };
    stubFetch((url) => {
      if (url.pathname === `/${VERSION}/video1`) {
        return {
          id: 'video1',
          source: 'https://video.xx.fbcdn.net/v/t42.72000/video1.mp4?oh=00&oe=66',
          picture: CDN('video1-poster'),
          permalink_url: 'https://www.facebook.com/reel/video1',
        };
      }
      if (url.pathname.includes(PFBID)) return post;
      if (url.pathname.endsWith('/posts')) return fbError(100, 'no feed match');
      return NOT_FOUND;
    });

    const result = await importFacebookPostMedia(PERMALINK_URL);
    assert.equal(result.media.length, 4);
    assert.deepEqual(result.media.map((m) => m.type), ['image', 'image', 'video', 'image']);
    assert.deepEqual(result.media.map((m) => m.sourceId), ['photo1', 'photo2', 'video1', 'photo3']);

    const video = result.media[2];
    assert.equal(video.url, 'https://video.xx.fbcdn.net/v/t42.72000/video1.mp4?oh=00&oe=66');
    assert.equal(video.thumbnail, CDN('video1-poster'));
    assert.equal(video.sourcePostId, POST_ID);
  });
});

/* ------------------------------------------------------------------ */

describe('importFacebookPostMedia - TEST 3: a post with one video', () => {
  test('returns the video with its playable source', async () => {
    stubFetch((url) => {
      if (url.pathname === `/${VERSION}/1234567890`) {
        return {
          id: '1234567890',
          type: 'video',
          source: 'https://video.xx.fbcdn.net/v/vid777.mp4',
          picture: CDN('vid777-poster'),
        };
      }
      return NOT_FOUND;
    });

    const result = await importFacebookPostMedia('https://www.facebook.com/gfc/videos/1234567890');
    assert.equal(result.media.length, 1);
    assert.equal(result.media[0].type, 'video');
    assert.equal(result.media[0].url, 'https://video.xx.fbcdn.net/v/vid777.mp4');
  });
});

/* ------------------------------------------------------------------ */

describe('importFacebookPostMedia - TEST 4: a page URL', () => {
  test('refuses a page link without calling Facebook at all', async () => {
    stubFetch(() => {
      throw new Error('the importer must not call Facebook for a page link');
    });

    const err = await expectFailure(
      importFacebookPostMedia('https://www.facebook.com/gospelfellowshipchurch'),
    );
    assert.equal(err.status, 400);
    assert.equal(err.code, 'facebook_not_a_post');
    assert.match(err.message, /specific post/i);
    assert.equal(requested.length, 0, 'no Facebook calls should be made for a page link');
  });
});

/* ------------------------------------------------------------------ */

describe('importFacebookPostMedia - TEST 5: an inaccessible post', () => {
  test('explains that the post cannot be read', async () => {
    stubFetch(() => NOT_FOUND);
    const err = await expectFailure(importFacebookPostMedia(PERMALINK_URL));
    assert.equal(err.status, 404);
    assert.match(err.message, /could not be found|private/i);
  });

  test('reports a missing permission distinctly from a missing post', async () => {
    stubFetch(() => fbError(200, 'This endpoint requires permission', 10));
    const err = await expectFailure(importFacebookPostMedia(PERMALINK_URL));
    assert.equal(err.status, 403);
    assert.equal(err.code, 'facebook_permission_denied');
  });

  test('reports an invalid token distinctly', async () => {
    stubFetch(() => fbError(190, 'Invalid OAuth access token.'));
    const err = await expectFailure(importFacebookPostMedia(PERMALINK_URL));
    assert.equal(err.status, 401);
    assert.equal(err.code, 'facebook_token_invalid');
  });

  test('reports rate limiting', async () => {
    stubFetch(() => fbError(4, 'Application request limit reached.'));
    const err = await expectFailure(importFacebookPostMedia(PERMALINK_URL));
    assert.equal(err.status, 429);
  });

  test('never leaks the access token in an error', async () => {
    stubFetch(() => fbError(190, `Invalid OAuth access token. (${TOKEN})`));
    const err = await expectFailure(importFacebookPostMedia(PERMALINK_URL));
    assert.ok(!err.message.includes(TOKEN), 'the token must not appear in the error message');
  });
});

/* ------------------------------------------------------------------ */

describe('importFacebookPostMedia - TEST 6: nested subattachments', () => {
  test('follows subattachment pagination and keeps post order', async () => {
    const secondPageUrl = `https://graph.facebook.com/${VERSION}/900100000000002/subattachments?after=cursor`;
    const post = {
      id: POST_ID,
      message: 'Retreat 2026',
      created_time: '2026-09-13T09:00:00+0000',
      permalink_url: PERMALINK_URL,
      attachments: {
        data: [
          {
            type: 'album',
            media: photoMedia('a1'),
            subattachments: {
              // a1 is repeated by the attachment itself and must not double up.
              data: [photoSub('a1'), photoSub('a2')],
              paging: { next: secondPageUrl },
            },
          },
          {
            type: 'video_array',
            media: videoMedia('b1'),
            subattachments: { data: [videoStubSub('b1'), videoStubSub('b2')] },
          },
          singlePhoto('c1'),
        ],
      },
    };
    stubFetch((url) => {
      if (url.toString() === secondPageUrl) {
        return { data: [photoSub('a3'), photoSub('a4')] };
      }
      if (url.pathname === `/${VERSION}/b1` || url.pathname === `/${VERSION}/b2`) {
        return { id: url.pathname.split('/').pop(), source: 'https://video.xx.fbcdn.net/v/b.mp4', picture: CDN('b-poster') };
      }
      if (url.pathname.includes(PFBID)) return post;
      if (url.pathname.endsWith('/posts')) return fbError(100, 'no feed match');
      return NOT_FOUND;
    });

    const result = await importFacebookPostMedia(PERMALINK_URL);
    assert.deepEqual(result.media.map((m) => m.sourceId), ['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'c1']);
    assert.deepEqual(result.media.map((m) => m.type), [
      'image', 'image', 'image', 'image', 'video', 'video', 'image',
    ]);
    assert.ok(result.media.every((m) => m.sourcePostId === POST_ID));
    // A single post was read; the page feed was never used as a media source.
    assert.equal(
      requested.filter((u) => u.includes('/posts?')).length,
      0,
      'the page feed should not be queried when the post resolves directly',
    );
  });

  test('finds a permalink.php post by its pfbid when it is not directly addressable', async () => {
    const postId = `${PAGE_ID}_900100000000009`;
    const post = {
      id: postId,
      message: 'Found in the feed',
      created_time: '2026-09-06T09:00:00+0000',
      permalink_url: PERMALINK_URL,
      attachments: { data: [singlePhoto('z1')] },
    };
    stubFetch((url) => {
      // The feed is only an index: it returns identifiers, and the one post it
      // identifies is then read for its media.
      if (url.pathname === `/${VERSION}/${postId}`) return post;
      if (url.pathname.endsWith('/posts') && url.searchParams.get('fields')) {
        assert.match(String(url.searchParams.get('fields')), /^id,permalink_url/);
        assert.ok(!url.searchParams.get('fields')?.includes('attachments'), 'the scan must not pull media');
        return { data: [{ id: postId, permalink_url: PERMALINK_URL }] };
      }
      return NOT_FOUND;
    });

    const result = await importFacebookPostMedia(PERMALINK_URL);
    assert.equal(result.media.length, 1);
    assert.equal(result.media[0].sourceId, 'z1');
  });

  test('does not fall back to an unrelated post when the pfbid matches nothing', async () => {
    stubFetch((url) => {
      if (url.pathname.endsWith('/posts') && url.searchParams.get('fields')) {
        return {
          data: [
            {
              id: `${PAGE_ID}_111`,
              permalink_url: 'https://www.facebook.com/gfc/posts/111',
              attachments: { data: [singlePhoto('other-post')] },
            },
          ],
        };
      }
      return NOT_FOUND;
    });

    const err = await expectFailure(importFacebookPostMedia(PERMALINK_URL));
    assert.equal(err.code, 'facebook_post_not_found');
    assert.ok(
      !JSON.stringify(err.message).includes('other-post'),
      'unrelated media must never be reported',
    );
  });
});

/* ------------------------------------------------------------------ */

describe('importFacebookPostMedia - never returns an unrelated post', () => {
  // Regression: the Graph API answers a request for an object id it does not
  // recognise with a DIFFERENT, perfectly valid object. A "<page id>_<pfbid>"
  // for an unknown pfbid came back as an unrelated post of the same page. If
  // that answer were trusted, pasting one link would import another post's
  // photos - exactly what this importer must never do.
  test('rejects a node that is not the post that was requested', async () => {
    const unrelated = {
      id: `${PAGE_ID}_122145897975352646`,
      permalink_url: 'https://www.facebook.com/122142918375352646/posts/122145897975352646',
      attachments: { data: [singlePhoto('someone-elses-photo')] },
    };
    stubFetch((url) => {
      if (url.pathname.endsWith('/posts') && url.searchParams.get('fields')) {
        return { data: [] }; // the feed does not contain the wanted post either
      }
      if (url.pathname.endsWith('_') || url.pathname.includes(PFBID)) return unrelated;
      return NOT_FOUND;
    });

    const err = await expectFailure(importFacebookPostMedia(PERMALINK_URL));
    assert.equal(err.code, 'facebook_post_not_found');
    assert.ok(!err.message.includes('someone-elses-photo'));
  });

  test('accepts the requested post once the feed confirms it', async () => {
    const wantedId = `${PAGE_ID}_900100000000010`;
    const wanted = {
      id: wantedId,
      permalink_url: PERMALINK_URL,
      created_time: '2026-09-20T09:00:00+0000',
      attachments: { data: [singlePhoto('right-photo')] },
    };
    stubFetch((url) => {
      if (url.pathname === `/${VERSION}/${wantedId}`) return wanted;
      if (url.pathname.endsWith('/posts') && url.searchParams.get('fields')) {
        return { data: [{ id: wantedId, permalink_url: PERMALINK_URL }] };
      }
      if (url.pathname.includes(PFBID)) {
        return {
          id: `${PAGE_ID}_999`,
          permalink_url: 'https://www.facebook.com/other/posts/999',
          attachments: { data: [singlePhoto('wrong-photo')] },
        };
      }
      return NOT_FOUND;
    });

    const result = await importFacebookPostMedia(PERMALINK_URL);
    assert.deepEqual(result.media.map((m) => m.sourceId), ['right-photo']);
  });
});

/* ------------------------------------------------------------------ */

describe('importFacebookPostMedia - other outcomes', () => {
  test('rejects a link that is not a Facebook URL', async () => {
    stubFetch(() => {
      throw new Error('no Facebook call should be made for an invalid URL');
    });
    const err = await expectFailure(importFacebookPostMedia('https://instagram.com/p/abc'));
    assert.equal(err.status, 400);
    assert.equal(err.code, 'invalid_facebook_url');
    assert.equal(requested.length, 0);
  });

  test('explains that a /share/ short link cannot be read', async () => {
    const err = await expectFailure(importFacebookPostMedia('https://www.facebook.com/share/r/abc123'));
    assert.equal(err.code, 'facebook_unresolvable_share');
  });

  test('reports a text-only post as having no media', async () => {
    stubFetch((url) => {
      if (url.pathname.includes(PFBID)) {
        return {
          id: POST_ID,
          permalink_url: PERMALINK_URL,
          message: 'Prayer meeting tonight',
          created_time: '2026-09-20T09:00:00+0000',
        };
      }
      return NOT_FOUND;
    });
    const err = await expectFailure(importFacebookPostMedia(PERMALINK_URL));
    assert.equal(err.code, 'facebook_no_media');
    assert.match(err.message, /no photos or videos/i);
  });

  test('never duplicates the same image twice', async () => {
    const post = {
      id: POST_ID,
      created_time: '2026-09-20T09:00:00+0000',
      permalink_url: PERMALINK_URL,
      full_picture: CDN('dup'),
      attachments: {
        data: [{
          type: 'photo_array',
          media: photoMedia('dup'),
          subattachments: { data: [photoSub('dup'), photoSub('other')] },
        }],
      },
    };
    stubFetch((url) => {
      if (url.pathname.includes(PFBID)) return post;
      return NOT_FOUND;
    });

    const result = await importFacebookPostMedia(PERMALINK_URL);
    assert.deepEqual(result.media.map((m) => m.sourceId), ['dup', 'other']);
  });

  test('never returns a fabricated URL or the token', async () => {
    const post = {
      id: POST_ID,
      created_time: '2026-09-20T09:00:00+0000',
      permalink_url: PERMALINK_URL,
      attachments: { data: [{ type: 'link', media: { id: 'l1', type: 'link' } }] },
    };
    stubFetch((url) => {
      if (url.pathname.includes(PFBID)) return post;
      return NOT_FOUND;
    });

    const err = await expectFailure(importFacebookPostMedia(PERMALINK_URL));
    assert.equal(err.code, 'facebook_no_media');

    // Every URL we do hand back must be a real one Facebook gave us.
    stubFetch((url) => {
      if (url.pathname.includes(PFBID)) {
        return {
          id: POST_ID,
          created_time: '2026-09-20T09:00:00+0000',
          permalink_url: PERMALINK_URL,
          attachments: { data: [{ type: 'photo', media: photoMedia('real1') }] },
        };
      }
      return NOT_FOUND;
    });
    const ok = await importFacebookPostMedia(PERMALINK_URL);
    assert.ok(ok.media.every((m) => m.url.startsWith('https://scontent.xx.fbcdn.net/')));
    assert.ok(!JSON.stringify(ok).includes(TOKEN));
  });

  test('warns instead of inventing a file when a video has no source', async () => {
    const post = {
      id: POST_ID,
      created_time: '2026-09-20T09:00:00+0000',
      permalink_url: PERMALINK_URL,
      // No downloadable file anywhere, not even on the video object itself.
      attachments: { data: [{ type: 'video', target: { id: 'v404' }, media: { permalink_url: 'https://www.facebook.com/reel/v404' } }] },
    };
    stubFetch((url) => {
      if (url.pathname === `/${VERSION}/v404`) {
        return { id: 'v404', permalink_url: 'https://www.facebook.com/reel/v404' };
      }
      if (url.pathname.includes(PFBID)) return post;
      return NOT_FOUND;
    });

    const result = await importFacebookPostMedia(PERMALINK_URL);
    assert.equal(result.media.length, 1);
    assert.equal(result.media[0].type, 'video');
    assert.equal(result.media[0].url, 'https://www.facebook.com/reel/v404');
    assert.ok(result.warnings.length > 0);
  });
});

/**
 * Duplicate detection relies on comparing the immutable part of a CDN URL.
 * Facebook re-signs the query string on every read, so the same picture is
 * served under a different full URL each time; without normalizing, a re-import
 * would silently double the gallery.
 */
describe('photoStorageKey', () => {
  test('the same picture with different signed query params is one key', () => {
    const first = CDN('pic-a');
    const second = `https://scontent.xx.fbcdn.net/v/t39.30819-6/pic-a.jpg?stp=dst-jpg&_nc_cat=2&oe=totallyDifferent`;
    assert.notEqual(first, second);
    assert.equal(photoStorageKey(first), photoStorageKey(second));
  });

  test('different pictures stay distinct', () => {
    assert.notEqual(photoStorageKey(CDN('pic-a')), photoStorageKey(CDN('pic-b')));
  });

  test('is case-insensitive', () => {
    const upper = CDN('pic-a').replace('/v/t39.', '/V/T39.');
    assert.equal(photoStorageKey(upper), photoStorageKey(CDN('pic-a')));
  });

  test('non-CDN urls are compared whole, so a query change matters', () => {
    assert.notEqual(
      photoStorageKey('https://gfc.org/photos/a?v=1'),
      photoStorageKey('https://gfc.org/photos/a?v=2'),
    );
  });

  test('empty and missing urls yield an empty key, never throw', () => {
    assert.equal(photoStorageKey(''), '');
    assert.equal(photoStorageKey('   '), '');
    assert.equal(photoStorageKey(undefined), '');
    assert.equal(photoStorageKey(null), '');
  });

  test('lookaside crawler urls are normalized like scontent', () => {
    const a = 'https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=1&oh=AAA&oe=BBB';
    const b = 'https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=1&oh=ZZZ&oe=YYY';
    assert.equal(photoStorageKey(a), photoStorageKey(b));
  });

  test('base64 data urls are compared byte for byte, never case folded', () => {
    // Two uploads that differ only in case are genuinely different images.
    // Case folding here would collapse them and silently drop a real photo.
    const a = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAAAQAbCdEf';
    const b = 'data:image/jpeg;base64,/9j/4aaqskzrzgabaaaqabcdEf';
    assert.notEqual(photoStorageKey(a), photoStorageKey(b));

    // Identical bytes always give an identical key, so a re-select of the same
    // file is still recognised as a duplicate.
    assert.equal(photoStorageKey(a), photoStorageKey(a));
  });

  test('inline uploads are returned verbatim, as urls', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    assert.equal(photoStorageKey(dataUrl), dataUrl);
  });
});
