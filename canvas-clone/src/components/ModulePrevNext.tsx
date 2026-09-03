import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  isFromModules,
  modulesNavState,
  readModulesNavState,
} from "./BackToModulesButton";
import {
  findModuleNeighbors,
  type ModuleNavKind,
} from "../utils/moduleSequence";
import {
  loadModulesFromStorage,
  MODULES_CHANGED_EVENT,
  type ModuleT,
} from "../utils/modules";
import { useStudentView } from "../utils/studentView";

type Props = {
  courseId: string;
  kind: ModuleNavKind;
  itemId: string;
  className?: string;
};

/**
 * Previous / Next through the course modules in order. Renders nothing unless
 * this view was opened from Modules (not Assignments, Pages, Quizzes, etc.).
 */
export default function ModulePrevNext({
  courseId,
  kind,
  itemId,
  className = "",
}: Props) {
  const location = useLocation();
  const { from, moduleTitle } = readModulesNavState(location.state);
  const { studentView } = useStudentView(courseId);
  const [modules, setModules] = useState<ModuleT[]>(() => loadModulesFromStorage());

  useEffect(() => {
    const refresh = () => setModules(loadModulesFromStorage());
    window.addEventListener(MODULES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(MODULES_CHANGED_EVENT, refresh);
  }, []);

  const { prev, next } = useMemo(
    () =>
      findModuleNeighbors({
        modules,
        courseId,
        studentView,
        moduleTitle,
        current: { kind, id: itemId },
      }),
    [modules, courseId, studentView, moduleTitle, kind, itemId],
  );

  if (!isFromModules(from) || !itemId) return null;
  if (!prev && !next) return null;

  const btn =
    "group flex min-w-[10rem] max-w-[48%] flex-1 items-center gap-2 rounded-lg border border-arc-line bg-arc-ivory px-3 py-2.5 text-left transition-colors hover:border-arc-copper/40 hover:bg-arc-paper";
  const labelCls = "block truncate text-sm font-medium text-arc-ink";
  const hintCls = "block text-[11px] font-semibold uppercase tracking-wide text-arc-mute";

  return (
    <nav
      aria-label="Module items"
      className={`mt-10 flex items-stretch justify-between gap-4 border-t border-arc-line pt-6 ${className}`}
    >
      {prev ? (
        <Link
          to={prev.path}
          state={modulesNavState(courseId, prev.moduleTitle)}
          className={btn}
        >
          <ChevronLeft className="h-5 w-5 shrink-0 text-arc-mute group-hover:text-arc-copper" />
          <span className="min-w-0">
            <span className={hintCls}>Previous</span>
            <span className={labelCls}>{prev.label}</span>
            {prev.moduleTitle !== moduleTitle ? (
              <span className="mt-0.5 block truncate text-[11px] text-arc-mute">
                {prev.moduleTitle}
              </span>
            ) : null}
          </span>
        </Link>
      ) : (
        <span className="min-w-0 max-w-[48%]" />
      )}
      {next ? (
        <Link
          to={next.path}
          state={modulesNavState(courseId, next.moduleTitle)}
          className={`${btn} ml-auto text-right`}
        >
          <span className="min-w-0">
            <span className={hintCls}>Next</span>
            <span className={labelCls}>{next.label}</span>
            {next.moduleTitle !== moduleTitle ? (
              <span className="mt-0.5 block truncate text-[11px] text-arc-mute">
                {next.moduleTitle}
              </span>
            ) : null}
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-arc-mute group-hover:text-arc-copper" />
        </Link>
      ) : (
        <span className="min-w-0 max-w-[48%]" />
      )}
    </nav>
  );
}
