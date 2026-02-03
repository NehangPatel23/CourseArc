import { useEffect, useState } from "react";
import CanvasModal from "./CanvasModal";
import type {
  ModuleAccessRule,
  ModuleRequirementsMode,
} from "../utils/modules";

export function RequirementsModal({
  moduleTitle,
  initialMode,
  initialAccessRule,
  initialPrereqModuleNumber,
  onClose,
  onSave,
}: {
  moduleTitle: string;

  // existing
  initialMode: ModuleRequirementsMode;

  // ✅ NEW
  initialAccessRule?: ModuleAccessRule;
  initialPrereqModuleNumber?: number;

  onClose: () => void;

  // ✅ NEW: save all settings together
  onSave: (payload: {
    mode: ModuleRequirementsMode;
    accessRule: ModuleAccessRule;
    prereqModuleNumber?: number;
  }) => void;
}) {
  const [mode, setMode] = useState<ModuleRequirementsMode>(initialMode);

  const [accessRule, setAccessRule] = useState<ModuleAccessRule>(
    initialAccessRule ?? "default",
  );

  const [prereqModuleNumber, setPrereqModuleNumber] = useState<number>(
    Math.max(1, Math.floor(initialPrereqModuleNumber ?? 1)),
  );

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setAccessRule(initialAccessRule ?? "default");
  }, [initialAccessRule]);

  useEffect(() => {
    setPrereqModuleNumber(
      Math.max(1, Math.floor(initialPrereqModuleNumber ?? 1)),
    );
  }, [initialPrereqModuleNumber]);

  const save = () => {
    onSave({
      mode,
      accessRule,
      prereqModuleNumber:
        accessRule === "module_number" ? prereqModuleNumber : undefined,
    });
  };

  return (
    <CanvasModal
      title={`Module Requirements — ${moduleTitle}`}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Set how students progress through items in this module.
          </p>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="req"
                checked={mode === "none"}
                onChange={() => setMode("none")}
              />
              <div>
                <div className="font-medium text-[#2D3B45]">
                  No requirements
                </div>
                <div className="text-sm text-gray-600">
                  Items can be accessed freely. (Your completion UI may still
                  show status.)
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
        </div>

        {/* ✅ NEW: module access prereq policy */}
        <div className="h-px bg-gray-200" />

        <div className="space-y-2">
          <div className="text-sm font-medium text-[#2D3B45]">
            Module access prerequisites
          </div>
          <p className="text-sm text-gray-600">
            Control whether this module is accessible based on other modules’
            completion.
          </p>

          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="accessRule"
                checked={accessRule === "default"}
                onChange={() => setAccessRule("default")}
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
                name="accessRule"
                checked={accessRule === "ignore"}
                onChange={() => setAccessRule("ignore")}
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
                name="accessRule"
                checked={accessRule === "module_number"}
                onChange={() => setAccessRule("module_number")}
              />
              <div className="min-w-0">
                <div className="font-medium text-[#2D3B45]">
                  Require completion of a specific module number
                </div>
                <div className="text-sm text-gray-600">
                  Lock this module until the specified module is completed.
                </div>

                {accessRule === "module_number" && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-gray-700">Module #</span>
                    <input
                      type="number"
                      min={1}
                      value={prereqModuleNumber}
                      onChange={(e) =>
                        setPrereqModuleNumber(
                          Math.max(1, Math.floor(Number(e.target.value) || 1)),
                        )
                      }
                      className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm text-[#2D3B45] focus:ring-1 focus:ring-[#008EE2] focus:border-[#008EE2] outline-none"
                    />
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="px-4 py-2 rounded-md bg-[#008EE2] text-white hover:bg-[#0079C2]"
          >
            Save
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}

export default RequirementsModal;
