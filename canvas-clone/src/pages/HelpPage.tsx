import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, Search } from "lucide-react";
import { KeyboardShortcutsList } from "../components/KeyboardShortcutsSheet";
import { searchFaq } from "../utils/faq";

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchFaq(query), [query]);

  const byCategory = useMemo(() => {
    const map = new Map<string, typeof results>();
    for (const item of results) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [results]);

  return (
    <div className="w-full px-8 py-10 lg:px-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-canvas-blue">
            <HelpCircle className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Help center</span>
          </div>
          <h1 className="text-3xl font-semibold text-canvas-grayDark">How can we help?</h1>
          <p className="mt-2 text-sm text-gray-600">
            Search FAQs for CourseArc demos, grades, roles, and course packages.
          </p>
        </div>
        <Link to="/" className="shrink-0 text-sm text-canvas-blue hover:underline">
          ← Dashboard
        </Link>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help…"
            className="w-full rounded-xl border border-canvas-border bg-white py-2.5 pl-10 pr-4 text-sm text-canvas-grayDark outline-none ring-canvas-blue/30 focus:ring-2"
          />
        </label>
        <section className="rounded-2xl bg-white p-5 ring-1 ring-canvas-border/80">
          <h2 className="mb-1 text-sm font-semibold text-canvas-grayDark">Keyboard shortcuts</h2>
          <p className="mb-3 text-xs text-gray-600">
            Press <kbd className="rounded bg-gray-100 px-1">?</kbd> anytime for this list.
          </p>
          <KeyboardShortcutsList />
        </section>
      </div>

      {byCategory.length === 0 ? (
        <p className="text-sm text-gray-500">No FAQ matches for “{query.trim()}”.</p>
      ) : (
        <div className="space-y-8">
          {byCategory.map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {category}
              </h2>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl bg-white p-5 ring-1 ring-canvas-border/80"
                  >
                    <h3 className="font-semibold text-canvas-grayDark">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
