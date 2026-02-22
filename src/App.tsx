import { useState, useEffect, FormEvent } from "react";
import { Train, Clock, AlertCircle, Search, MapPin, Loader2, ArrowRight } from "lucide-react";
import { cn } from "./lib/utils";
import { format, parseISO } from "date-fns";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix leaflet icon issue in Vite
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Types based on new SL Transport API
interface Departure {
  direction: string;
  direction_code: number;
  destination: string;
  scheduled: string;
  expected: string;
  display: string;
  line: {
    id: number;
    designation: string;
    transport_mode: string;
    group_of_lines: string;
  };
}

interface Site {
  Name: string;
  SiteId: string;
  Type: string;
  X: string;
  Y: string;
}

function MapUpdater({ results }: { results: Site[] }) {
  const map = useMap();
  useEffect(() => {
    if (results.length === 0) return;
    const lats = results.map((r) => parseFloat(r.Y)).filter((y) => !isNaN(y) && y !== 0);
    const lons = results.map((r) => parseFloat(r.X)).filter((x) => !isNaN(x) && x !== 0);
    if (lats.length === 0 || lons.length === 0) return;

    const bounds = L.latLngBounds(lats.map((lat, i) => [lat, lons[i]]));
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
  }, [results, map]);
  return null;
}

function StationMarker({ site, onSelect }: { site: Site; onSelect: () => void; key?: string | number }) {
  const [departures, setDepartures] = useState<Departure[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMouseOver = async () => {
    if (departures || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/departures?siteId=${site.SiteId}&timeWindow=60`);
      const data = await res.json();
      if (!data.error) {
        const metroDepartures = (data.departures || []).filter(
          (dep: Departure) => dep.line.transport_mode === "METRO"
        );
        setDepartures(metroDepartures);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const lat = parseFloat(site.Y);
  const lon = parseFloat(site.X);
  if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) return null;

  return (
    <Marker
      position={[lat, lon]}
      eventHandlers={{
        mouseover: handleMouseOver,
        click: onSelect,
      }}
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

export default function App() {
  const [currentSite, setCurrentSite] = useState<Site>({
    Name: "Gärdet",
    SiteId: "9203",
    Type: "Station",
    X: "18.0981",
    Y: "59.3465"
  });
  const [siteId, setSiteId] = useState(currentSite.SiteId);
  const [siteName, setSiteName] = useState(currentSite.Name);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Site[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const fetchDepartures = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/departures?siteId=${id}&timeWindow=60`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Filter for METRO only since the user asked for a subway tracker
      const metroDepartures = (data.departures || []).filter(
        (dep: Departure) => dep.line.transport_mode === "METRO"
      );
      
      setDepartures(metroDepartures);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartures(siteId);
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDepartures(siteId);
    }, 30000);
    return () => clearInterval(interval);
  }, [siteId]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.StatusCode === 0) {
        setSearchResults(data.ResponseData || []);
      } else {
        throw new Error(data.Message || "Failed to search locations");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during search");
    } finally {
      setIsSearching(false);
    }
  };

  const selectSite = (site: Site) => {
    setCurrentSite(site);
    setSiteId(site.SiteId);
    setSiteName(site.Name);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Group departures by direction
  const groupedDepartures = departures.reduce((acc, dep) => {
    const dir = dep.direction_code;
    if (!acc[dir]) acc[dir] = [];
    acc[dir].push(dep);
    return acc;
  }, {} as Record<number, Departure[]>);

  // Helper to get line color
  const getLineColor = (groupOfLine: string) => {
    if (!groupOfLine) return "bg-gray-500";
    if (groupOfLine.toLowerCase().includes("röda")) return "bg-red-500";
    if (groupOfLine.toLowerCase().includes("gröna")) return "bg-green-500";
    if (groupOfLine.toLowerCase().includes("blå")) return "bg-blue-500";
    return "bg-gray-500";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30">
      <div className="max-w-md mx-auto p-4 sm:p-6 md:p-8">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Train className="w-6 h-6 text-red-500" />
              SL Tracker
            </h1>
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {siteName}
            </p>
          </div>
          <button 
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
        </header>

        {/* Map */}
        <div className="mb-8 h-48 w-full rounded-2xl overflow-hidden border border-white/10 relative z-0">
          <MapContainer center={[parseFloat(currentSite.Y), parseFloat(currentSite.X)]} zoom={14} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapUpdater results={searchResults.length > 0 ? searchResults : [currentSite]} />
            
            {searchResults.length > 0 ? (
              searchResults.map(site => (
                <StationMarker key={site.SiteId} site={site} onSelect={() => selectSite(site)} />
              ))
            ) : (
              <StationMarker key={currentSite.SiteId} site={currentSite} onSelect={() => {}} />
            )}
          </MapContainer>
        </div>

        {/* Search Panel */}
        {showSearch && (
          <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/10">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search station..."
                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
              />
              <button 
                type="submit"
                disabled={isSearching}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center min-w-[80px]"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((site) => (
                  <button
                    key={site.SiteId}
                    onClick={() => selectSite(site)}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-sm flex items-center justify-between group"
                  >
                    <span>{site.Name}</span>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-red-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-200">
              <p className="font-medium text-red-400 mb-1">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !departures.length && !error && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-red-500" />
            <p className="text-sm">Fetching live departures...</p>
          </div>
        )}

        {/* Departures List */}
        {!loading && departures.length === 0 && !error && (
          <div className="text-center py-12 text-gray-500 text-sm">
            No metro departures found for {siteName} in the next 60 minutes.
          </div>
        )}

        {departures.length > 0 && (
          <div className="space-y-8">
            {(Object.entries(groupedDepartures) as [string, Departure[]][]).map(([direction, deps]) => (
              <div key={direction} className="space-y-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">
                  Direction {direction}
                </h2>
                <div className="space-y-2">
                  {deps.map((dep, idx) => (
                    <div 
                      key={`${dep.direction_code}-${dep.expected}-${idx}`}
                      className="bg-[#141414] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg",
                          getLineColor(dep.line.group_of_lines)
                        )}>
                          {dep.line.designation}
                        </div>
                        <div>
                          <p className="font-medium text-base">{dep.destination}</p>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dep.expected ? format(parseISO(dep.expected), "HH:mm") : "Unknown"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className={cn(
                          "text-lg font-bold tracking-tight",
                          dep.display === "Nu" ? "text-red-500 animate-pulse" : "text-white"
                        )}>
                          {dep.display}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {lastUpdated && !error && (
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              Last updated: {format(lastUpdated, "HH:mm:ss")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
