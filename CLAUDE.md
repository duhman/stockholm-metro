# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies
- `npm run dev` — start the combined Express + Vite dev server on `http://localhost:3000` (runs `tsx server.ts`)
- `npm start` — production server: `NODE_ENV=production tsx server.ts`. Serves `dist/` statically and the `/api/*` routes. Run `npm run build` first.
- `npm run build` — Vite build of the SPA into `dist/`
- `npm run preview` — Vite preview of the built SPA (no API; use `npm start` for that)
- `npm run lint` — `tsc --noEmit` (no ESLint)
- `npm run clean` — remove `dist/`

There is no test suite configured.

## Architecture

A single-page Stockholm metro live-departures tracker. Frontend (React 19 + react-leaflet + Tailwind v4) and the Express API live in **the same process** — `server.ts` is the single entry point for both dev and prod.

### Server (`server.ts`)

- One Express app on port 3000 (override with `PORT`). In dev (`NODE_ENV !== "production"`) Vite is mounted as middleware via `createViteServer({ middlewareMode: true })` — there is no separate Vite dev server. In production, `dist/` is served statically. Both modes run through `tsx server.ts`.
- Routes (proxy the public **SL Transport API** at `https://transport.integration.sl.se/v1`):
  - `GET /api/departures?siteId=&timeWindow=` — `siteId` and `timeWindow` are validated by `src/server/validate.ts` (siteId: 1-7 digits; timeWindow: 1-1440). Invalid input returns `400`. Forwards to `/v1/sites/{siteId}/departures?transport_authority_id=1`.
  - `GET /api/ai-search?q=` — Gemini (`gemini-2.5-flash`) maps the free-form query to a metro station name, then filters the in-memory `/v1/sites` cache (24h TTL, `src/server/sites.ts`). Returns `503` when `GEMINI_API_KEY` is unset.
- `GoogleGenAI({ apiKey })` is constructed explicitly; if `GEMINI_API_KEY` is missing, `ai` is `null` and the search endpoint short-circuits.
- `dotenv` load order: `.env.local` first with `override: true`, then `.env`. `.env.local` is the recommended file for local secrets.
- `dns.setDefaultResultOrder("ipv4first")` is set for Node 18+ fetch IPv6 issues — keep it.

### Frontend (`src/`)

```
src/
  main.tsx                    entry; wraps <App/> in <ErrorBoundary> + <StrictMode>
  App.tsx                     ~80 lines; composition only
  index.css                   Tailwind v4 import + .custom-scrollbar
  types.ts                    Departure, Site, MetroRef
  api/sl.ts                   typed fetch wrappers (AbortSignal-aware)
  hooks/
    useDepartures.ts          30 s polling, AbortController, pauses on document.hidden
    useMetroGeoJSON.ts        loads /metro.geojson once, memoizes merged-by-ref lines
  lib/
    utils.ts                  cn() = clsx + tailwind-merge
    lines.ts                  colors, styleMetroLine, LINE_TERMINALS, matchTerminal
    trains.ts                 buildMergedLines + projectTrain (see below)
  components/
    ErrorBoundary.tsx
    Header.tsx                title + station label + search toggle
    SearchPanel.tsx           AI-search form + results
    DeparturesPanel.tsx       grouped-by-direction departures list
    MapView.tsx               MapContainer + TileLayer + GeoJSON layer + FitBounds
    StationMarker.tsx         hover-loads departures into the map tooltip
    LiveTrainLayer.tsx        renders projected trains, re-projects on a 5 s tick
  server/
    validate.ts               parseSiteId / parseTimeWindow / parseSearchQuery
    sites.ts                  cached SL /v1/sites loader
```

Key invariants:

- **METRO-only filter** lives in `useDepartures` (via `fetchDepartures` in `src/api/sl.ts`). The SL API returns buses/trams for the same site; the UI assumes metro-only.
- **Polling**: `useDepartures` polls every 30 s, cancels in-flight on `siteId` change/unmount, and skips network calls while `document.hidden`. Refresh on `visibilitychange`.
- **Default station** Gärdet (`SiteId 9221`) lives as `DEFAULT_SITE` in `src/App.tsx`.
- **Live train projection (`src/lib/trains.ts`).** This is the part that's easy to get wrong; see "Train projection rules" below.
- **Train tick.** `App.tsx` ticks every 5 s and passes the value to `LiveTrainLayer` so the projection re-evaluates against the current time without re-fetching departures.
- **Line colors** come from `colorForRef(ref)` (red = 13/14, green = 17/18/19, blue = 10/11). The legacy "match by Swedish group name" path is kept for departures-list bubbles via `tailwindBgForGroup`.
- **Site shape** (`{ SiteId, Name, X, Y, Type }`) is the legacy SL Search envelope. `src/server/sites.ts` reshapes the new SL Transport response into it. Treat `X`/`Y` of `"0"` as missing.

