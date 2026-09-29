# GFC Admin

Admin dashboard + backend para sa **Gospel Fellowship Church (GFC)**.
Nakikita nito ang events, photos (QR upload), tithes & offering ledger,
website CMS, members, at announcements.

## Stack

- **Frontend** — React 19 + Vite + Tailwind (SPA)
- **Backend** — `server.ts` (Express) + `server/routes.ts` (REST API)
- **Data layer** — `server/db.ts` + `server/storage.ts` (Turso/libsql, JSON fallback)
- **Database** — Turso (libsql) via `DATABASE_URL` / `TURSO_AUTH_TOKEN`
- **Photos** — Facebook Graph API (GFC Page + NextGen Ignite Page)
- **Deploy** — Render

> `server.ts` ang tunay na backend. Ang `dist/` build nito ang
> nagsiserve, kasama ang `/upload` page (na hawak ng SPA).

## Local development

Prerequisites: Node.js >= 20

1. I-install ang dependencies:
   ```bash
   npm install
   ```
2. Gawin ang `.env` (kopyahin mula sa `.env.example`) at punan ang
   `DATABASE_URL`, `TURSO_AUTH_TOKEN`, at ang Facebook tokens.
3. Patakbuhin:
   ```bash
   npm run dev
   ```

| URL | Description |
| --- | --- |
| `http://localhost:3003` | Admin dashboard (Vite dev server) |
| `http://localhost:4000` | Backend API + `/upload` page |
| `http://localhost:3002` | Church site (GFC, hiwalay na repo) |

`npm run dev` ay gumagamit ng `dev.js` — pinapatakbo nito ang backend at
ang Vite dev server nang sabay, at awtomatikong itinuturo ang QR/upload
link sa LAN IP (para ma-scan ng phone sa parehong WiFi).

## Church website (GFC)

Ang website ng GFC (`Desktop/GFC`) ay nakakabit sa **same API** ng admin —
walang sariling backend, walang hiwalay na database. Isang Render service
lang ang kailangan.

Para gumana ang website, itakda ang `VITE_API_URL` nang **build time**
(dahil ina-inline ito ng Vite):

```bash
# website
VITE_API_URL=https://<admin>.onrender.com npm run build
```

### Mga endpoint para sa website

| Endpoint | Gamit |
| --- | --- |
| `GET /api/content` | Lahat ng collections sa isang payload, kasama ang events na may `dateEntries` |
| `POST /api/uploads` | Base64 photo papunta sa date album ng event |
| `GET /api/photo?u=<url>` | Image proxy |
| `GET /api/activities/stream` | Live activity feed (SSE) |
| `GET/POST /api/:collection` | Read/write ng website collections |
| `PATCH/PUT/DELETE /api/:collection/:id` | Edit/delete ng isang record |

Ang mga `:collection` na allowed ay: `sermons`, `prayers`, `members`,
`testimonials`, `aboutImages`, `ministries`, `pastors`, `songs`,
`aboutInfo`, `verses`, `giveInfo`, `siteSettings`.

### Paano gumagana ang photo sync

Kapag nag-**upload sa admin** (`GFCPublicUploadView`), nilalagyan ang photo
ng `albumDate` (hal. `August 18, 2026`) at `eventId`. Ipinuproject ito ng
`server/compat.ts` bilang `dateEntries` — kaya **automatic na lalabas sa
website** ang upload, walang kailangang i-import nang mano.

Kapag nag-**upload sa website** (`/upload` page ng GFC), tinatanggap ng
`POST /api/uploads` ang base64 image at ginagawa itong regular na photo sa
parehong database.

> Ang parehong landas ay nagsusulat ng buong bilang ng base64 image sa iisang
> JSON snapshot. Maliit lang ang datos ito, ngunit malaki ang mga tunay na
> upload — dapat mag-install ng object storage (Turso blob o Cloudflare R2)
> *before* magamit sa produksyon.

## Build

```bash
npm run build   # -> dist/
npm start       # tsx server.ts
```

## Deploy sa Render

1. Push ang code sa GitHub.
2. Sa Render: **New + > Web Service > Connect repo**.
3. Gamitin ang settings:

   | Field | Value |
   | --- | --- |
   | Runtime | Node |
   | Build Command | `npm ci && npm run build` |
   | Start Command | `npm start` |
   | Health Check Path | `/api/health` |

   Oras i-set ang mga ito sa `render.yaml`.

