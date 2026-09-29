/**
 * Isang beses lang: ilipat ang data mula sa local JSON file papunta sa Turso.
 *
 * Bakit kailangan ito: kapag walang DATABASE_URL, gumagamit ang server ng
 * server/data/gfc_database.json. Kapag nakatakda na ang DATABASE_URL, Turso na
 * ang binabasa at hindi na makikita ang mga pagbabago galing sa JSON - kaya
 * "wala akong makita" sa admin habang nasa JSON lang ang data.
 *
 * Ang lahat ng data ay nasa iisang row (key = "db") ng gfc_admin_store table,
 * bilang isang JSON string - gaya ng ginagawa ng server/storage.ts.
 *
 * SAFETY: laging gumagawa ng backup ng kasalukuyang Turso row at ng JSON file
 * BAGO mag-write. May --dry-run para tingnan lang ang resulta.
 *
 * Paano gamitin:
 *   1) I-set ang DATABASE_URL at TURSO_AUTH_TOKEN sa .env
 *   2) npm run migrate:turso -- --dry-run     (tingnan lang)
 *   3) npm run migrate:turso                  (gawin)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JSON_FILE = path.join(ROOT, 'server', 'data', 'gfc_database.json');
const BACKUP_DIR = path.join(ROOT, 'server', 'data', 'backups');

const TABLE = 'gfc_admin_store';
const ROW_KEY = 'db';

const DRY_RUN = process.argv.includes('--dry-run');

// 1. Basahin ang .env (ito lang ang pinapansin namin - walang secrets na hardcoded).
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const TURSO_AUTH_TOKEN = (process.env.TURSO_AUTH_TOKEN || '').trim();

if (!DATABASE_URL || !/^libsql:\/\//.test(DATABASE_URL)) {
  console.error('❌ Walang DATABASE_URL (o hindi libsql://) - makikita ito sa .env');
  console.error('   Halimbawa: DATABASE_URL=libsql://<db>-<org>.turso.io');
  process.exit(1);
}
if (!TURSO_AUTH_TOKEN) {
  console.error('❌ Walang TURSO_AUTH_TOKEN - makikita ito sa .env');
  console.error('   Ito ang "Auth Token" sa Turso dashboard.');
  process.exit(1);
}

const { createClient } = await import('@libsql/client');
const client = createClient({ url: DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

// 2. Kailangan ang JSON file na siyang ililipat.
if (!fs.existsSync(JSON_FILE)) {
  console.error('❌ Walang JSON file:', JSON_FILE);
  console.error('   Ibig sabihin, wala pang local data na maipapadala.');
  process.exit(1);
}
const localData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

// 3. Ano ang nasa Turso ngayon?
await client.execute(
  `CREATE TABLE IF NOT EXISTS ${TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
);
const current = await client.execute({
  sql: `SELECT value FROM ${TABLE} WHERE key = ?`,
  args: [ROW_KEY],
});
const tursoData = current.rows.length ? JSON.parse(current.rows[0].value) : null;

const count = (data, key) => (Array.isArray(data?.[key]) ? data[key].length : 0);
const summarize = (data) =>
  data
    ? `events=${count(data, 'events')} photos=${count(data, 'photos')} ` +
      `siteEvents=${count(data, 'siteEvents')} dateAlbums=${Object.keys(data.eventDateAlbums || {}).length}`
    : '(walang row)';

console.log('   JSON file :', JSON_FILE);
console.log('               ', summarize(localData));
console.log('   Turso     :', summarize(tursoData));
console.log('');

if (JSON.stringify(tursoData) === JSON.stringify(localData)) {
  console.log('✅ Pantay na ang JSON at Turso. Walang kailangang gawin.');
  process.exit(0);
}

// 4. Backup BAGO mag-write. Ito ang nagse-save sa iyo kapag may nangyaring mali.
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonBackup = path.join(BACKUP_DIR, `gfc_database.json.${stamp}.bak`);
fs.copyFileSync(JSON_FILE, jsonBackup);
console.log('💾 Backup ng JSON file  :', jsonBackup);

let tursoBackup = null;
if (tursoData) {
  tursoBackup = path.join(BACKUP_DIR, `turso-before-migrate.${stamp}.json`);
  fs.writeFileSync(tursoBackup, JSON.stringify(tursoData, null, 2), 'utf-8');
  console.log('💾 Backup ng Turso data :', tursoBackup);
}

if (DRY_RUN) {
  console.log('');
  console.log('🔎 DRY RUN - walang sinusunat. Ipapadala sa Turso ang JSON file sa itaas.');
  console.log('   Alisin ang --dry-run kapag ready ka na.');
  process.exit(0);
}

// 5. Isulat ang JSON papunta sa Turso (ganito rin ang ginagawa ng storage.ts).
await client.execute({
  sql: `INSERT INTO ${TABLE} (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  args: [ROW_KEY, JSON.stringify(localData)],
});

// 6. Basahing muli para makumpirma na talaga ang na-save.
const verify = await client.execute({
  sql: `SELECT value FROM ${TABLE} WHERE key = ?`,
  args: [ROW_KEY],
});
if (!verify.rows.length) {
  console.error('❌ Hindi mabasa ang row pagkatapos ng write - hindi natapos ang migration.');
  process.exit(1);
}
const readBack = JSON.parse(verify.rows[0].value);
if (JSON.stringify(readBack) !== JSON.stringify(localData)) {
  console.error('❌ Hindi tugma ang binasa sa Turso at ang JSON file. Check ang backup sa:', BACKUP_DIR);
  process.exit(1);
}

console.log('');
console.log('✅ Tapos na ang migration. Nasa Turso na ang data.');
console.log('   ', summarize(readBack));
console.log('');
console.log('Susunod: i-restart ang dev server para mag-load ang bagong data.');
