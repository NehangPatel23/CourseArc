import { Link } from "react-router-dom";
import { usePermissions } from "../utils/permissions";

export type PeopleView = "roster" | "sections" | "groups" | "accommodations";

const TABS: { id: PeopleView; label: string; path: string }[] = [
  { id: "roster", label: "Roster", path: "" },
  { id: "sections", label: "Sections", path: "/sections" },
  { id: "groups", label: "Groups", path: "/groups" },
  { id: "accommodations", label: "Accommodations", path: "/accommodations" },
];

export default function PeopleTabBar({
  courseId,
  active,
  studentView,
}: {
  courseId: string;
  active: PeopleView;
  studentView?: boolean;
}) {
  const { canManageAccommodations } = usePermissions();
  const tabs = studentView
    ? TABS.filter((tab) => tab.id === "roster" || tab.id === "groups")
    : TABS.filter((tab) => tab.id !== "accommodations" || canManageAccommodations);

  return (
    <div className="mt-6 flex border-b border-gray-200 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={`/courses/${courseId}/people${tab.path}`}
          className={`-mb-px border-b-2 px-4 py-2.5 transition-colors ${
            active === tab.id
              ? "border-canvas-blue font-medium text-canvas-blue"
              : "border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
