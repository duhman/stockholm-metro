import type { MetroRef } from "../types";

export const METRO_REFS: readonly MetroRef[] = ["10", "11", "13", "14", "17", "18", "19"] as const;

export function isMetroRef(ref: string | undefined | null): ref is MetroRef {
  return !!ref && (METRO_REFS as readonly string[]).includes(ref);
}

const RED = "#ef4444";
const GREEN = "#22c55e";
const BLUE = "#3b82f6";
const GRAY = "#6b7280";

export function colorForRef(ref: string | undefined | null): string {
  if (!ref) return GRAY;
  if (ref === "13" || ref === "14") return RED;
  if (ref === "17" || ref === "18" || ref === "19") return GREEN;
  if (ref === "10" || ref === "11") return BLUE;
  return GRAY;
}

export function tailwindBgForGroup(group: string | undefined): string {
  if (!group) return "bg-gray-500";
  const g = group.toLowerCase();
  if (g.includes("röda")) return "bg-red-500";
  if (g.includes("gröna")) return "bg-green-500";
  if (g.includes("blå")) return "bg-blue-500";
  return "bg-gray-500";
}

export function styleMetroLine(feature: any) {
  const ref = feature?.properties?.ref;
  return { color: colorForRef(ref), weight: 3, opacity: 0.6 };
}

// Endpoints of each metro line, derived from the OSM `from`/`to` tags on the
// route relations in public/metro.geojson. Used to map an SL departure's
// `destination` to which end of the merged line geometry the train is heading
// toward.
export const LINE_TERMINALS: Record<MetroRef, [string, string]> = {
  "10": ["Hjulsta", "Kungsträdgården"],
  "11": ["Akalla", "Kungsträdgården"],
  "13": ["Norsborg", "Ropsten"],
  "14": ["Fruängen", "Mörby centrum"],
  "17": ["Skarpnäck", "Hässelby strand"],
  "18": ["Farsta strand", "Hässelby strand"],
  "19": ["Hagsätra", "Hässelby strand"],
};

// Loose match: SL's `destination` strings may be normalised differently from
// OSM `from`/`to` (e.g. "Mörby Centrum" vs "Mörby centrum"). Compare lowercase
// + collapsed whitespace.
export function matchTerminal(destination: string, terminals: [string, string]): 0 | 1 | null {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const dest = norm(destination);
  if (norm(terminals[0]) === dest) return 0;
  if (norm(terminals[1]) === dest) return 1;
  // Fall back to substring match (handles "Mörby Centrum T" or stray suffixes).
  if (dest.includes(norm(terminals[0]))) return 0;
  if (dest.includes(norm(terminals[1]))) return 1;
  return null;
}
