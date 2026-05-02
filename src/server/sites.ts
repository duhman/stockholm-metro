interface RawSite {
  id: number;
  name: string;
  lat?: number;
  lon?: number;
}

export interface SiteResult {
  SiteId: string;
  Name: string;
  Type: "Station";
  X: string;
  Y: string;
}

const SITES_URL = "https://transport.integration.sl.se/v1/sites";
const TTL_MS = 24 * 60 * 60 * 1000;

let cache: RawSite[] = [];
let cacheTime = 0;
let inflight: Promise<RawSite[]> | null = null;

async function loadSites(): Promise<RawSite[]> {
  const response = await fetch(SITES_URL);
  if (!response.ok) {
    throw new Error(`SL sites endpoint returned ${response.status}`);
  }
  const data = (await response.json()) as RawSite[];
  cache = data;
  cacheTime = Date.now();
  return data;
}

export async function getSites(): Promise<RawSite[]> {
  if (cache.length > 0 && Date.now() - cacheTime < TTL_MS) {
    return cache;
  }
  if (!inflight) {
    inflight = loadSites().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function shapeSite(site: RawSite): SiteResult {
  return {
    SiteId: String(site.id),
    Name: site.name,
    Type: "Station",
    X: site.lon != null ? String(site.lon) : "0",
    Y: site.lat != null ? String(site.lat) : "0",
  };
}

export function searchSites(sites: RawSite[], query: string, limit = 10): SiteResult[] {
  const q = query.toLowerCase();
  const out: SiteResult[] = [];
  for (const site of sites) {
    if (!site.name.toLowerCase().includes(q)) continue;
    out.push(shapeSite(site));
    if (out.length >= limit) break;
  }
  return out;
}
