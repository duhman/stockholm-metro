import { useMemo } from "react";
import { AlertCircle, Clock, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "../lib/utils";
import { tailwindBgForGroup } from "../lib/lines";
import type { Departure } from "../types";

interface Props {
  stationName: string;
  departures: Departure[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function DeparturesPanel({ stationName, departures, loading, error, lastUpdated }: Props) {
  const grouped = useMemo(() => {
    const acc = new Map<number, Departure[]>();
    for (const dep of departures) {
      const arr = acc.get(dep.direction_code) ?? [];
      arr.push(dep);
      acc.set(dep.direction_code, arr);
    }
    return [...acc.entries()].sort((a, b) => a[0] - b[0]);
  }, [departures]);

  if (error) {
    return (
      <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-sm text-red-200">
          <p className="font-medium text-red-400 mb-1">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (loading && departures.length === 0) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-red-500" aria-hidden="true" />
        <p className="text-sm">Fetching live departures...</p>
      </div>
    );
  }

  if (!loading && departures.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        No metro departures found for {stationName} in the next 60 minutes.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {grouped.map(([direction, deps]) => (
          <div key={direction} className="space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">
              Direction {direction}
            </h2>
            <ul className="space-y-2">
              {deps.map((dep, idx) => (
                <li
                  key={`${dep.direction_code}-${dep.expected}-${idx}`}
                  className="bg-[#141414] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg",
                        tailwindBgForGroup(dep.line.group_of_lines)
                      )}
                    >
                      {dep.line.designation}
                    </div>
                    <div>
                      <p className="font-medium text-base">{dep.destination}</p>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {dep.expected ? format(parseISO(dep.expected), "HH:mm") : "Unknown"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-lg font-bold tracking-tight",
                        dep.display === "Nu" ? "text-red-500 animate-pulse" : "text-white"
                      )}
                    >
                      {dep.display}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {lastUpdated && (
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" />
            Last updated: {format(lastUpdated, "HH:mm:ss")}
          </p>
        </div>
      )}
    </>
  );
}
