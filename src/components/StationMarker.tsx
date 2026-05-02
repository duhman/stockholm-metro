import { useEffect, useRef, useState } from "react";
import { Marker, Tooltip } from "react-leaflet";
import { fetchDepartures } from "../api/sl";
import type { Departure, Site } from "../types";

interface Props {
  site: Site;
  onSelect: () => void;
}

export function StationMarker({ site, onSelect }: Props) {
  const [departures, setDepartures] = useState<Departure[] | null>(null);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  const handleMouseOver = async () => {
    if (departures || loading) return;
    setLoading(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const data = await fetchDepartures(site.SiteId, { signal: controller.signal });
      if (!controller.signal.aborted) setDepartures(data);
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error(err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const lat = parseFloat(site.Y);
  const lon = parseFloat(site.X);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) return null;

  return (
    <Marker
      position={[lat, lon]}
      eventHandlers={{ mouseover: handleMouseOver, click: onSelect }}
    >
      <Tooltip className="!bg-[#141414] !text-white !border-white/10 !rounded-xl !shadow-xl">
        <div className="p-1 min-w-[150px]">
          <h3 className="font-bold text-sm mb-1 text-white">{site.Name}</h3>
          {loading && <p className="text-xs text-gray-400">Loading departures...</p>}
          {!loading && !departures && <p className="text-xs text-gray-400">Hover to load departures</p>}
          {!loading && departures && departures.length === 0 && (
            <p className="text-xs text-gray-400">No metro departures</p>
          )}
          {!loading && departures && departures.length > 0 && (
            <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
              {departures.slice(0, 5).map((dep, i) => (
                <div key={i} className="flex justify-between text-xs gap-4">
                  <span className="font-medium text-gray-200">
                    {dep.line.designation} {dep.destination}
                  </span>
                  <span className="text-red-400 font-bold">{dep.display}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Tooltip>
    </Marker>
  );
}
