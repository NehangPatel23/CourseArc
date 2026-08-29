import { useState } from "react";
import CanvasModal from "./CanvasModal";
import type { AssignmentGroup } from "../utils/coursesStore";

export default function AssignmentGroupRulesModal({
  group,
  items,
  onSave,
  onClose,
}: {
  group: AssignmentGroup;
  items: Array<{ key: string; title: string }>;
  onSave: (patch: Partial<AssignmentGroup>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [dropLowest, setDropLowest] = useState(String(group.dropLowest ?? 0));
  const [dropHighest, setDropHighest] = useState(String(group.dropHighest ?? 0));
  const [extraCredit, setExtraCredit] = useState(Boolean(group.extraCredit));
  const [neverDrop, setNeverDrop] = useState<Set<string>>(
    () => new Set(group.neverDropIds ?? []),
  );

  const toggleNever = (key: string) => {
    setNeverDrop((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <CanvasModal title={`Edit ${group.name}`} onClose={onClose} size="md">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Group name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full form-input"
          />
        </label>

        <div>
          <p className="text-sm font-medium text-gray-700">
            Number of scores to ignore for each student
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Dropped scores do not count toward the final grade. At least one score is always kept.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm text-gray-700">
              Lowest
              <input
                type="number"
                min={0}
                value={dropLowest}
                onChange={(e) => setDropLowest(e.target.value)}
                className="mt-1 w-full form-input"
              />
            </label>
            <label className="text-sm text-gray-700">
              Highest
              <input
                type="number"
                min={0}
                value={dropHighest}
                onChange={(e) => setDropHighest(e.target.value)}
                className="mt-1 w-full form-input"
              />
            </label>
          </div>
        </div>

        {items.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700">Never drop</p>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
              {items.map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={neverDrop.has(item.key)}
                    onChange={() => toggleNever(item.key)}
                    className="rounded border-gray-300 text-canvas-blue"
                  />
                  <span className="truncate">{item.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={extraCredit}
            onChange={(e) => setExtraCredit(e.target.checked)}
            className="rounded border-gray-300 text-canvas-blue"
          />
          Extra credit group (adds to overall % without counting in the weight total)
        </label>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-canvas-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              name: name.trim() || group.name,
              dropLowest: Math.max(0, Math.floor(Number(dropLowest) || 0)),
              dropHighest: Math.max(0, Math.floor(Number(dropHighest) || 0)),
              extraCredit: extraCredit || undefined,
              neverDropIds: neverDrop.size ? [...neverDrop] : undefined,
            })
          }
          className="btn-canvas-primary"
        >
          Save
        </button>
      </div>
    </CanvasModal>
  );
}
