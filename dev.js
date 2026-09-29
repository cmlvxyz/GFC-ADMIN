// dev.js - runs the GFC-ADMIN backend + vite dev server together.
//
// Fixed ports (hindi nagbabago):
//   4000 = backend / API + upload
//   3003 = GFC admin
//   3002 = GFC public website
//
// Bago mag-start, sinusuri nito kung libre na ang ports at sino ang may
// hawak. Hindi ito kahit kailan pumapatay ng process - iniisap lang, para
// hindi na tayo magkaroon ng Vite server na tahimik na lumipat sa 3004+.

import { spawn } from 'node:child_process';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { describeAllPorts, formatBlockers, GFC_PORTS } from './scripts/dev-ports.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viteBin = path.resolve(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
const SITE_PORT = GFC_PORTS.site;
const ADMIN_PORT = GFC_PORTS.admin;
const BACKEND_PORT = GFC_PORTS.backend;

// Hanapin ang LAN IPv4 ng PC para i-point ang QR/upload link sa isang address na
// maaabot ng phone (same WiFi), kahit localhost ang pagbukas ng admin.
function getLanIPv4() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push(net);
    }
  }
  const priv = candidates.filter(n =>
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address) && !/^169\.254\./.test(n.address)
  );
  return (priv[0]?.address) || (candidates[0]?.address) || '';
}

function findSiteDir() {
  const home = os.homedir();
  const candidates = [
    process.env.GFC_SITE_DIR,
    path.resolve(__dirname, '..', 'GFC'),            // sibling folder
    path.join(home, 'Desktop', 'GFC'),
    path.join(home, 'Downloads', 'GFC'),
  ].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'node_modules', 'vite', 'bin', 'vite.js'))) return dir;
  }
  return null;
}

const siteDir = findSiteDir();
const LAN_IP = getLanIPv4();

// ─────────────────────────────────────────────────────────────────────────────
// Pre-flight: huwag mag-start kung may sagabal.
// ─────────────────────────────────────────────────────────────────────────────
const states = await describeAllPorts();
const byKey = Object.fromEntries(states.map(s => [s.key, s]));

const required = [byKey.backend, byKey.admin];
if (siteDir) required.push(byKey.site);

const busy = required.filter(s => !s.free);
const foreign = busy.filter(s => !s.gfc);
const hmrBusy = states.filter(s => s.key.startsWith('hmr') && !s.free);

if (foreign.length) {
  console.error('');
  console.error('✖ Hindi ma-start: may ibang process sa mga fixed na port.');
  console.error('');
  console.error(formatBlockers(foreign));
  console.error('');
  console.error('Ang GFC dev environment ay may nakatakdang port:');
  console.error(`  ${BACKEND_PORT} = backend / API + upload`);
  console.error(`  ${ADMIN_PORT}  = GFC admin`);
  console.error(`  ${SITE_PORT}  = GFC public website`);
  console.error('');
  console.error('Dahil hindi namin pinapatay ang mga ibang application,');
  console.error('isara mo ang gumagamit ng port na yan, saka ulitin.');
  console.error('Para makita kung ano ang naka-claim:  npm run ports');
  console.error('');
  process.exit(1);
}

if (busy.length) {
  const backendUp = byKey.backend.health && byKey.backend.health.status === 200;
  const allUp = busy.length === required.length;

  if (allUp && backendUp) {
    console.log('');
    console.log('✔ Nakatakbo na ang GFC dev environment. Hindi ko muna magsisimula');
    console.log('  para hindi magkaroon ng duplicate process sa bawat port.');
    console.log('');
    console.log(`  GFC website : http://localhost:${SITE_PORT}`);
    console.log(`  GFC admin   : http://localhost:${ADMIN_PORT}`);
    console.log(`  API / upload : http://localhost:${BACKEND_PORT}`);
    if (LAN_IP) {
      console.log('');
      console.log(`  QR / upload sa phone (same WiFi): http://${LAN_IP}:${BACKEND_PORT}/upload`);
    }
    console.log('');
    console.log('  Para i-stop ang umiiral na instance, pindutin ang Ctrl+C sa');
    console.log('  terminal na nagpatakbo nito.');
    console.log('');
    process.exit(0);
  }

  console.error('');
  console.error('✖ Bahagi lang ng GFC dev environment ang nakatakbo:');
  console.error('');
  console.error(formatBlockers(busy));
  console.error('');
  console.error('Hindi ako magsisimula ng pangalawang instance - magiging');
  console.error('mali ang mga URL at magkakaroon ng port conflict.');
  console.error('');
  console.error('I-stop muna ang nasa itaas (Ctrl+C sa terminal nila), saka');
  console.error('patakbuhin muli:  npm run dev');
  console.error('');
  process.exit(1);
}

