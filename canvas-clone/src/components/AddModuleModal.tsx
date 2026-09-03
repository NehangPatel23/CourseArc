import { useEffect, useMemo, useState } from "react";
import CanvasModal from "./CanvasModal";
import type {
  ModuleAccessRule,
  ModuleRequirementsMode,
} from "../utils/modules";

export type AddModulePayload = {
  title: string;
  requirementsMode: ModuleRequirementsMode;
  accessRule: ModuleAccessRule;
  prereqModuleNumber?: number;
  unlockAt?: string;
};

interface AddModuleModalProps {
  onClose: () => void;
  onAdd: (payload: AddModulePayload) => void;
}

const fromLocalInputValue = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
};

export default function AddModuleModal({ onClose, onAdd }: AddModuleModalProps) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<ModuleRequirementsMode>("none");
  const [accessRule, setAccessRule] = useState<ModuleAccessRule>("default");
  const [prereqModuleNumber, setPrereqModuleNumber] = useState(1);
  const [unlockEnabled, setUnlockEnabled] = useState(false);
  const [unlockAtLocal, setUnlockAtLocal] = useState("");

  const prereqsDisabled = mode === "none";

  useEffect(() => {
    // Prerequisites only make sense once a completion requirement exists.
    if (mode === "none") setAccessRule("ignore");
    else if (accessRule === "ignore") setAccessRule("default");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const unlockAtIso = useMemo(() => {
    if (!unlockEnabled || !unlockAtLocal.trim()) return undefined;
    return fromLocalInputValue(unlockAtLocal.trim());
  }, [unlockEnabled, unlockAtLocal]);

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onAdd({
      title: t,
      requirementsMode: mode,
      accessRule: mode === "none" ? "default" : accessRule,
      prereqModuleNumber:
        mode !== "none" && accessRule === "module_number"
          ? prereqModuleNumber
          : undefined,
      unlockAt: unlockAtIso,
    });
  };

  return (
    <CanvasModal title="Add New Module" onClose={onClose} size="md">
      <div className="space-y-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-arc-ink">
            Module name
          </label>
          <input
            type="text"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="e.g. Week 4 – Sorting Algorithms"
            className="form-input"
          />
        </div>

        <div className="h-px bg-arc-ink/10" />

        <div className="space-y-3">
          <div className="text-sm font-semibold text-arc-ink">Requirements</div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="add-req"
              checked={mode === "none"}
              onChange={() => setMode("none")}
            />
            <div>
              <div className="font-medium text-arc-ink">No requirements</div>
              <div className="text-sm text-arc-mute">Items can be accessed freely.</div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="add-req"
              checked={mode === "all"}
              onChange={() => setMode("all")}
            />
            <div>
              <div className="font-medium text-arc-ink">Complete all items</div>
              <div className="text-sm text-arc-mute">
                Completed in any order; module completes when all are done.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="add-req"
              checked={mode === "sequential"}
              onChange={() => setMode("sequential")}
            />
            <div>
              <div className="font-medium text-arc-ink">
                Complete items sequentially
              </div>
              <div className="text-sm text-arc-mute">
                Only the next incomplete item is unlocked.
              </div>
            </div>
          </label>
        </div>

        <div className="h-px bg-arc-ink/10" />

        <div className="space-y-3">
          <div className="text-sm font-semibold text-arc-ink">Timed unlock</div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={unlockEnabled}
              onChange={(e) => setUnlockEnabled(e.target.checked)}
            />
            <span className="text-sm font-medium text-arc-ink">
              Lock this module until a date/time
            </span>
          </label>
          <div className={unlockEnabled ? "" : "opacity-50 pointer-events-none"}>
            <input
              type="datetime-local"
              value={unlockAtLocal}
              onChange={(e) => setUnlockAtLocal(e.target.value)}
              className="form-input"
            />
            <p className="mt-1 text-xs text-arc-mute">Uses your local timezone.</p>
          </div>
        </div>

        <div className="h-px bg-arc-ink/10" />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-arc-ink">
              Access prerequisites
            </div>
            {prereqsDisabled && (
              <span className="shrink-0 rounded-full border border-arc-ink/10 bg-arc-paper px-2 py-0.5 text-[11px] font-medium text-arc-mute">
                Disabled (No requirements)
              </span>
            )}
          </div>
          <div className={prereqsDisabled ? "space-y-3 opacity-50 pointer-events-none" : "space-y-3"}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="add-access"
                checked={accessRule === "default"}
                onChange={() => setAccessRule("default")}
                disabled={prereqsDisabled}
              />
              <div>
                <div className="font-medium text-arc-ink">
                  Default (require previous modules)
                </div>
                <div className="text-sm text-arc-mute">
                  Locked until earlier modules are completed.
                </div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="add-access"
                checked={accessRule === "ignore"}
                onChange={() => setAccessRule("ignore")}
                disabled={prereqsDisabled}
              />
              <div>
                <div className="font-medium text-arc-ink">
                  Ignore prerequisites (always accessible)
                </div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="add-access"
                checked={accessRule === "module_number"}
                onChange={() => setAccessRule("module_number")}
                disabled={prereqsDisabled}
              />
              <div className="w-full">
                <div className="font-medium text-arc-ink">
                  Require a specific module number
                </div>
                {accessRule === "module_number" && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-sm text-arc-mute">Module #</span>
                    <input
                      type="number"
                      min={1}
                      value={prereqModuleNumber}
                      onChange={(e) =>
                        setPrereqModuleNumber(
                          Math.max(1, Math.floor(Number(e.target.value || 1))),
                        )
                      }
                      className="form-input w-24"
                      disabled={prereqsDisabled}
                    />
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-canvas-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="btn-canvas-primary disabled:opacity-50"
          >
            Add Module
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
