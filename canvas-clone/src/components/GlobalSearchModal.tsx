import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Search, X } from "lucide-react";
import { globalSearch, groupSearchResults } from "../utils/globalSearch";
import { loadSearchHistory } from "../utils/searchHistory";

type Props = {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
};

export default function GlobalSearchModal({ open, onClose, initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [history, setHistory] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setHistory(loadSearchHistory());
    }
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const results = globalSearch(query);
  const grouped = groupSearchResults(results);

  const go = (href: string) => {
    onClose();
    navigate(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-center gap-2 border-b border-canvas-border px-4 py-3 dark:border-gray-700">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses, pages, files, announcements…"
            className="flex-1 bg-transparent text-sm focus:outline-none dark:text-white"
          />
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <div>
              <p className="px-3 py-2 text-sm text-gray-500">Type at least 2 characters…</p>
              {history.length > 0 && (
                <div className="mt-2">
                  <p className="px-3 py-1 text-xs font-semibold uppercase text-gray-400">Recent</p>
                  {history.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setQuery(h)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas-grayLight dark:hover:bg-gray-700"
                    >
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-500">No results found.</p>
          ) : (
            Object.entries(grouped).map(([group, items]) =>
              items.length ? (
                <div key={group} className="mb-3">
                  <p className="px-3 py-1 text-xs font-semibold uppercase text-gray-400">{group}</p>
                  {items.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => go(r.href)}
                      className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas-grayLight dark:hover:bg-gray-700"
                    >
                      <span className="font-medium text-canvas-grayDark dark:text-gray-100">{r.title}</span>
                      {r.subtitle && <span className="text-xs text-gray-400">{r.subtitle}</span>}
                    </button>
                  ))}
                </div>
              ) : null,
            )
          )}
        </div>
      </div>
    </div>
  );
}
