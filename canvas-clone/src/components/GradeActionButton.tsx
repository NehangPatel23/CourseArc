import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

export default function GradeActionButton({
  to,
  pendingCount = 0,
  label = "Grade",
  className = "",
  variant = "primary",
}: {
  to: string;
  pendingCount?: number;
  label?: string;
  className?: string;
  variant?: "primary" | "sidebar";
}) {
  const baseClass =
    variant === "primary"
      ? "btn-canvas-primary relative inline-flex items-center gap-1.5"
      : "relative inline-flex w-full items-center gap-3 py-3 text-left text-sm text-canvas-blue hover:underline";

  return (
    <Link to={to} className={`${baseClass} ${className}`}>
      <GraduationCap className={variant === "sidebar" ? "h-4 w-4 shrink-0 text-gray-500" : "h-4 w-4"} />
      {label}
      {pendingCount > 0 && (
        <span
          className={
            variant === "primary"
              ? "absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-canvas-red px-1 text-[10px] font-bold text-white"
              : "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-canvas-red px-1.5 text-[10px] font-bold text-white"
          }
        >
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      )}
    </Link>
  );
}
