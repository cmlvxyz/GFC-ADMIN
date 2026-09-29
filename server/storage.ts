import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const DB_FILE = path.join(DATA_DIR, 'gfc_database.json');

const TABLE = 'gfc_admin_store';
const ROW_KEY = 'db';

const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const IS_LIBSQL = /^(libsql:\/\/|wss:\/\/|ws:\/\/|file:)/.test(DATABASE_URL);

let client: any = null;
let mode: 'turso' | 'json' = 'json';
let initializing: Promise<void> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();
let announcedJson = false;

function fallbackToJson(reason: string) {
  console.error(`[GFC DB] Turso unavailable (${reason}) - falling back to local JSON file.`);
  console.error('[GFC DB] Writes will NOT be shared across instances/restarts until Turso recovers.');
  mode = 'json';
  client = null;
}

async function connect(): Promise<void> {
  if (mode === 'turso') return;

  if (!DATABASE_URL) {
    mode = 'json';
    if (!announcedJson) {
      announcedJson = true;
      console.log('[GFC DB] No DATABASE_URL - using local JSON file:', DB_FILE);
    }
    return;
  }

  if (!IS_LIBSQL) {
    mode = 'json';
    console.warn('[GFC DB] DATABASE_URL is not a libsql:// URL - using local JSON file instead.');
    console.warn('[GFC DB] Turso URLs look like: libsql://<db>-<org>.turso.io');
    return;
  }

  try {
    const { createClient } = await import('@libsql/client');
    const c = createClient({
      url: DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
    await c.execute(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
    );
    client = c;
    mode = 'turso';
    console.log('[GFC DB] Connected to Turso/libsql');
  } catch (err: any) {
    fallbackToJson(err?.message || 'connection failed');
  }
}

async function ensureClient(): Promise<void> {
  if (mode === 'turso') return;
  if (!initializing) {
    initializing = connect().finally(() => {
      initializing = null;
    });
  }
  await initializing;
}

function readJsonFile(): unknown {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) return null;
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (err) {
    console.error('[GFC DB] Error reading local JSON file:', err);
    return null;
  }
}

function writeJsonFile(data: unknown): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[GFC DB] Failed to write local JSON file:', err);
  }
}

export async function storageMode(): Promise<'turso' | 'json'> {
  await ensureClient();
  return mode;
}

export async function storageLoad(): Promise<unknown | null> {
  await ensureClient();

  if (mode === 'turso') {
    try {
      const result = await client.execute({
        sql: `SELECT value FROM ${TABLE} WHERE key = ?`,
        args: [ROW_KEY],
      });
      if (result.rows.length) return JSON.parse(result.rows[0].value as string);
    } catch (err: any) {
      console.error('[GFC DB] Turso read failed:', err?.message || err);
      fallbackToJson('read failed');
      return readJsonFile();
    }
    return null;
  }

  return readJsonFile();
}

export async function storageSave(data: unknown): Promise<void> {
  await ensureClient();

  if (mode === 'turso') {
    // Serialize writes so concurrent requests cannot clobber each other.
    writeQueue = writeQueue.then(async () => {
      try {
        await client.execute({
          sql: `INSERT INTO ${TABLE} (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          args: [ROW_KEY, JSON.stringify(data)],
        });
      } catch (err: any) {
        // Keep the data locally so a transient Turso outage does not lose it,
        // and degrade to JSON mode for the rest of this process.
        console.error('[GFC DB] Turso write failed:', err?.message || err);
        fallbackToJson('write failed');
        writeJsonFile(data);
      }
    });
    await writeQueue;
    return;
  }

  writeJsonFile(data);
}


/** Wait for any queued Turso writes to land. Useful on shutdown. */
export async function storageFlush(): Promise<void> {
  await writeQueue;
}
