import { GraduationCap, UserRound } from "lucide-react";
import { useStudentView } from "../utils/studentView";

type RoleToggleProps = {
  className?: string;
  compact?: boolean;
};

export default function RoleToggle({ className = "", compact = false }: RoleToggleProps) {
  const { studentView, setStudentView } = useStudentView();

  const select = (isStudent: boolean) => {
    if (studentView === isStudent) return;
    setStudentView(isStudent);
  };

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-1 ${className}`}>
      {!compact && (
        <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Viewing as
        </p>
      )}
      <div
        className={`gap-1 ${compact ? "flex flex-col" : "grid grid-cols-2"}`}
        role="group"
        aria-label="View as"
      >
        <button
          type="button"
          onClick={() => select(true)}
          title="Student view"
          className={`flex items-center rounded-lg font-semibold transition-all ${
            compact ? "justify-center px-2 py-2.5" : "flex-col gap-1 px-2 py-2.5 text-[11px]"
          } ${
            studentView
              ? "bg-canvas-blue text-white shadow-sm"
              : "text-gray-300 hover:bg-white/5 hover:text-white"
          }`}
        >
          <UserRound className="h-4 w-4" />
          {!compact && "Student"}
        </button>
        <button
          type="button"
          onClick={() => select(false)}
          title="Instructor view"
          className={`flex items-center rounded-lg font-semibold transition-all ${
            compact ? "justify-center px-2 py-2.5" : "flex-col gap-1 px-2 py-2.5 text-[11px]"
          } ${
            !studentView
              ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20"
              : "text-gray-300 hover:bg-white/5 hover:text-white"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          {!compact && "Instructor"}
        </button>
      </div>
    </div>
  );
}
