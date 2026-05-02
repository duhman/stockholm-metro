import { MapPin, Search, Train } from "lucide-react";

interface Props {
  stationName: string;
  searchOpen: boolean;
  onToggleSearch: () => void;
}

export function Header({ stationName, searchOpen, onToggleSearch }: Props) {
  return (
    <header className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Train className="w-6 h-6 text-red-500" aria-hidden="true" />
          SL Tracker
        </h1>
        <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
          <MapPin className="w-3 h-3" aria-hidden="true" />
          {stationName}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggleSearch}
        aria-label={searchOpen ? "Close search" : "Open search"}
        aria-expanded={searchOpen}
        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
      >
        <Search className="w-5 h-5" aria-hidden="true" />
      </button>
    </header>
  );
}
