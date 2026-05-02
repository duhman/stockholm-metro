import * as turf from "@turf/turf";
import type { Feature, LineString, Position } from "geojson";
import type { Departure, MetroRef } from "../types";
import { LINE_TERMINALS, METRO_REFS, isMetroRef, matchTerminal } from "./lines";

// Average Stockholm metro speed including stops, ~36 km/h.
export const AVG_SPEED_KM_PER_MIN = 0.6;

// Endpoints within ~50 m are considered "the same junction" when stitching
// MultiLineString segments into a single line. ~0.0005 deg lat ≈ 55 m.
const STITCH_TOLERANCE_DEG = 0.0005;

function endpoints(coords: Position[]): [Position, Position] {
  return [coords[0], coords[coords.length - 1]];
}

function nearby(a: Position, b: Position): boolean {
  return Math.abs(a[0] - b[0]) < STITCH_TOLERANCE_DEG && Math.abs(a[1] - b[1]) < STITCH_TOLERANCE_DEG;
}

// Greedily chain segments end-to-end. Stockholm metro lines are linear, so
// after stitching we expect one long chain plus a few short stragglers; we
// keep the longest chain.
function chainSegments(segments: Position[][]): Position[] {
  if (segments.length === 0) return [];
  const remaining = segments.map((s) => [...s]);
  const chains: Position[][] = [];

  while (remaining.length > 0) {
    let chain = remaining.shift()!;
    let extended = true;
    while (extended) {
      extended = false;
      const [chainStart, chainEnd] = endpoints(chain);
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const [segStart, segEnd] = endpoints(seg);
        if (nearby(chainEnd, segStart)) {
          chain = chain.concat(seg.slice(1));
        } else if (nearby(chainEnd, segEnd)) {
          chain = chain.concat([...seg].reverse().slice(1));
        } else if (nearby(chainStart, segEnd)) {
          chain = seg.slice(0, -1).concat(chain);
        } else if (nearby(chainStart, segStart)) {
          chain = [...seg].reverse().slice(0, -1).concat(chain);
        } else {
          continue;
        }
        remaining.splice(i, 1);
        extended = true;
        break;
      }
    }
    chains.push(chain);
  }

  let best = chains[0];
  let bestLen = best.length;
  for (let i = 1; i < chains.length; i++) {
    if (chains[i].length > bestLen) {
      best = chains[i];
      bestLen = chains[i].length;
    }
  }
  return best;
}

// Pick a single OSM relation per line (each line has two: forward + reverse).
// We orient the chain so km=0 corresponds to LINE_TERMINALS[ref][0]. Using
// both relations would chain into a closed loop and double the line length.
function pickFeatureForRef(features: Feature[], ref: MetroRef): Feature | null {
  const [startTerminal] = LINE_TERMINALS[ref];
  const norm = (s: string | undefined) => (s || "").toLowerCase().trim();
  const targetFrom = norm(startTerminal);
  for (const f of features) {
    const props = f.properties as Record<string, unknown> | null;
    if (norm(props?.from as string) === targetFrom) return f;
  }
  return features[0] ?? null;
}

function segmentsFromFeature(f: Feature): Position[][] {
  const geom = f.geometry;
  if (!geom) return [];
  if (geom.type === "LineString") return [geom.coordinates];
  if (geom.type === "MultiLineString") return geom.coordinates;
  return [];
}

export function buildMergedLines(
  geojson: { features: Feature[] }
): Map<MetroRef, Feature<LineString>> {
  const byRef = new Map<MetroRef, Feature[]>();
  for (const f of geojson.features) {
    const ref = (f.properties as any)?.ref;
    if (!isMetroRef(ref)) continue;
    const arr = byRef.get(ref) ?? [];
    arr.push(f);
    byRef.set(ref, arr);
  }
  const merged = new Map<MetroRef, Feature<LineString>>();
  for (const ref of METRO_REFS) {
    const feats = byRef.get(ref);
    if (!feats || feats.length === 0) continue;
    const picked = pickFeatureForRef(feats, ref);
    if (!picked) continue;
    const chained = chainSegments(segmentsFromFeature(picked));
    if (chained.length < 2) continue;
    merged.set(ref, turf.lineString(chained));
  }
  return merged;
}

export interface TrainProjection {
  lat: number;
  lon: number;
  minutesAway: number;
}

// Project a single departure onto the merged line for its ref. Returns null
// when projection isn't possible (line missing, terminal can't be matched,
// already departed, etc.).
export function projectTrain(
  dep: Departure,
  station: { lat: number; lon: number },
  mergedByRef: Map<MetroRef, Feature<LineString>>,
  now: Date = new Date()
): TrainProjection | null {
  if (!dep.expected) return null;
  const minutesAway = (new Date(dep.expected).getTime() - now.getTime()) / 60000;
  if (minutesAway < 0) return null;

  const ref = dep.line.designation;
  if (!isMetroRef(ref)) return null;
  const line = mergedByRef.get(ref);
  if (!line) return null;

  const terminals = LINE_TERMINALS[ref];
  const terminalIdx = matchTerminal(dep.destination, terminals);
  if (terminalIdx === null) return null;

  try {
    const stationPt = turf.point([station.lon, station.lat]);
    const totalKm = turf.length(line);
    const stationKm = (turf.nearestPointOnLine(line, stationPt).properties.location ?? 0) as number;

    // `destination` is the terminal the train is *heading toward*. It started
    // from the opposite terminal and is currently between that origin and the
    // station. So the train sits on the side of the station opposite the
    // destination: if the destination is "ahead" (larger km), the train is at
    // km = stationKm - distanceOut; if "behind", at stationKm + distanceOut.
    const terminalKm = terminalIdx === 0 ? 0 : totalKm;
    const distanceOutKm = Math.max(0, minutesAway * AVG_SPEED_KM_PER_MIN);
    const sign = terminalKm > stationKm ? -1 : 1;
    const trainKm = Math.max(0, Math.min(totalKm, stationKm + sign * distanceOutKm));

    const pt = turf.along(line, trainKm);
    const [lon, lat] = pt.geometry.coordinates;
    return { lat, lon, minutesAway };
  } catch {
    return null;
  }
}
