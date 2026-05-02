import { useEffect, useMemo, useState } from "react";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { buildMergedLines } from "../lib/trains";
import type { MetroRef } from "../types";

export interface UseMetroGeoJSONResult {
  raw: FeatureCollection | null;
  mergedByRef: Map<MetroRef, Feature<LineString>>;
  error: string | null;
}

export function useMetroGeoJSON(): UseMetroGeoJSONResult {
  const [raw, setRaw] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/metro.geojson", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`metro.geojson: HTTP ${res.status}`);
        return res.json();
      })
      .then((data: FeatureCollection) => setRaw(data))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err?.message || "Failed to load metro geometry");
      });
    return () => controller.abort();
  }, []);

  const mergedByRef = useMemo(() => {
    if (!raw) return new Map<MetroRef, Feature<LineString>>();
    return buildMergedLines(raw);
  }, [raw]);

  return { raw, mergedByRef, error };
}
