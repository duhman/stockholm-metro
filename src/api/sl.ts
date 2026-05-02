import type { Departure, DeparturesResponse, SearchResponse, Site } from "../types";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && typeof data === "object" && "error" in data)) {
    const message = (data as { error?: string })?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchDepartures(
  siteId: string,
  options: { timeWindow?: number; signal?: AbortSignal } = {}
): Promise<Departure[]> {
  const tw = options.timeWindow ?? 60;
  const data = await getJson<DeparturesResponse>(
    `/api/departures?siteId=${encodeURIComponent(siteId)}&timeWindow=${tw}`,
    options.signal
  );
  return (data.departures ?? []).filter((d) => d.line.transport_mode === "METRO");
}

export async function searchStations(
  query: string,
  signal?: AbortSignal
): Promise<{ results: Site[]; interpretation?: string }> {
  const data = await getJson<SearchResponse>(
    `/api/ai-search?q=${encodeURIComponent(query)}`,
    signal
  );
  if (data.StatusCode !== 0) {
    throw new Error(data.Message || "Search failed");
  }
  return { results: data.ResponseData ?? [], interpretation: data.AiInterpretation };
}
