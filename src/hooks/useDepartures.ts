import { useEffect, useRef, useState } from "react";
import { fetchDepartures } from "../api/sl";
import type { Departure } from "../types";

const POLL_MS = 30_000;

export interface UseDeparturesResult {
  departures: Departure[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useDepartures(siteId: string): UseDeparturesResult {
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        // Skip the network call but stay scheduled; we'll refresh on visibilitychange.
        return;
      }
      try {
        const data = await fetchDepartures(siteId, { signal: controller.signal });
        if (cancelled) return;
        setDepartures(data);
        setLastUpdated(new Date());
        setError(null);
      } catch (err: any) {
        if (cancelled || err?.name === "AbortError") return;
        setError(err?.message || "Failed to load departures");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        await tick();
        if (!cancelled) schedule();
      }, POLL_MS);
    };

    setLoading(true);
    setError(null);
    setDepartures([]);
    void tick().then(() => {
      if (!cancelled) schedule();
    });

    const onVisibility = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      controller.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [siteId]);

  return { departures, loading, error, lastUpdated };
}
