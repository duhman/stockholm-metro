import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { SearchPanel } from "./components/SearchPanel";
import { DeparturesPanel } from "./components/DeparturesPanel";
import { MapView } from "./components/MapView";
import { useDepartures } from "./hooks/useDepartures";
import { useMetroGeoJSON } from "./hooks/useMetroGeoJSON";
import type { Site } from "./types";

const DEFAULT_SITE: Site = {
  Name: "Gärdet",
  SiteId: "9221",
  Type: "Station",
  X: "18.1022811307506",
  Y: "59.3480838652274",
};

const TRAIN_TICK_MS = 5_000;

export default function App() {
  const [currentSite, setCurrentSite] = useState<Site>(DEFAULT_SITE);
  const [searchResults, setSearchResults] = useState<Site[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const { departures, loading, error: depError, lastUpdated } = useDepartures(currentSite.SiteId);
  const { raw: geoJson, mergedByRef, error: geoError } = useMetroGeoJSON();

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TRAIN_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const handleSelectSite = (site: Site) => {
    setCurrentSite(site);
    setSearchResults([]);
    setShowSearch(false);
    setSearchError(null);
  };

  const error = depError || geoError || searchError;

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30">
      <div className="absolute inset-0 z-0">
        <MapView
          currentSite={currentSite}
          searchResults={searchResults}
          onSelectSite={handleSelectSite}
          geoJson={geoJson}
          mergedByRef={mergedByRef}
          departures={departures}
          tick={tick}
        />
      </div>

      <div className="absolute z-10 top-4 left-4 w-[calc(100%-2rem)] max-w-sm sm:w-[400px] max-h-[calc(100vh-2rem)] overflow-y-auto bg-black/80 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl custom-scrollbar pointer-events-auto">
        <div className="p-6">
          <Header
            stationName={currentSite.Name}
            searchOpen={showSearch}
            onToggleSearch={() => setShowSearch((v) => !v)}
          />

          {showSearch && (
            <SearchPanel
              onSelect={handleSelectSite}
              onError={setSearchError}
            />
          )}

          <DeparturesPanel
            stationName={currentSite.Name}
            departures={departures}
            loading={loading}
            error={error}
            lastUpdated={lastUpdated}
          />
        </div>
      </div>
    </div>
  );
}
