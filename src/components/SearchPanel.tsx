import { type FormEvent, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { searchStations } from "../api/sl";
import type { Site } from "../types";

interface Props {
  onSelect: (site: Site) => void;
  onError: (message: string) => void;
}

export function SearchPanel({ onSelect, onError }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const { results: r } = await searchStations(trimmed);
      setResults(r);
      if (r.length === 0) onError("No matching stations found.");
    } catch (err: any) {
      onError(err?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/10">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label className="sr-only" htmlFor="search-input">
          Station or address
        </label>
        <input
          id="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask AI for a station... (e.g. 'central station')"
          className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          aria-label="Search"
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center min-w-[80px]"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((site) => (
            <li key={site.SiteId}>
              <button
                type="button"
                onClick={() => onSelect(site)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-sm flex items-center justify-between group"
              >
                <span>{site.Name}</span>
                <ArrowRight
                  className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-red-500"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
