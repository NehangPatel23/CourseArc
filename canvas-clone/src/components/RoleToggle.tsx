import { GraduationCap, UserCheck, UserRound } from "lucide-react";
import { useStudentView, type ViewAs } from "../utils/studentView";

type RoleToggleProps = {
  className?: string;
  compact?: boolean;
};

const OPTIONS: { view: ViewAs; label: string; title: string; Icon: typeof UserRound }[] = [
  { view: "student", label: "Student", title: "Student view", Icon: UserRound },
  { view: "ta", label: "TA", title: "TA view (Taylor Kim)", Icon: UserCheck },
  { view: "instructor", label: "Instructor", title: "Instructor view", Icon: GraduationCap },
];

export default function RoleToggle({ className = "", compact = false }: RoleToggleProps) {
  const { viewAs, setViewAs } = useStudentView();

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-1 ${className}`}>
      {!compact && (
        <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Viewing as
        </p>
      )}
      <div
        className={`gap-1 ${compact ? "flex flex-col" : "grid grid-cols-3"}`}
        role="group"
        aria-label="View as"
      >
        {OPTIONS.map(({ view, label, title, Icon }) => {
          const selected = viewAs === view;
          const selectedClass =
            view === "instructor"
              ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20"
              : view === "ta"
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-canvas-blue text-white shadow-sm";
          return (
            <button
              key={view}
              type="button"
              onClick={() => {
                if (viewAs === view) return;
                setViewAs(view);
              }}
              title={title}
              aria-pressed={selected}
              className={`flex items-center rounded-lg font-semibold transition-all ${
                compact ? "justify-center px-2 py-2 text-[10px]" : "flex-col gap-1 px-1.5 py-2 text-[11px]"
              } ${
                selected ? selectedClass : "text-gray-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {!compact && label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
