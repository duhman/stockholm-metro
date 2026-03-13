import { useState, useEffect, FormEvent } from "react";
import { Train, Clock, AlertCircle, Search, MapPin, Loader2, ArrowRight } from "lucide-react";
import { cn } from "./lib/utils";
import { format, parseISO } from "date-fns";
import { MapContainer, TileLayer, Marker, Tooltip, useMap, GeoJSON, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";
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
    SiteId: "9221",
    Type: "Station",
    X: "18.1022811307506",
    Y: "59.3480838652274"
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
  const [metroGeoJSON, setMetroGeoJSON] = useState<any>(null);

  useEffect(() => {
    fetch("/metro.geojson")
      .then(res => res.json())
      .then(data => setMetroGeoJSON(data))
      .catch(console.error);
  }, []);

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
      const res = await fetch(`/api/ai-search?q=${encodeURIComponent(searchQuery)}`);
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

  const getLineColor = (groupOfLine: string) => {
    if (!groupOfLine) return "bg-gray-500";
    if (groupOfLine.toLowerCase().includes("röda")) return "bg-red-500";
    if (groupOfLine.toLowerCase().includes("gröna")) return "bg-green-500";
    if (groupOfLine.toLowerCase().includes("blå")) return "bg-blue-500";
    return "bg-gray-500";
  };

  const getLineColorHex = (groupOfLine: string) => {
    if (!groupOfLine) return "#6b7280";
    if (groupOfLine.toLowerCase().includes("röda")) return "#ef4444";
    if (groupOfLine.toLowerCase().includes("gröna")) return "#22c55e";
    if (groupOfLine.toLowerCase().includes("blå")) return "#3b82f6";
    return "#6b7280";
  };

  const styleMetroLine = (feature: any) => {
    const ref = feature?.properties?.ref;
    if (['13','14'].includes(ref)) return { color: "#ef4444", weight: 3, opacity: 0.6 };
    if (['17','18','19'].includes(ref)) return { color: "#22c55e", weight: 3, opacity: 0.6 };
    if (['10','11'].includes(ref)) return { color: "#3b82f6", weight: 3, opacity: 0.6 };
    return { color: "#6b7280", weight: 2, opacity: 0.4 };
  };

  const renderLiveTrains = () => {
    if (!metroGeoJSON || !departures.length) return null;

    const stationPt = turf.point([parseFloat(currentSite.X), parseFloat(currentSite.Y)]);

    return departures.map((dep, idx) => {
      if (!dep.expected) return null;
      
      const lineFeature = metroGeoJSON.features.find((f: any) => f.properties?.ref === dep.line.designation);
      if (!lineFeature || (lineFeature.geometry.type !== "LineString" && lineFeature.geometry.type !== "MultiLineString")) return null;

      // Extract a basic LineString if it's MultiLineString for simplicity
      let lineGeometry = lineFeature;
      if (lineFeature.geometry.type === "MultiLineString") {
         // Create a simple linestring from the first coordinate array, overpass might return multilinestrings
         lineGeometry = turf.lineString(lineFeature.geometry.coordinates[0]);
      }

      const minToArrival = (new Date(dep.expected).getTime() - new Date().getTime()) / 60000;
      if (minToArrival < 0) return null;

      const distanceTrainKm = minToArrival * 0.6; // assuming ~36km/h avg speed -> 0.6km/min
      
      try {
        const nearest = turf.nearestPointOnLine(lineGeometry, stationPt);
        const distToStation = nearest.properties.location ?? 0;

        const isDir1 = dep.direction_code === 1;
        let trainDistAlongLine = isDir1 ? distToStation - distanceTrainKm : distToStation + distanceTrainKm;
        
        const totalLength = turf.length(lineGeometry);
        trainDistAlongLine = Math.max(0, Math.min(totalLength, trainDistAlongLine));

        const trainPt = turf.along(lineGeometry, trainDistAlongLine);
        const [lon, lat] = trainPt.geometry.coordinates;

        const isArriving = minToArrival <= 1;

        return (
          <CircleMarker 
            key={`${dep.line.designation}-${dep.direction_code}-${idx}-${minToArrival}`}
            center={[lat, lon]} 
            radius={isArriving ? 8 : 5}
            pathOptions={{ 
              color: isArriving ? '#fff' : '#000',
              fillColor: getLineColorHex(dep.line.group_of_lines),
              fillOpacity: 1,
              weight: isArriving ? 3 : 2
            }}
          >
            <Tooltip className="!bg-[#141414] !text-white border-white/20 !rounded-xl">
              <span className="font-bold">{dep.line.designation} {dep.destination}</span>
              <span className="block text-xs text-gray-400 mt-0.5 opacity-80">{Math.round(minToArrival)} min away</span>
            </Tooltip>
          </CircleMarker>
        );
      } catch (err) {
        return null; // Ignore spatial calculation errors on messy lines
      }
    });
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30">
      
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={[parseFloat(currentSite.Y), parseFloat(currentSite.X)]} 
          zoom={14} 
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {metroGeoJSON && (
            <GeoJSON 
              data={{
                ...metroGeoJSON,
                features: metroGeoJSON.features.filter((f: any) => f.geometry.type !== "Point" && f.geometry.type !== "MultiPoint")
              }} 
              style={styleMetroLine} 
            />
          )}

          <MapUpdater results={searchResults.length > 0 ? searchResults : [currentSite]} />
          
          {searchResults.length > 0 ? (
            searchResults.map(site => (
              <StationMarker key={site.SiteId} site={site} onSelect={() => selectSite(site)} />
            ))
          ) : (
            <StationMarker key={currentSite.SiteId} site={currentSite} onSelect={() => {}} />
          )}

          {/* Render live train trackers */}
          {renderLiveTrains()}
        </MapContainer>
      </div>

      {/* Overlay UI Panel */}
      <div className="absolute z-10 top-4 left-4 w-[calc(100%-2rem)] max-w-sm sm:w-[400px] max-h-[calc(100vh-2rem)] overflow-y-auto bg-black/80 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl custom-scrollbar pointer-events-auto">
        <div className="p-6">
        
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



        {/* Search Panel */}
        {showSearch && (
          <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/10">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask AI for a station... (e.g. 'central station')"
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
    </div>
  );
}
