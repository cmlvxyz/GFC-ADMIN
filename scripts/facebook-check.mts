/**
 * Subukan ang isang Facebook link nang walang binubuksan ang admin UI.
 *
 * Gamit:  npm run facebook:check -- "https://www.facebook.com/..."
 *
 * Bakit ito mayroon: sa browser ang nakikita mo lang ay "403 Forbidden",
 * na hindi nagsasabi kung dahil sa link o sa token. Ito ang nagpapakita ng
 * tunay na sagot ng Facebook at kung aling hakbang ang pumalya.
 */

import 'dotenv/config';
import { importFacebookPostMedia, FacebookImportError } from '../server/facebook';

const input = process.argv[2];

if (!input) {
  console.error('Gamit: npm run facebook:check -- "<facebook link>"');
  process.exit(1);
}

const pageId = (process.env.FACEBOOK_GFC_PAGE_ID || '').trim();
const token = (process.env.FACEBOOK_GFC_PAGE_ACCESS_TOKEN || '').trim();

if (!token) {
  console.error('❌ Walang FACEBOOK_GFC_PAGE_ACCESS_TOKEN sa .env');
  process.exit(1);
}

console.log('link     :', input);
console.log('page id  :', pageId || '(wala)');
console.log('');

try {
  const result = await importFacebookPostMedia(input);
  const images = result.media.filter((item) => item.type === 'image');
  const videos = result.media.filter((item) => item.type === 'video');

  console.log('✅ Natagpuan ang post');
  console.log('   post id  :', result.postId);
  console.log('   permalink:', result.permalink);
  console.log('   date     :', result.createdTime || '(wala)');
  console.log('   album    :', result.albumName);
  console.log('   media    :', result.media.length, `(${images.length} image, ${videos.length} video)`);
  for (const item of result.media) {
    console.log(`     - [${item.type}] ${item.url}`);
  }
  if (result.warnings.length) {
    console.log('');
    console.log('⚠️  Babala:');
    for (const warning of result.warnings) console.log('   -', warning);
  }
  process.exitCode = 0;
} catch (err: any) {
  console.log('❌ Hindi mabuksan ang post');
  if (err instanceof FacebookImportError) {
    console.log('   code    :', err.code);
    console.log('   status  :', err.status);
    console.log('   fb code :', err.fbCode ?? 'n/a');
    console.log('   dahil   :', err.message);
  } else {
    console.log('   error   :', err?.message || err);
  }
  process.exitCode = 1;
}
