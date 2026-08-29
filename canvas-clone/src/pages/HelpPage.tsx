import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
  GraduationCap,
  HelpCircle,
  Keyboard,
  Layers,
  Navigation,
  Package,
  Search,
  UserCircle2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { KeyboardShortcutsList } from "../components/KeyboardShortcutsSheet";
import PageIdentityHeader from "../components/PageIdentityHeader";
import { FAQ_ITEMS, searchFaq, type FaqItem } from "../utils/faq";

const CATEGORY_META: Record<string, { icon: LucideIcon; hint: string }> = {
  Navigation: { icon: Navigation, hint: "Getting around CourseArc" },
  Roles: { icon: Users, hint: "Instructor & student view" },
  Grades: { icon: GraduationCap, hint: "Posting, missing, and late" },
  Quizzes: { icon: HelpCircle, hint: "Attempts, moderate, and accommodations" },
  Assignments: { icon: BookOpen, hint: "Submissions and peer review" },
  Keyboard: { icon: Keyboard, hint: "Shortcuts" },
  "Course packages": { icon: Package, hint: "Import & export" },
  "Course content": { icon: Layers, hint: "Modules and unlock rules" },
  Help: { icon: BookOpen, hint: "Finding this page" },
  Ayuda: { icon: BookOpen, hint: "FAQ en español" },
  Profile: { icon: UserCircle2, hint: "ArcFolio and profile" },
};

function categoryIcon(category: string): LucideIcon {
  return CATEGORY_META[category]?.icon ?? HelpCircle;
}

function FaqAccordionItem({
  item,
  open,
  onToggle,
}: {
  item: FaqItem;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `faq-panel-${item.id}`;
  const buttonId = `faq-btn-${item.id}`;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start gap-3 py-4 text-left transition hover:text-canvas-blue"
      >
        <span className="min-w-0 flex-1 text-sm font-semibold text-canvas-grayDark">
          {item.title}
        </span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180 text-canvas-blue" : ""
          }`}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="pb-4 pr-8"
      >
        <p className="text-sm leading-relaxed text-gray-600">{item.body}</p>
      </div>
    </div>
  );
}

export default function HelpPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams]);

  const results = useMemo(() => searchFaq(query), [query]);

  const categories = useMemo(() => {
    const set = new Set(FAQ_ITEMS.map((item) => item.category));
    return [...set];
  }, []);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return results;
    return results.filter((item) => item.category === activeCategory);
  }, [results, activeCategory]);

  const byCategory = useMemo(() => {
    const map = new Map<string, FaqItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    setOpenId(null);
  }, [query, activeCategory]);

  useEffect(() => {
    if (query.trim() && filtered.length === 1) {
      setOpenId(filtered[0].id);
    }
  }, [query, filtered]);

  const clearSearch = () => {
    setQuery("");
    searchRef.current?.focus();
  };

  return (
    <div className="relative min-h-full">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-canvas-blueTint/60 via-canvas-blueTint/20 to-transparent"
        aria-hidden
      />

      <div className="relative w-full px-8 py-10 lg:px-12">
        <PageIdentityHeader
          className="mb-8"
          icon={HelpCircle}
          label="Help Center"
          description="Find answers about navigation, grades, roles, quizzes, and course tools."
        />

        <div className="mb-8 max-w-2xl">
          <label className="relative block">
            <span className="sr-only">Search help</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveCategory("all");
              }}
              placeholder="Search FAQs…"
              className="w-full rounded-2xl border border-canvas-border/80 bg-white py-3.5 pl-11 pr-11 text-sm text-canvas-grayDark shadow-sm outline-none ring-canvas-blue/25 transition placeholder:text-gray-400 focus:border-canvas-blue/40 focus:ring-2"
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <p className="mt-2 text-xs text-gray-500">
            {filtered.length} article{filtered.length === 1 ? "" : "s"}
            {query.trim() ? ` matching “${query.trim()}”` : " in Help Center"}
          </p>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              activeCategory === "all"
                ? "bg-canvas-blue text-white"
                : "bg-white text-gray-600 ring-1 ring-canvas-border hover:text-canvas-blue"
            }`}
          >
            All topics
          </button>
          {categories.map((category) => {
            const Icon = categoryIcon(category);
            const active = activeCategory === category;
            return (
              <button
                type="button"
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-canvas-blue text-white"
                    : "bg-white text-gray-600 ring-1 ring-canvas-border hover:text-canvas-blue"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {category}
              </button>
            );
          })}
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-6">
            {byCategory.length === 0 ? (
              <div className="rounded-2xl bg-white px-6 py-10 text-center ring-1 ring-canvas-border/80">
                <HelpCircle className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-3 text-sm font-semibold text-canvas-grayDark">
                  No matches for “{query.trim()}”
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Try another keyword, or browse all topics.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveCategory("all");
                  }}
                  className="mt-4 text-sm font-semibold text-canvas-blue hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              byCategory.map(([category, items]) => {
                const Icon = categoryIcon(category);
                const hint = CATEGORY_META[category]?.hint;
                return (
                  <section
                    key={category}
                    className="overflow-hidden rounded-2xl bg-white ring-1 ring-canvas-border/80"
                  >
                    <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas-blueTint text-canvas-blue">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-canvas-grayDark">
                          {category}
                        </h2>
                        {hint && <p className="text-xs text-gray-500">{hint}</p>}
                      </div>
                      <span className="ml-auto text-xs tabular-nums text-gray-400">
                        {items.length}
                      </span>
                    </div>
                    <div className="px-5">
                      {items.map((item) => (
                        <FaqAccordionItem
                          key={item.id}
                          item={item}
                          open={openId === item.id}
                          onToggle={() =>
                            setOpenId((id) => (id === item.id ? null : item.id))
                          }
                        />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-2xl bg-white p-5 ring-1 ring-canvas-border/80">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas-blueTint text-canvas-blue">
                  <Keyboard className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-canvas-grayDark">
                    Keyboard shortcuts
                  </h2>
                  <p className="text-xs text-gray-500">
                    Press <kbd className="rounded bg-gray-100 px-1 font-mono">?</kbd> anytime
                  </p>
                </div>
              </div>
              <KeyboardShortcutsList />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