if (hmrBusy.length) {
  console.warn('');
  console.warn('⚠ May prosesong gumagamit ng HMR websocket port:');
  console.warn(formatBlockers(hmrBusy));
  console.warn('  Maaaring hindi gumana ang live-reload. Hindi ito humahadlang sa start.');
  console.warn('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Lahat libre -> start.
// ─────────────────────────────────────────────────────────────────────────────
const children = [];
let shutting = false;

function shutdown(code) {
  if (shutting) return;
  shutting = true;
  for (const c of children) {
    if (!c.killed) {
      try { c.kill(); } catch { /* ignore */ }
    }
  }
  setTimeout(() => process.exit(code ?? 0), 400);
}

function watch(child, name) {
  child.on('exit', (code, signal) => {
    console.log(`[dev] ${name} exited (code=${code}, signal=${signal})`);
    if (!shutting) {
      if (signal !== 'SIGTERM' && code !== 0) {
        console.error(`[dev] ${name} crashed. Stopping everything...`);
      }
      shutdown(code || 0);
    }
  });
}

// strictPort sa CLI din: kahit may balewala na config, hindi na lalipat ang port.
const viteArgs = [
  `--port=${ADMIN_PORT}`,
  '--strictPort',
  '--host=0.0.0.0',
];
if (process.env.GFC_NO_OPEN !== '1') viteArgs.push('--open');

// Auto-set ang base URL ng QR/upload sa LAN IP (hindi na kailangan i-edit ang .env)
const viteEnv = { ...process.env };
if (!viteEnv.VITE_GFC_URL) {
  if (LAN_IP) {
    viteEnv.VITE_GFC_URL = `http://${LAN_IP}:${BACKEND_PORT}`;
    console.log(`[dev] QR/upload link points to: http://${LAN_IP}:${BACKEND_PORT} (phone, same WiFi)`);
    console.log(`[dev]   admin: http://${LAN_IP}:${ADMIN_PORT}  |  upload: http://${LAN_IP}:${BACKEND_PORT}/upload`);
  } else {
    console.warn('[dev] Hindi mahanap ang LAN IP - set VITE_GFC_URL sa .env.development');
  }
}

const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], { cwd: __dirname, stdio: 'inherit' });
const vite = spawn(process.execPath, [viteBin, ...viteArgs], { cwd: __dirname, stdio: 'inherit', env: viteEnv });

children.push(server, vite);
watch(server, 'backend (server.ts)');
watch(vite, 'vite (admin)');

// Also bring up the church website (Desktop/GFC) so "Preview Live Website"
// always has something to open. It is a separate repo, so it must not be able
// to take the admin down with it.
if (siteDir) {
  const site = spawn(
    process.execPath,
    [
      path.join(siteDir, 'node_modules', 'vite', 'bin', 'vite.js'),
      `--port=${SITE_PORT}`,
      '--strictPort',
      '--host=0.0.0.0',
    ],
    { cwd: siteDir, stdio: 'inherit' }
  );
  children.push(site);
  // Detached: the admin keeps running even if the site crashes or is closed.
  site.on('exit', (code, signal) => {
    if (!shutting) console.warn(`[dev] website (GFC) exited (code=${code}, signal=${signal}) - admin still running`);
  });
  console.log(`[dev]   website: http://localhost:${SITE_PORT}  (from ${siteDir})`);
} else {
  console.warn('[dev] Website (GFC) not found - "Preview Live Website" will not work.');
  console.warn('[dev]   Looked in Desktop/GFC, Downloads/GFC, and ../GFC.');
  console.warn('[dev]   Set GFC_SITE_DIR to point somewhere else.');
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
process.on('SIGBREAK', () => shutdown());
process.on('exit', () => {
  for (const c of children) {
    if (!c.killed) { try { c.kill(); } catch { /* ignore */ } }
  }
});
