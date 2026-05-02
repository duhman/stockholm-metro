import { useMemo } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";
import type { Feature, LineString } from "geojson";
import { colorForRef } from "../lib/lines";
import { projectTrain } from "../lib/trains";
import type { Departure, MetroRef, Site } from "../types";

interface Props {
  station: Site;
  departures: Departure[];
  mergedByRef: Map<MetroRef, Feature<LineString>>;
  // Tick value that changes periodically so projections re-render against the
  // current time without re-fetching.
  tick: number;
}

export function LiveTrainLayer({ station, departures, mergedByRef, tick }: Props) {
  const projections = useMemo(() => {
    if (mergedByRef.size === 0) return [];
    const stationCoord = {
      lat: parseFloat(station.Y),
      lon: parseFloat(station.X),
    };
    if (!Number.isFinite(stationCoord.lat) || !Number.isFinite(stationCoord.lon)) return [];
    const now = new Date();
    return departures
      .map((dep, idx) => {
        const projection = projectTrain(dep, stationCoord, mergedByRef, now);
        if (!projection) return null;
        return { dep, idx, projection };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [station, departures, mergedByRef, tick]);

  return (
    <>
      {projections.map(({ dep, idx, projection }) => {
        const isArriving = projection.minutesAway <= 1;
        return (
          <CircleMarker
            key={`${dep.line.designation}-${dep.direction_code}-${idx}-${dep.expected}`}
            center={[projection.lat, projection.lon]}
            radius={isArriving ? 8 : 5}
            pathOptions={{
              color: isArriving ? "#fff" : "#000",
              fillColor: colorForRef(dep.line.designation),
              fillOpacity: 1,
              weight: isArriving ? 3 : 2,
            }}
          >
            <Tooltip className="!bg-[#141414] !text-white border-white/20 !rounded-xl">
              <span className="font-bold">
                {dep.line.designation} {dep.destination}
              </span>
              <span className="block text-xs text-gray-400 mt-0.5 opacity-80">
                {Math.round(projection.minutesAway)} min away
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
