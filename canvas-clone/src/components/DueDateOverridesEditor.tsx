import { Plus, Trash2 } from "lucide-react";
import DateTimeField from "./DateTimeField";
import {
  listOverrideTargetOptions,
  newDueDateOverrideDraft,
  overrideTargetLabel,
  type DueDateOverride,
  type DueDateTargetKind,
} from "../utils/dueDateOverrides";

type Draft = Omit<DueDateOverride, "itemKind" | "itemId"> & {
  itemKind?: DueDateOverride["itemKind"];
  itemId?: string;
};

export default function DueDateOverridesEditor({
  courseId,
  overrides,
  onChange,
}: {
  courseId: string;
  overrides: Draft[];
  onChange: (next: Draft[]) => void;
}) {
  const options = listOverrideTargetOptions(courseId);

  const add = (kind: DueDateTargetKind) => {
    const first =
      kind === "section" ? options.sections[0]?.id : options.students[0]?.id;
    if (!first) return;
    onChange([...overrides, newDueDateOverrideDraft(kind, first)]);
  };

  const update = (id: string, patch: Partial<Draft>) => {
    onChange(overrides.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="form-section-title">Differentiated due dates</div>
          <p className="mt-1 text-xs text-gray-500">
            Override due and availability dates for a section or individual student. Everyone else
            keeps the dates above.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => add("section")}
            disabled={options.sections.length === 0}
            className="btn-canvas-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs"
          >
            <Plus className="h-3 w-3" />
            Section
          </button>
          <button
            type="button"
            onClick={() => add("student")}
            disabled={options.students.length === 0}
            className="btn-canvas-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs"
          >
            <Plus className="h-3 w-3" />
            Student
          </button>
        </div>
      </div>

      {overrides.length === 0 ? (
        <p className="text-sm text-gray-500">No overrides. All students share the same due date.</p>
      ) : (
        <div className="space-y-3">
          {overrides.map((row) => (
            <div
              key={row.id}
              className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
            >
              <div className="flex items-center gap-2">
                <select
                  value={row.targetKind}
                  onChange={(e) => {
                    const kind = e.target.value as DueDateTargetKind;
                    const first =
                      kind === "section" ? options.sections[0]?.id : options.students[0]?.id;
                    update(row.id, { targetKind: kind, targetId: first ?? row.targetId });
                  }}
                  className="form-input h-9 w-28 text-sm"
                >
                  <option value="section">Section</option>
                  <option value="student">Student</option>
                </select>
                <select
                  value={row.targetId}
                  onChange={(e) => update(row.id, { targetId: e.target.value })}
                  className="form-input h-9 min-w-0 flex-1 text-sm"
                >
                  {(row.targetKind === "section" ? options.sections : options.students).map(
                    (opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ),
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => onChange(overrides.filter((o) => o.id !== row.id))}
                  className="rounded p-1.5 text-canvas-red hover:bg-red-50"
                  aria-label={`Remove override for ${overrideTargetLabel(courseId, row)}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DateTimeField
                  label="Due"
                  value={row.dueAt}
                  onChange={(ms) => update(row.id, { dueAt: ms })}
                />
                <DateTimeField
                  label="Available from"
                  value={row.availableFrom}
                  onChange={(ms) => update(row.id, { availableFrom: ms })}
                />
                <DateTimeField
                  label="Available until"
                  value={row.availableUntil}
                  onChange={(ms) => update(row.id, { availableUntil: ms })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
