import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

export default function GradeIconLink({
  to,
  pendingCount = 0,
  label = "Grade",
}: {
  to: string;
  pendingCount?: number;
  label?: string;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
    >
      <GraduationCap className="h-4 w-4" />
      {pendingCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-canvas-red px-1 text-[9px] font-bold text-white">
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      )}
    </Link>
  );
}
