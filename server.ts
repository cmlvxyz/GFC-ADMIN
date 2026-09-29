import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { apiRouter } from './server/routes.ts';
import { dbManager } from './server/db.ts';

const app = express();
const PORT = process.env.PORT || 4000;

/**
 * The public GFC website (Desktop/GFC) and the admin UI are served from
 * different origins, so the API has to accept both. CORS_ORIGIN accepts a
 * comma-separated allowlist; "*" (or an unset value) allows any origin, which
 * is what the public read-only site needs.
 */
  const corsAllowlist = (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  /**
   * On a home network the site is also opened as http://192.168.x.x:3002 (or
   * from a phone), so a localhost-only allowlist makes the API reject every
   * request and the public site renders empty. Accept any private/loopback host
   * on the dev ports in addition to the explicit allowlist.
   */
  const isLanDevOrigin = (origin: string): boolean => {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return false;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (!['3002', '3003'].includes(url.port)) return false;
    const host = url.hostname;
    if (host === 'localhost' || host === '::1') return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    return false;
  };

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsAllowlist.includes('*') || corsAllowlist.includes(origin)) {
        return callback(null, true);
      }
      if (isLanDevOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsers
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Request logger for API calls
app.use('/api', (req, res, next) => {
  console.log(`[API ${req.method}] ${req.originalUrl}`);
  next();
});

// Mount unified REST API router
app.use('/api', apiRouter);

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  // Load the database before accepting requests, so no request ever sees
  // an empty/half-loaded state. Storage degrades to JSON if Turso is down,
  // so a database outage must never stop the admin from serving.
  try {
    await dbManager.init();
  } catch (err) {
    console.error('[GFC System] Database init failed, continuing with fallback:', err);
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const listener = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[GFC System] Server running at http://0.0.0.0:${PORT}`);
  });

  // Ang upload/API port ay nakatakda - huwag lumipat sa 4001 para hindi
  // masira ang QR/upload links at ang proxy ng admin.
  listener.on('error', (err: NodeJS.ErrnoException) => {
    if (err?.code === 'EADDRINUSE') {
      console.error('');
      console.error(`✖ Port ${PORT} is already in use.`);
      console.error('  Stop the existing upload server/process before starting GFC.');
      console.error('  Para makita kung sino ang may hawak:  npm run ports');
      console.error('');
    } else {
      console.error('[GFC System] Listen failed:', err);
    }
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('[GFC System] Failed to start server:', err);
});
