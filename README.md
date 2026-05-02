# Stockholm Metro Tracker

Live Tunnelbana departures with on-map train positions, powered by the public [SL Transport API](https://www.trafiklab.se/api/our-apis/sl/transport/) and a small Express + React 19 app.

The default view is Gärdet; you can search by address or landmark, and the map projects the next trains along the line geometry from OpenStreetMap.

## Run locally

Requires Node.js 20+.

```sh
npm install
npm run dev    # http://localhost:3000 (Express + Vite middleware)
```

For production:

```sh
npm run build  # builds the SPA into dist/
npm start      # serves dist/ + the API via Express on port 3000
```

## Configuration

`.env.local` (preferred) or `.env`. See `.env.example`.

- `GEMINI_API_KEY` — optional. Enables natural-language search ("central station" → T-Centralen) via Gemini. Without it the `/api/ai-search` endpoint returns 503; departures and the map still work.
- `PORT` — optional, defaults to `3000`.

## Scripts

- `npm run dev` — start Express + Vite middleware on port 3000.
- `npm run build` — build the SPA into `dist/`.
- `npm run preview` — Vite-only preview (no API).
- `npm start` — production: serves `dist/` + API.
- `npm run lint` — `tsc --noEmit`.
- `npm run clean` — remove `dist/`.

## Attribution

- Departures and station data: [Storstockholms Lokaltrafik](https://sl.se/) via the SL Transport API.
- Metro line geometry: © OpenStreetMap contributors (extracted from the `route=subway` relations under `network=SL`).
- Basemap tiles: © [CARTO](https://carto.com/attributions).
