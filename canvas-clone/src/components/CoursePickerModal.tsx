import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Course } from "../utils/coursesStore";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  courses: Course[];
  defaultCourseId?: string;
  onSelect: (courseId: string) => void;
};

export default function CoursePickerModal({
  open,
  onClose,
  title,
  courses,
  defaultCourseId,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.short_name.toLowerCase().includes(q),
    );
  }, [courses, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-canvas-border px-5 py-4">
          <h2 className="text-lg font-semibold text-canvas-grayDark">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-canvas-border px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses…"
              className="w-full rounded-lg border border-canvas-border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-canvas-blue/30"
            />
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-500">No courses found.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-canvas-grayLight ${
                  c.id === defaultCourseId ? "bg-canvas-blueTint ring-1 ring-canvas-blue/20" : ""
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-canvas-grayDark">{c.title}</p>
                  <p className="truncate text-xs text-gray-500">
                    {c.code} · {c.term}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function pickCourseOrRun(
  courses: { id: string }[],
  defaultCourseId: string | undefined,
  run: (courseId: string) => void,
  openPicker: (defaultId?: string) => void,
) {
  const active = courses.filter((c) => !(c as { archived?: boolean }).archived);
  const list = active.length ? active : courses;
  if (list.length === 1) {
    run(list[0].id);
  } else if (list.length > 1) {
    openPicker(defaultCourseId);
  }
}
