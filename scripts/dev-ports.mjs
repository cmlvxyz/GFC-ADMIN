// dev-ports.mjs - sinasabi kung sino ang may hawak ng GFC ports.
//
// Ginagamit ng dev.js bago mag-start, para hindi na tayo makita ang
// "Port 3003 is in use, trying another one..." at dagre-drawing na ang
// admin sa 3005.
//
// HINDI nito pinapatay ang kahit anong process - report lang.

import net from 'node:net';
import http from 'node:http';
import os from 'node:os';
import { execFile } from 'node:child_process';

const isWindows = os.platform() === 'win32';

/** Fixed na ports ng GFC dev environment. Huwag itong palitan. */
export const GFC_PORTS = {
  backend: 4000, // API + upload server
  admin: 3003, // GFC admin
  site: 3002, // GFC public website
  hmrAdmin: 24678,
  hmrSite: 24679,
};

export const PORT_LABELS = {
  backend: 'backend / upload',
  admin: 'GFC admin',
  site: 'GFC website',
  hmrAdmin: 'admin HMR (websocket)',
  hmrSite: 'website HMR (websocket)',
};

function run(cmd, args) {
  return new Promise(resolve => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      resolve(err ? '' : String(stdout));
    });
  });
}

/** True kapag kayang mag-listen ang port (ibig sabihin walang naka-claim). */
export function isPortFree(port, host = '0.0.0.0') {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    try {
      server.listen(port, host);
    } catch {
      resolve(false);
    }
  });
}

async function processInfoWindows(pid) {
  const script =
    `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction SilentlyContinue; ` +
    `if ($p) { @{ name = $p.Name; command = $p.CommandLine } | ConvertTo-Json -Compress }`;
  const out = await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
  if (!out.trim()) return { pid, process: `pid ${pid}`, command: '' };
  try {
    const parsed = JSON.parse(out);
    return {
      pid,
      process: String(parsed.name || `pid ${pid}`).replace(/\.exe$/i, ''),
      command: String(parsed.command || ''),
    };
  } catch {
    return { pid, process: `pid ${pid}`, command: '' };
  }
}

async function processInfoUnix(port) {
  const out = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpct']);
  let pid = 0;
  let command = '';
  for (const line of out.split(/\r?\n/)) {
    if (line.startsWith('p')) {
      const value = Number(line.slice(1));
      if (Number.isFinite(value) && !pid) pid = value;
    }
    if (line.startsWith('c')) command = line.slice(1);
  }
  if (!pid) return null;
  return { pid, process: command || `pid ${pid}`, command: command ? `lsof: ${command}` : '' };
}

async function findListeningPid(port) {
  if (isWindows) {
    const out = await run('netstat', ['-ano', '-p', 'TCP']);
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const match = line.match(/:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
      if (match && Number(match[1]) === port) return Number(match[2]);
    }
    return 0;
  }
  const info = await processInfoUnix(port);
  return info ? info.pid : 0;
}

/** GET /api/health para malaman kung ito ba ang GFC backend. */
export function probeHealth(port, timeoutMs = 2000) {
  return new Promise(resolve => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/api/health', timeout: timeoutMs },
      res => {
        let body = '';
        res.on('data', chunk => {
          body += chunk;
          if (body.length > 8192) res.destroy();
        });
        res.on('end', () => resolve({ status: res.statusCode, body }));
        res.on('error', () => resolve(null));
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

// Nakikita kung ang process na naka-claim ay isa sa GFC dev processes.
function looksLikeGfc(command) {
  if (!command) return false;
  return /gfc-admin|Desktop[\\/]GFC|dev\.js|server\.ts|[\\/]GFC[\\/]/i.test(command);
}

/**
 * Buong estado ng isang port: libre ba, sino ang may hawak, at GFC ba ito.
 */
export async function describePort(port) {
  const free = await isPortFree(port);
  if (free) return { port, free: true, pid: 0, process: '', command: '', gfc: false };

  const pid = await findListeningPid(port);
  let info = { pid, process: `pid ${pid}`, command: '' };
  if (pid) {
    info = isWindows ? await processInfoWindows(pid) : await processInfoUnix(port) || info;
  }

  const health = port === GFC_PORTS.backend ? await probeHealth(port) : null;
  const gfc = looksLikeGfc(info.command) || Boolean(health && /GFC/i.test(health.body));

  return { port, free: false, pid: info.pid, process: info.process, command: info.command, gfc, health };
}

/** Lahat ng GFC ports sa isang pagkakataon. */
export async function describeAllPorts() {
  const entries = await Promise.all(
    Object.entries(GFC_PORTS).map(async ([key, port]) => {
      const state = await describePort(port);
      return { key, label: PORT_LABELS[key], ...state };
    }),
  );
  return entries;
}

/** Isang blocks na madaling basahin, walang ANSI codes. */
export function formatBlockers(blockers) {
  if (!blockers.length) return '';
  const lines = [];
  for (const b of blockers) {
    lines.push(`  PORT ${b.port} (${b.label})`);
    lines.push(`    process : ${b.process}${b.pid ? ` (pid ${b.pid})` : ''}`);
    if (b.command) {
      const short = b.command.length > 160 ? `${b.command.slice(0, 157)}...` : b.command;
      lines.push(`    command : ${short}`);
    }
  }
  return lines.join('\n');
}
