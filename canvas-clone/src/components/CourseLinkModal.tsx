import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Link2, Search } from "lucide-react";
import {
  CATEGORY_LABELS,
  getCourseLinkTargets,
  type CourseLinkCategory,
  type CourseLinkOption,
} from "../utils/courseLinks";

type Props = {
  isOpen: boolean;
  courseId: string;
  initialText?: string;
  onInsert: (href: string, text: string) => void;
  onClose: () => void;
};

const CATEGORY_ORDER: CourseLinkCategory[] = [
  "page",
  "file",
  "module",
  "assignment",
  "discussion",
];

export default function CourseLinkModal({
  isOpen,
  courseId,
  initialText = "",
  onInsert,
  onClose,
}: Props) {
  const [tab, setTab] = useState<"external" | "course">("course");
  const [search, setSearch] = useState("");
  const [linkText, setLinkText] = useState(initialText);
  const [externalUrl, setExternalUrl] = useState("https://");
  const [selected, setSelected] = useState<CourseLinkOption | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLinkText(initialText);
    setSearch("");
    setSelected(null);
    setExternalUrl("https://");
    setTab("course");
  }, [isOpen, initialText]);

  const targets = useMemo(() => getCourseLinkTargets(courseId), [courseId, isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.sublabel?.toLowerCase().includes(q) ||
        t.category.includes(q),
    );
  }, [targets, search]);

  const grouped = useMemo(() => {
    const map = new Map<CourseLinkCategory, CourseLinkOption[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const t of filtered) {
      map.get(t.category)?.push(t);
    }
    return map;
  }, [filtered]);

  if (!isOpen) return null;

  const canInsertExternal = () => {
    try {
      const u = new URL(externalUrl.trim());
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleInsert = () => {
    if (tab === "external") {
      if (!canInsertExternal()) return;
      onInsert(externalUrl.trim(), linkText.trim() || externalUrl.trim());
      onClose();
      return;
    }
    if (!selected) return;
    onInsert(selected.href, linkText.trim() || selected.label);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-canvas-border bg-white shadow-xl">
        <div className="border-b border-canvas-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-canvas-blue" />
            <h2 className="text-lg font-semibold text-canvas-grayDark">Insert link</h2>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Link to an external URL or course content (pages, files, modules, assignments, discussions).
          </p>
        </div>

        <div className="flex border-b border-gray-200 px-5 text-sm">
          <button
            type="button"
            onClick={() => setTab("course")}
            className={`px-3 py-2 -mb-px border-b-2 ${
              tab === "course"
                ? "border-canvas-blue font-medium text-canvas-blue"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Course content
          </button>
          <button
            type="button"
            onClick={() => setTab("external")}
            className={`px-3 py-2 -mb-px border-b-2 ${
              tab === "external"
                ? "border-canvas-blue font-medium text-canvas-blue"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            External URL
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3">
            <label className="form-label">Link text</label>
            <input
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Display text"
              className="form-input"
            />
          </div>

          {tab === "external" ? (
            <div>
              <label className="form-label">URL</label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://example.com/document.pdf"
                  className="form-input pl-9"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Use a full URL for external websites or hosted files.
              </p>
            </div>
          ) : (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pages, files, modules…"
                  className="form-input pl-9"
                />
              </div>
              <div className="max-h-64 space-y-4 overflow-y-auto rounded-lg border border-gray-200 p-2">
                {filtered.length === 0 ? (
                  <p className="px-2 py-4 text-sm text-gray-500">No matching course content.</p>
                ) : (
                  CATEGORY_ORDER.map((cat) => {
                    const items = grouped.get(cat) ?? [];
                    if (items.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {CATEGORY_LABELS[cat]}
                        </div>
                        {items.map((t) => (
                          <button
                            key={`${t.category}-${t.id}`}
                            type="button"
                            onClick={() => {
                              setSelected(t);
                              if (!linkText.trim()) setLinkText(t.label);
                            }}
                            className={`mb-1 block w-full rounded-md px-2 py-2 text-left text-sm transition-colors ${
                              selected?.id === t.id && selected.category === t.category
                                ? "bg-canvas-blueTint text-canvas-grayDark ring-1 ring-canvas-blue/30"
                                : "text-canvas-grayDark hover:bg-gray-50"
                            }`}
                          >
                            <div className="font-medium">{t.label}</div>
                            {t.sublabel && (
                              <div className="text-xs text-gray-500">{t.sublabel}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-canvas-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={tab === "external" ? !canInsertExternal() : !selected}
            className="btn-canvas-primary disabled:opacity-50"
          >
            Insert link
          </button>
        </div>
      </div>
    </div>
  );
}
