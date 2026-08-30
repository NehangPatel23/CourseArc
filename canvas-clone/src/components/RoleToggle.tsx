import Icon from "../icons/Icon";
import { useStudentView, type ViewAs } from "../utils/studentView";

type RoleToggleProps = {
  className?: string;
  compact?: boolean;
};

const OPTIONS: { view: ViewAs; label: string; title: string; icon: "student" | "ta" | "instructor" }[] = [
  { view: "student", label: "Student", title: "Student view", icon: "student" },
  { view: "ta", label: "TA", title: "TA view (Taylor Kim)", icon: "ta" },
  { view: "instructor", label: "Instructor", title: "Instructor view", icon: "instructor" },
];

export default function RoleToggle({ className = "", compact = false }: RoleToggleProps) {
  const { viewAs, setViewAs } = useStudentView();

  return (
    <div className={`rounded-md border border-white/10 bg-black/20 p-1 ${className}`}>
      {!compact && (
        <p className="px-2 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-arc-cream/40">
          Viewing as
        </p>
      )}
      <div
        className={`gap-1 ${compact ? "flex flex-col" : "grid grid-cols-3"}`}
        role="group"
        aria-label="View as"
      >
        {OPTIONS.map(({ view, label, title, icon }) => {
          const selected = viewAs === view;
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
              className="role-toggle-btn"
            >
              <span
                className={`role-toggle-chip ${compact ? "is-compact" : ""} ${
                  selected
                    ? "bg-arc-copper text-white shadow-sm"
                    : "text-arc-cream/55 hover:bg-white/5 hover:text-arc-cream"
                }`}
              >
                <Icon name={icon} size={14} className="block h-3.5 w-3.5 shrink-0" />
                {!compact && <span className="role-toggle-label">{label}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
