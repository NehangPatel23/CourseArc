import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Trash2, Users } from "lucide-react";
import AddPersonModal from "../components/AddPersonModal";
import CourseHeader from "../components/CourseHeader";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../utils/studentView";
import { getCourseById } from "../utils/coursesStore";
import {
  addRosterMember,
  COURSE_ROSTER_CHANGED_EVENT,
  loadRoster,
  removeRosterMember,
  type RosterMember,
} from "../utils/courseRoster";
import { matchesSearch } from "../utils/listFilters";

export default function PeoplePage() {
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const course = courseId ? getCourseById(courseId) : null;
  const { studentView } = useStudentView(effectiveCourseId);
  const { showToast } = useToast();

  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const refresh = () => setRoster(loadRoster(effectiveCourseId));
    refresh();
    window.addEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
  }, [effectiveCourseId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return roster;
    return roster.filter(
      (m) => matchesSearch(m.name, search) || matchesSearch(m.email ?? "", search),
    );
  }, [roster, search]);

  if (!course) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Course not found.</p>
        <Link to="/" className="text-canvas-blue hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const handleAdd = (input: { name: string; email?: string; role: "student" | "ta" }) => {
    addRosterMember(effectiveCourseId, input);
    showToast("Person added to roster", "positive");
  };

  const handleRemove = (id: string, memberName: string) => {
    removeRosterMember(effectiveCourseId, id);
    showToast(`${memberName} removed from roster`, "positive");
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" />
              <h1 className="text-2xl font-semibold text-canvas-grayDark">People</h1>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {studentView
                ? "Classmates enrolled in this course."
                : "Manage the course roster used by the gradebook."}
            </p>
          </div>
          {!studentView && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="btn-canvas-primary inline-flex items-center gap-1.5 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add person
            </button>
          )}
        </div>

        <div className="mt-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people…"
            className="form-input mb-4 max-w-sm text-sm"
          />

          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
              {roster.length === 0 ? "No people enrolled yet." : "No people match your search."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-canvas-grayLight/60 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    {!studentView && <th className="px-5 py-3 font-semibold">Email</th>}
                    <th className="px-5 py-3 font-semibold">Role</th>
                    {!studentView && <th className="w-12 px-3 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((member) => (
                    <tr key={member.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-5 py-3 font-medium text-canvas-grayDark">{member.name}</td>
                      {!studentView && (
                        <td className="px-5 py-3 text-gray-600">{member.email || "—"}</td>
                      )}
                      <td className="px-5 py-3 capitalize text-gray-600">{member.role}</td>
                      {!studentView && (
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemove(member.id, member.name)}
                            className="rounded p-1.5 text-canvas-red hover:bg-red-50"
                            aria-label={`Remove ${member.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAdd && !studentView && (
        <AddPersonModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
      )}
    </div>
  );
}
