import { useMemo, useState } from "react";
import CanvasModal from "./CanvasModal";
import type { AssignmentGroup } from "../utils/coursesStore";

export default function AssignmentGroupsWeightModal({
  groups,
  weighted,
  onSave,
  onClose,
}: {
  groups: AssignmentGroup[];
  weighted: boolean;
  onSave: (next: { groups: AssignmentGroup[]; weighted: boolean }) => void;
  onClose: () => void;
}) {
  const [enabled, setEnabled] = useState(weighted);
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, String(g.weight)])),
  );

  const regularTotal = useMemo(
    () =>
      groups.reduce((sum, g) => {
        if (g.extraCredit) return sum;
        const n = Number(weights[g.id]);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [groups, weights],
  );
  const extraCreditTotal = useMemo(
    () =>
      groups.reduce((sum, g) => {
        if (!g.extraCredit) return sum;
        const n = Number(weights[g.id]);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [groups, weights],
  );

  return (
    <CanvasModal title="Assignment Groups Weight" onClose={onClose} size="md">
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded border-gray-300 text-canvas-blue"
        />
        Weight final grade based on assignment groups
      </label>

      <div className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
        {groups.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3 py-3">
            <span className="min-w-0 truncate text-sm text-gray-800">
              {g.name}
              {g.extraCredit ? (
                <span className="ml-2 text-xs font-normal text-amber-700">Extra credit</span>
              ) : null}
            </span>
            <div className="flex items-center">
              <input
                type="number"
                min={0}
                disabled={!enabled}
                value={weights[g.id] ?? "0"}
                onChange={(e) =>
                  setWeights((prev) => ({ ...prev, [g.id]: e.target.value }))
                }
                className="w-20 rounded-l-md border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
              />
              <span className="rounded-r-md border border-l-0 border-gray-300 bg-gray-100 px-2 py-1.5 text-sm text-gray-600">
                %
              </span>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between py-3">
          <span className="text-sm font-semibold text-gray-800">Total</span>
          <span className="text-sm font-semibold text-gray-800">
            {regularTotal}%
            {extraCreditTotal > 0 ? (
              <span className="ml-1 font-normal text-amber-700">
                + {extraCreditTotal}% EC
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-canvas-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              weighted: enabled,
              groups: groups.map((g) => ({
                ...g,
                weight: Number.isFinite(Number(weights[g.id]))
                  ? Math.max(0, Number(weights[g.id]))
                  : 0,
              })),
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
