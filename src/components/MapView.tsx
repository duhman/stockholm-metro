import { useEffect } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import type { FeatureCollection } from "geojson";
import { styleMetroLine } from "../lib/lines";
import { StationMarker } from "./StationMarker";
import { LiveTrainLayer } from "./LiveTrainLayer";
import type { Departure, MetroRef, Site } from "../types";
import type { Feature, LineString } from "geojson";

L.Marker.prototype.options.icon = L.icon({
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
});

function FitBounds({ sites }: { sites: Site[] }) {
  const map = useMap();
  useEffect(() => {
    if (sites.length === 0) return;
    const points: [number, number][] = [];
    for (const s of sites) {
      const lat = parseFloat(s.Y);
      const lon = parseFloat(s.X);
      if (Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0) {
        points.push([lat, lon]);
      }
    }
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [20, 20], maxZoom: 15 });
  }, [sites, map]);
  return null;
}

interface Props {
  currentSite: Site;
  searchResults: Site[];
  onSelectSite: (site: Site) => void;
  geoJson: FeatureCollection | null;
  mergedByRef: Map<MetroRef, Feature<LineString>>;
  departures: Departure[];
  tick: number;
}

export function MapView({
  currentSite,
  searchResults,
  onSelectSite,
  geoJson,
  mergedByRef,
  departures,
  tick,
}: Props) {
  const center: [number, number] = [parseFloat(currentSite.Y), parseFloat(currentSite.X)];
  const linesOnly = geoJson
    ? {
        ...geoJson,
        features: geoJson.features.filter(
          (f) => f.geometry?.type !== "Point" && f.geometry?.type !== "MultiPoint"
        ),
      }
    : null;

  const visibleStations = searchResults.length > 0 ? searchResults : [currentSite];

  return (
    <MapContainer center={center} zoom={14} className="h-full w-full" zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {linesOnly && <GeoJSON data={linesOnly} style={styleMetroLine} />}
      <FitBounds sites={visibleStations} />
      {visibleStations.map((site) => (
        <StationMarker
          key={site.SiteId}
          site={site}
          onSelect={() => onSelectSite(site)}
        />
      ))}
      <LiveTrainLayer
        station={currentSite}
        departures={departures}
        mergedByRef={mergedByRef}
        tick={tick}
      />
    </MapContainer>
  );
}
