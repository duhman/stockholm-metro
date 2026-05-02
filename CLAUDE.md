# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies
- `npm run dev` — start the combined Express + Vite dev server on `http://localhost:3000` (runs `tsx server.ts`)
- `npm run lint` — type-check only (`tsc --noEmit`); there is no ESLint
- `npm run build` — build the frontend with Vite into `dist/`
- `npm run preview` — Vite preview of the built frontend (does **not** run the API; use `npm start` for a full prod-mode server)
- `npm start` — run `server.ts` directly via Node; expects `dist/` to exist (static-serves it when `NODE_ENV=production`)
- `npm run clean` — remove `dist/`

There is no test suite configured.

## Architecture

This is a single-page Stockholm metro live-departures tracker. The frontend (React 19 + react-leaflet + Tailwind v4) and the Express API live in the **same process** — `server.ts` is the single entry point for both dev and prod.

### Server / API (`server.ts`)

- One Express app on port 3000. In dev (`NODE_ENV !== "production"`) it mounts Vite as middleware (`createViteServer({ middlewareMode: true })`); there is no separate Vite dev server. In production it serves `dist/` statically. This is why every workflow goes through `tsx server.ts` rather than `vite`.
- API routes proxy the public **SL Transport API** (`https://transport.integration.sl.se/v1`):
  - `GET /api/departures?siteId=&timeWindow=` → `/v1/sites/{siteId}/departures?transport_authority_id=1`
  - `GET /api/search?q=` → filters an in-memory cache of `/v1/sites` (24h TTL) and reshapes results into the legacy `{ SiteId, Name, X, Y }` envelope the frontend expects (`StatusCode/ResponseData`).
  - `GET /api/ai-search?q=` → asks Gemini (`gemini-2.5-flash`) to map a free-form query to an exact Tunnelbana station name, then runs the same site filter. Returns `503`-ish error if `GEMINI_API_KEY` is unset (the `ai` client is `null`).
- `dns.setDefaultResultOrder("ipv4first")` is set to work around Node 18+ IPv6 fetch issues — keep it.
- Env loading order: `dotenv/config` (.env), then `.env.local` (overrides). `.env.local` is the recommended file for local secrets.

### Frontend (`src/App.tsx`)

Almost everything lives in this one ~500-line component. Notable patterns:

- **Departures are filtered to METRO only** (`dep.line.transport_mode === "METRO"`) — the SL API returns buses/trams/etc. for the same site, and the UI assumes metro-only.
- **Auto-refresh**: a `setInterval(fetchDepartures, 30000)` polls every 30s; reset whenever `siteId` changes.
- **Default station** is hard-coded to Gärdet (`SiteId: "9221"`, `lat 59.348`, `lon 18.102`).
- **Live train positions** (`renderLiveTrains`) are computed client-side: `metro.geojson` (fetched from `/metro.geojson`) provides the line geometry; for each upcoming departure we use turf.js (`nearestPointOnLine`, `along`, `length`) to project the train along the line based on `(expected_arrival_time - now) * 0.6 km/min`. `direction_code === 1` moves *toward* the station (subtract distance); other directions move *away* (add). Spatial errors are swallowed silently — OSM line data is messy.
- **Line colors** are mapped from the Swedish group name (`röda`/`gröna`/`blå`) to red/green/blue, both as Tailwind classes (`getLineColor`) and hex (`getLineColorHex`). The GeoJSON line styler (`styleMetroLine`) instead matches by `properties.ref`: 13/14 → red, 17/18/19 → green, 10/11 → blue.
- Search uses `/api/ai-search` (Gemini-powered), not the literal `/api/search`. The plain endpoint exists but isn't currently wired into the UI.

### Static data (`public/metro.geojson`)

Stockholm metro routes/relations exported from OSM via Overpass (see `fetch-osm.js` for an unfinished helper). Features can be `MultiLineString` or `Point`/`MultiPoint`; `App.tsx` filters out point features before rendering and reduces multilinestrings to their first coordinate array when computing train positions.

### Tailwind / TypeScript

- Tailwind v4 via `@tailwindcss/vite` plugin — no `tailwind.config.js`. Custom utilities (e.g. `.custom-scrollbar`) live in `src/index.css`.
- `cn()` helper at `src/lib/utils.ts` combines `clsx` + `tailwind-merge`.
- `tsconfig.json` sets `noEmit: true` and `allowImportingTsExtensions: true`; the path alias `@/*` resolves to the project root (not `src/`).

## Conventions and gotchas

- Don't introduce a separate Vite dev server — the integrated middleware setup in `server.ts` is intentional.
- The Vite config exposes `process.env.GEMINI_API_KEY` to the client bundle via `define`. The current code only uses Gemini server-side (`server.ts`); avoid relying on the client-side define for new code, since it would leak the key.
- `vite.config.ts` honors `DISABLE_HMR=true` to disable HMR (used by AI Studio agent runs to prevent flicker during edits) — leave that branch in place.
- The frontend's `Site` shape (`{ SiteId, Name, Type, X, Y }`) is the legacy SL Search API envelope; the server reshapes the new SL Transport response to match. If you change the backend response shape, update `App.tsx` and `MapUpdater` together (they both parse `X`/`Y` as floats and treat `0` as "missing").
- `fetch-osm.js` and `test-sites2.js` are exploratory scripts, not part of the runtime.

## Environment variables

Configured via `.env.local` (preferred) or `.env`. See `.env.example`:

- `GEMINI_API_KEY` — required for `/api/ai-search`; without it the endpoint returns an error but the rest of the app works.
- `APP_URL` — set automatically by AI Studio; not currently consumed by the code.