4. I-set ang **Environment Variables** (lahat ng secrets):

   ```
   NODE_ENV=production
   CORS_ORIGIN=https://<gfc-site-domain>
   ADMIN_USERNAME=...
   ADMIN_PASSWORD=...
   ADMIN_TOKEN_SECRET=...
   DATABASE_URL=libsql://...
   TURSO_AUTH_TOKEN=...
   FACEBOOK_GRAPH_VERSION=v26.0
   FACEBOOK_GFC_PAGE_ID=...
   FACEBOOK_GFC_PAGE_ACCESS_TOKEN=...
   FACEBOOK_NEXTGEN_PAGE_ID=...
   FACEBOOK_NEXTGEN_PAGE_ACCESS_TOKEN=...
   ```

5. I-deploy.

### Importante sa Render

- **Kailangan ang `DATABASE_URL` + `TURSO_AUTH_TOKEN`.** Read-only ang
  filesystem ng Render, kaya kapag wala ang database, mawawala ang mga
  upload at bibigay ang bawat restart.
- **Kung may Turso outage, hindi mamamatay ang app.** Awtomatikong
  mag-fallback sa local JSON file at mag-log ng babala. Pero ang data ay
  **hindi na shared** habang naka-down ang Turso — ayusin ang Turso bago
  mag-save ng maraming data.
- **Hindi kailangang i-set ang `VITE_API_URL`.** Ang `server.ts` ang
  nagsiserve ng SPA, kaya ang `/api` base URL ay automatically tama sa
  `window.location.origin`. Kung gusto mong i-pin, i-set ang
  `VITE_GFC_URL` (hal. `https://gfc-admin.onrender.com`) para sabihin sa
  QR code/upload link kung saang host dapat magpunta.
- **Free plan** ay natutulog pagkatong ng 15 min ng walang activity. Para
  hindi ma-sleep, gamitin ang Render cron job na nagta-tatanggap ng `GET`
  sa `/api/health` kada 10 minuto.

## Facebook import

### Token check (gawin mo ito bago mag-import)

```bash
npm run facebook:token              # buhay pa ba ang token?
npm run facebook:check -- "<link>"  # readable ba ang post na ito?
```

Kapag `❌ EXPIRED`, kailangan ng bagong Page Access Token.

### Pag-expire ng token

Ang Page token ay may takdang panahon, kaya periodic na itong mapalitan.
Kapag expired, si Facebook ang sumasagot ng `190 / sub 463` at ang app ay
nagpapakita ng petsa kung kailan ito nag-expire.

Muling token gamitin ang **Graph API Explorer** (developers.facebook.com/tools/explorer):

1. Pumili ng app, then **Get Token** →
   `pages_show_list, pages_read_engagement, pages_manage_posts`
2. **Get App Token** (o ang app secret) para mag-**extend**:
   `GET /oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={user-token}`
3. Kunin ang Page token:
   `GET /me/accounts?fields=id,name,access_token&access_token={long-lived-user-token}`
4. Itakda ang `access_token` bilang `FACEBOOK_GFC_PAGE_ACCESS_TOKEN` (o
   `FACEBOOK_NEXTGEN_PAGE_ACCESS_TOKEN`) sa `.env`, tapos i-restart ang server.

Pagkatapos, patakbuhin muli ang `npm run facebook:token` para makita na ✅.

> **Hindi sapat ang short-lived token** mula sa Explorer para sa pang-araw
> araw na gamit - ito ang sanhi ng paulit-ulit na pag-expire.

## Database

Lahat ng data ay nasa iisang row ng `gfc_admin_store` table (key `db`,
JSON value) sa Turso:

```sql
CREATE TABLE IF NOT EXISTS gfc_admin_store (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Kapag walang `DATABASE_URL` (o kung unavailable), gumagamit ang server ng
JSON file sa `server/data/gfc_database.json` — para lang ito sa local dev.

> Ang table ay `gfc_admin_store`, hindi `gfc_store`. Hiwalay ito sa legacy
> data na nasa `gfc_store` (galing sa lumang backend na `server.js`).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Backend + Vite dev server (`dev.js`) |
| `npm run build` | Production build ng frontend → `dist/` |
| `npm start` | Production server (`tsx server.ts`) |
| `npm run lint` | Type check (`tsc --noEmit`) |
| `npm run clean` | Burahin ang `dist/` |