### Train projection rules (do not regress these)

Two bugs existed in the original `renderLiveTrains`. The current algorithm in `src/lib/trains.ts` corrects both — preserve them:

1. **Direction.** SL's `direction_code` is a *terminal indicator*, not "toward this station". The right anchor is `dep.destination` (the terminal name). `LINE_TERMINALS[ref]` gives the two terminals as `[start, end]` of the merged line; `matchTerminal(destination, terminals)` returns `0` or `1`. The train sits on the side of the station *opposite* the destination terminal.
2. **MultiLineString stitching.** The OSM dump in `public/metro.geojson` has **two relations per line** (one per direction), each split into many `MultiLineString` segments. Chaining everything together produces a closed loop that doubles the line length. `buildMergedLines` therefore picks one relation per line — the one whose `properties.from` matches `LINE_TERMINALS[ref][0]` — and chains only that relation's segments.
3. **Speed.** `AVG_SPEED_KM_PER_MIN = 0.6` (~36 km/h, includes stops). It's a deliberate approximation; don't bake it deeper into the architecture.

If you change `metro.geojson` or `LINE_TERMINALS`, re-verify with a one-off `tsx` script that mirrors `check-trains.ts` from the rewrite history: load the geojson, call `buildMergedLines`, project a known departure (e.g. line 13, dest=Ropsten, 4 min), and confirm the lat/lon makes geographic sense.

### Static data (`public/metro.geojson`)

Stockholm metro routes/relations exported from OSM via Overpass. Features can be `MultiLineString`, `Point`, or `MultiPoint`. `MapView` filters out point features before rendering, and `buildMergedLines` keys off `properties.ref` (10/11/13/14/17/18/19 only).

### Tailwind / TypeScript

- Tailwind v4 via `@tailwindcss/vite` plugin — no `tailwind.config.js`, no `postcss.config.js`, no `autoprefixer`. Custom utilities live in `src/index.css`.
- `tsconfig.json` sets `noEmit: true` and `allowImportingTsExtensions: true`. `server.ts` imports `./src/server/...ts` directly — that's why we need `tsx`, not `node`, for both dev and prod.
- The `cn()` helper at `src/lib/utils.ts` combines `clsx` + `tailwind-merge`.

## Conventions and gotchas

- Don't introduce a separate Vite dev server — the integrated middleware setup in `server.ts` is intentional.
- **Don't add `define: { 'process.env.GEMINI_API_KEY': ... }` back to `vite.config.ts`.** It would inline the server-only key into the client bundle. Gemini is server-side only.
- `vite.config.ts` honors `DISABLE_HMR=true` to disable HMR (used by AI Studio agent runs to prevent flicker during edits) — leave that branch in place.
- All API calls from the frontend go through `src/api/sl.ts`. Don't sprinkle raw `fetch("/api/...")` calls in components.
- All fetches that live across renders use `AbortController`. Match this when adding new ones.
- The `Site` shape on the wire is the legacy `{ SiteId, X, Y }` envelope. If you change the server response shape, update `src/api/sl.ts`, `src/types.ts`, and `MapView`'s `FitBounds` together.
- Keep validation tight: any new server route taking user input should use (or extend) `src/server/validate.ts` rather than interpolating raw query strings into upstream URLs.

## Environment variables

Configured via `.env.local` (preferred) or `.env`. See `.env.example`:

- `GEMINI_API_KEY` — optional. Enables `/api/ai-search`. Without it the search endpoint returns `503` and the rest of the app works.
- `PORT` — optional, defaults to `3000`.
- `APP_URL` — set automatically by AI Studio; not currently consumed by the code.
- `DISABLE_HMR=true` — disables Vite HMR (AI Studio agent flag).
