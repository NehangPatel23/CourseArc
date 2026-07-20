import { Search } from "lucide-react";

type SelectOption = { value: string; label: string };

type ListFiltersBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sort: string;
  onSortChange: (value: string) => void;
  sortOptions: SelectOption[];
  scoreBand?: string;
  onScoreBandChange?: (value: string) => void;
  scoreBandOptions?: SelectOption[];
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  statusOptions?: SelectOption[];
  latestOnly?: boolean;
  onLatestOnlyChange?: (value: boolean) => void;
  latestOnlyLabel?: string;
  resultCount: number;
  totalCount: number;
  className?: string;
  hideSort?: boolean;
};

export default function ListFiltersBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  sort,
  onSortChange,
  sortOptions,
  scoreBand,
  onScoreBandChange,
  scoreBandOptions,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  latestOnly,
  onLatestOnlyChange,
  latestOnlyLabel = "Latest attempt per student",
  resultCount,
  totalCount,
  className = "",
  hideSort = false,
}: ListFiltersBarProps) {
  const filtered = resultCount !== totalCount || search.trim() !== "";

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-canvas-blue focus:ring-2 focus:ring-canvas-blue/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!hideSort && (
            <>
              <label className="sr-only" htmlFor="list-filter-sort">
                Sort
              </label>
              <select
                id="list-filter-sort"
                value={sort}
                onChange={(e) => onSortChange(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-canvas-blue focus:ring-2 focus:ring-canvas-blue/20"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </>
          )}

          {scoreBandOptions && onScoreBandChange && (
            <>
              <label className="sr-only" htmlFor="list-filter-score">
                Score range
              </label>
              <select
                id="list-filter-score"
                value={scoreBand ?? "all"}
                onChange={(e) => onScoreBandChange(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-canvas-blue focus:ring-2 focus:ring-canvas-blue/20"
              >
                {scoreBandOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </>
          )}

          {statusOptions && onStatusFilterChange && (
            <>
              <label className="sr-only" htmlFor="list-filter-status">
                Status
              </label>
              <select
                id="list-filter-status"
                value={statusFilter ?? "all"}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-canvas-blue focus:ring-2 focus:ring-canvas-blue/20"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          Showing {resultCount} of {totalCount}
          {filtered ? " (filtered)" : ""}
        </span>
        {onLatestOnlyChange != null && (
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={latestOnly ?? false}
              onChange={(e) => onLatestOnlyChange(e.target.checked)}
              className="rounded border-gray-300 text-canvas-blue focus:ring-canvas-blue/30"
            />
            <span>{latestOnlyLabel}</span>
          </label>
        )}
      </div>
    </div>
  );
}
