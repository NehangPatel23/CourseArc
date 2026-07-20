import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/** True when navigation state indicates the user opened this item from Modules. */
export function isFromModules(from?: string | null): boolean {
  return typeof from === "string" && from.includes("/modules");
}

export function modulesPathFromState(
  courseId: string,
  from?: string | null,
): string {
  if (typeof from === "string" && from.includes("/modules")) {
    // Prefer the exact modules path from state (keeps query if any).
    const modulesIdx = from.indexOf("/modules");
    if (modulesIdx >= 0) {
      // Use up through /modules (drop /unavailable etc.)
      const base = from.slice(0, modulesIdx + "/modules".length);
      if (base.includes(`/courses/${courseId}/`)) return base;
    }
  }
  return `/courses/${courseId}/modules`;
}

type Props = {
  courseId: string;
  className?: string;
  /** When false, renders nothing even if from modules. */
  enabled?: boolean;
};

/**
 * Shows "Back to Modules" when the current page was opened from the Modules list.
 * Reads `location.state.from` set by ModulesPage navigations.
 */
export default function BackToModulesButton({
  courseId,
  className = "mb-4 inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline",
  enabled = true,
}: Props) {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  if (!enabled || !isFromModules(from)) return null;

  return (
    <Link to={modulesPathFromState(courseId, from)} className={className}>
      <ArrowLeft className="h-4 w-4" />
      Back to Modules
    </Link>
  );
}
