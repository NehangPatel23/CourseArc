import { useEffect, useMemo, useRef, useState } from "react";
import CanvasModal from "./CanvasModal";
import type {
  ModuleAccessRule,
  ModuleRequirementsMode,
} from "../utils/modules";

export default function RequirementsModal({
  moduleTitle,
  initialMode,
  initialAccessRule,
  initialPrereqModuleNumber,
  initialUnlockAt,
  onClose,
  onSave,
}: {
  moduleTitle: string;
  initialMode: ModuleRequirementsMode;
  initialAccessRule: ModuleAccessRule;
  initialPrereqModuleNumber: number;
  initialUnlockAt?: string;
  onClose: () => void;
  onSave: (payload: {
    mode: ModuleRequirementsMode;
    accessRule: ModuleAccessRule;
    prereqModuleNumber?: number;
    unlockAt?: string;
  }) => void;
}) {
  const [mode, setMode] = useState<ModuleRequirementsMode>(initialMode);
  const [accessRule, setAccessRule] =
    useState<ModuleAccessRule>(initialAccessRule);
  const [prereqModuleNumber, setPrereqModuleNumber] = useState<number>(
    initialPrereqModuleNumber ?? 1,
  );

  // Keep old prereq settings when toggling mode to none and back
  const lastNonNoneAccessRule = useRef<{
    accessRule: ModuleAccessRule;
    prereqModuleNumber: number;
  }>({
    accessRule: initialAccessRule,
    prereqModuleNumber: initialPrereqModuleNumber ?? 1,
  });

  const prereqsDisabled = mode === "none";

  useEffect(() => {
    if (mode === "none") {
      lastNonNoneAccessRule.current = { accessRule, prereqModuleNumber };
      setAccessRule("ignore");
      setPrereqModuleNumber(1);
    } else {
      // Restore previous prereq settings if we just came back from "none"
      if (accessRule === "ignore") {
        const prev = lastNonNoneAccessRule.current;
        if (prev.accessRule !== "ignore") {
          setAccessRule(prev.accessRule);
          setPrereqModuleNumber(prev.prereqModuleNumber);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ✅ Timed unlock (independent of requirements mode)
  const toLocalInputValue = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  };

  const fromLocalInputValue = (v: string) => {
    // "datetime-local" is interpreted as local time by Date(...)
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  };

  const [unlockEnabled, setUnlockEnabled] =
    useState<boolean>(!!initialUnlockAt);
  const [unlockAtLocal, setUnlockAtLocal] = useState<string>(() =>
    toLocalInputValue(initialUnlockAt),
  );

  const unlockAtIso = useMemo(() => {
    if (!unlockEnabled) return undefined;
    if (!unlockAtLocal.trim()) return undefined;
    return fromLocalInputValue(unlockAtLocal.trim());
  }, [unlockEnabled, unlockAtLocal]);

  const save = () => {
    onSave({
      mode,
      accessRule,
      prereqModuleNumber:
        accessRule === "module_number" ? prereqModuleNumber : undefined,
      unlockAt: unlockAtIso,
    });
  };

  return (
    <CanvasModal
      title={`Module Requirements — ${moduleTitle}`}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Set how students progress through items in this module.
          </p>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="req"
              checked={mode === "none"}
              onChange={() => setMode("none")}
            />
            <div>
              <div className="font-medium text-[#2D3B45]">No requirements</div>
              <div className="text-sm text-gray-600">
                Items can be accessed freely. (Your completion UI may still show
                status.)
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="req"
              checked={mode === "all"}
              onChange={() => setMode("all")}
            />
            <div>
              <div className="font-medium text-[#2D3B45]">
                Complete all items
              </div>
              <div className="text-sm text-gray-600">
                Items can be completed in any order; module completes when all
                are done.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="req"
              checked={mode === "sequential"}
              onChange={() => setMode("sequential")}
            />
            <div>
              <div className="font-medium text-[#2D3B45]">
                Complete items sequentially
              </div>
              <div className="text-sm text-gray-600">
                Only the next incomplete item is unlocked.
              </div>
            </div>
          </label>
        </div>

        <div className="h-px bg-gray-200" />

        {/* ✅ Timed unlock */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-lg font-semibold text-[#2D3B45]">
                Timed unlock
              </div>
              <div className="text-sm text-gray-600">
                Lock this module until a specific date/time.
              </div>
            </div>

            {unlockEnabled && unlockAtIso ? (
              <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700">
                Enabled
              </span>
            ) : null}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={unlockEnabled}
              onChange={(e) => setUnlockEnabled(e.target.checked)}
            />
            <span className="text-sm text-[#2D3B45] font-medium">
              Enable “Unlock at”
            </span>
          </label>

          <div
            className={`space-y-2 ${
              unlockEnabled ? "" : "opacity-50 pointer-events-none"
            }`}
          >
            <label className="block text-sm font-medium text-[#2D3B45]">
              Unlock at
            </label>
            <input
              type="datetime-local"
              value={unlockAtLocal}
              onChange={(e) => setUnlockAtLocal(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#2D3B45] focus:ring-1 focus:ring-[#008EE2] focus:border-[#008EE2] outline-none"
            />
            <p className="text-xs text-gray-500">
              Uses the viewer’s local timezone.
            </p>
          </div>
        </div>

        <div className="h-px bg-gray-200" />

        {/* ✅ Module prereq access */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-lg font-semibold text-[#2D3B45]">
                Module access prerequisites
              </div>
              <div className="text-sm text-gray-600">
                Control whether this module is accessible based on other
                modules’ completion.
              </div>
            </div>

            {prereqsDisabled && (
              <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500">
                Disabled (No requirements)
              </span>
            )}
          </div>

          <div
            className={`space-y-3 ${
              prereqsDisabled ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="access"
                checked={accessRule === "default"}
                onChange={() => setAccessRule("default")}
                disabled={prereqsDisabled}
              />
              <div>
                <div className="font-medium text-[#2D3B45]">
                  Default (require previous modules)
                </div>
                <div className="text-sm text-gray-600">
                  This module is locked until earlier modules are completed.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="access"
                checked={accessRule === "ignore"}
                onChange={() => setAccessRule("ignore")}
                disabled={prereqsDisabled}
              />
              <div>
                <div className="font-medium text-[#2D3B45]">
                  Ignore prerequisites (always accessible)
                </div>
                <div className="text-sm text-gray-600">
                  Students can access this module regardless of other modules.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="access"
                checked={accessRule === "module_number"}
                onChange={() => setAccessRule("module_number")}
                disabled={prereqsDisabled}
              />
              <div className="w-full">
                <div className="font-medium text-[#2D3B45]">
                  Require completion of a specific module number
                </div>
                <div className="text-sm text-gray-600">
                  Lock this module until the specified module is completed.
                </div>

                {accessRule === "module_number" && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-sm text-gray-600">Module #</span>
                    <input
                      type="number"
                      min={1}
                      value={prereqModuleNumber}
                      onChange={(e) =>
                        setPrereqModuleNumber(
                          Math.max(1, Math.floor(Number(e.target.value || 1))),
                        )
                      }
                      className="w-24 px-3 py-2 rounded-md border border-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      disabled={prereqsDisabled}
                    />
                  </div>
                )}
              </div>
            </label>
          </div>

          {prereqsDisabled && (
            <div className="text-xs text-gray-500">
              Prerequisites are disabled because this module has no completion
              requirements.
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={save}
            className="px-5 py-2 rounded-md bg-[#008EE2] hover:bg-[#0079C2] text-white font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}
