/**
 * Tsekan kung buhay pa ang Facebook Page token.
 *
 * Gamit:  npm run facebook:token
 *
 * Mas mabilis ito kaysa mag-import: kapag expired na, ibang sabi ng Facebook
 * ("Session has expired on ...") kaysa sa "not found" o "permission denied",
 * kaya mali mong naaalam na iniisip mo na sira na ang link.
 */

import 'dotenv/config';

const GRAPH_VERSION = (process.env.FACEBOOK_GRAPH_VERSION || 'v26.0').trim();
const HOST = 'https://graph.facebook.com';

const TOKENS: { label: string; envKey: string; pageIdKey: string }[] = [
  {
    label: 'GFC page',
    envKey: 'FACEBOOK_GFC_PAGE_ACCESS_TOKEN',
    pageIdKey: 'FACEBOOK_GFC_PAGE_ID',
  },
  {
    label: 'NextGen page',
    envKey: 'FACEBOOK_NEXTGEN_PAGE_ACCESS_TOKEN',
    pageIdKey: 'FACEBOOK_NEXTGEN_PAGE_ID',
  },
];

const check = async (token: string) => {
  const url = `${HOST}/${GRAPH_VERSION}/me?fields=id,name,followers_count&access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  return (await response.json()) as any;
};

let anyValid = false;

for (const { label, envKey, pageIdKey } of TOKENS) {
  const token = (process.env[envKey] || '').trim();
  const configuredId = (process.env[pageIdKey] || '').trim();

  console.log(`\n=== ${label} (${envKey}) ===`);

  if (!token) {
    console.log('  (naka-set ang token sa .env)');
    continue;
  }

  const data = await check(token);

  if (data.error) {
    const sub = Number(data.error.error_subcode) || 0;
    const expiresAt = Number(data.error.error_data?.expires_time);
    if (sub === 463 || Number(data.error.code) === 190) {
      console.log('  ❌ EXPIRED');
      if (Number.isFinite(expiresAt) && expiresAt > 0) {
        console.log('     expired at :', new Date(expiresAt * 1000).toISOString());
      }
      console.log('     fb error   :', data.error.code + (sub ? ` / sub ${sub}` : ''));
      // Facebook puts the expiry date in the message text, not error_data.
      if (data.error.message) {
        console.log('     sabi ni FB :', String(data.error.message).slice(0, 160));
      }
    } else {
      console.log('  ❌ HINDI GANDA ang token');
      console.log('     fb error   :', data.error.code, '-', data.error.message);
    }
    if (configuredId) console.log('     page id    :', configuredId);
    continue;
  }

  anyValid = true;
  console.log('  ✅ VALID');
  console.log('     page       :', data.name, `(${data.id})`);
  if (configuredId && configuredId !== data.id) {
    console.log('     ⚠️  ${pageIdKey} ay', configuredId, 'pero ang token ay para sa', data.id);
  }
}

console.log(
  anyValid
    ? '\nPuwedeng mag-import na.\n'
    : '\nWalang gumagana na token - kailangan ng bago. Tingnan ang README "Facebook import".\n',
);
