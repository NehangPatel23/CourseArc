import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Mail, Plus, Search, Trash2, Users } from "lucide-react";
import AddPersonModal from "../components/AddPersonModal";
import CourseHeader from "../components/CourseHeader";
import PageIdentityHeader from "../components/PageIdentityHeader";
import PeopleTabBar from "../components/PeopleTabBar";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";
import { getCourseById } from "../utils/coursesStore";
import {
  addRosterMember,
  COURSE_ROSTER_CHANGED_EVENT,
  isPrimaryInstructor,
  loadRoster,
  removeRosterMember,
  ROSTER_ROLE_LABELS,
  type RosterMember,
  type RosterRole,
} from "../utils/courseRoster";
import {
  COURSE_SECTIONS_CHANGED_EVENT,
  getSectionForStudent,
} from "../utils/courseSections";
import { matchesSearch } from "../utils/listFilters";
import StudentSectionBadge from "../components/StudentSectionBadge";
import { loadUser } from "../utils/userStore";

export default function PeoplePage() {
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const course = courseId ? getCourseById(courseId) : null;
  const { studentView } = useStudentView(effectiveCourseId);
  const { canAddStudents, canManageStaffRoster } = usePermissions();
  const { showToast } = useToast();
  const selfId = loadUser().id;

  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setRoster(loadRoster(effectiveCourseId));
    refresh();
    window.addEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
    window.addEventListener(COURSE_SECTIONS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
      window.removeEventListener(COURSE_SECTIONS_CHANGED_EVENT, refresh);
    };
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

  const handleAdd = (input: { name: string; email?: string; role: RosterRole }) => {
    addRosterMember(effectiveCourseId, input);
    showToast("Person added to roster", "positive");
  };

  const handleRemove = (id: string, memberName: string) => {
    removeRosterMember(effectiveCourseId, id);
    showToast(`${memberName} removed from roster`, "positive");
  };

  const students = roster.filter((m) => m.role === "student");
  const selectedStudents = students.filter((m) => selectedIds.includes(m.id));
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <PageIdentityHeader
          size="md"
          icon={Users}
          label="People"
          title="People"
          description={
            studentView
              ? "Classmates enrolled in this course."
              : "Manage the course roster used by the gradebook."
          }
          actions={
            !studentView ? (
              <div className="flex items-center gap-2">
                {selectedStudents.length > 0 && (
                  <Link
                    to={`/inbox?compose=1&course=${encodeURIComponent(effectiveCourseId)}&to=${encodeURIComponent(selectedStudents.map((s) => s.id).join(","))}`}
                    className="btn-canvas-secondary inline-flex items-center gap-1.5 text-sm"
                  >
                    <Mail className="h-4 w-4" />
                    Message selected ({selectedStudents.length})
                  </Link>
                )}
                {canAddStudents ? (
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="btn-canvas-primary inline-flex items-center gap-1.5 text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add person
                  </button>
                ) : null}
              </div>
            ) : undefined
          }
        />

        <PeopleTabBar
          courseId={effectiveCourseId}
          active="roster"
          studentView={studentView}
        />

        {studentView && (
          <div className="mt-4">
            <StudentSectionBadge courseId={effectiveCourseId} studentView />
          </div>
        )}

        <div className="mt-6">
          <div className="relative mb-4 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              className="form-input h-10 w-full pl-9 text-sm"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
              {roster.length === 0 ? "No people enrolled yet." : "No people match your search."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-canvas-grayLight/60 text-left text-xs uppercase tracking-wide text-gray-500">
                    {!studentView && (
                      <th className="w-10 px-3 py-3">
                        {students.length > 0 ? (
                          <input
                            type="checkbox"
                            checked={
                              students.length > 0 &&
                              students.every((s) => selectedIds.includes(s.id))
                            }
                            onChange={(e) =>
                              setSelectedIds(e.target.checked ? students.map((s) => s.id) : [])
                            }
                            aria-label="Select all students"
                          />
                        ) : null}
                      </th>
                    )}
                    <th className="px-5 py-3 font-semibold">Name</th>
                    {!studentView && <th className="px-5 py-3 font-semibold">Email</th>}
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Section</th>
                    <th className="w-24 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((member) => (
                    <tr key={member.id} className="border-b border-gray-100 last:border-0">
                      {!studentView && (
                        <td className="px-3 py-3">
                          {member.role === "student" ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(member.id)}
                              onChange={() => toggleSelected(member.id)}
                              aria-label={`Select ${member.name}`}
                            />
                          ) : null}
                        </td>
                      )}
                      <td className="px-5 py-3 font-medium text-canvas-grayDark">
                        {!studentView && member.role === "student" ? (
                          <Link
                            to={`/portfolio?courseId=${encodeURIComponent(effectiveCourseId)}&studentId=${encodeURIComponent(member.id)}`}
                            className="text-canvas-blue hover:underline"
                          >
                            {member.name}
                          </Link>
                        ) : (
                          member.name
                        )}
                      </td>
                      {!studentView && (
                        <td className="px-5 py-3 text-gray-600">{member.email || "—"}</td>
                      )}
                      <td className="px-5 py-3 text-gray-600">
                        {ROSTER_ROLE_LABELS[member.role]}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {member.role === "student"
                          ? getSectionForStudent(effectiveCourseId, member.id)?.name ?? "—"
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {member.id !== selfId && (
                            <Link
                              to={`/inbox?compose=1&course=${encodeURIComponent(effectiveCourseId)}&to=${encodeURIComponent(member.id)}`}
                              className="rounded p-1.5 text-gray-400 hover:bg-canvas-blueTint hover:text-canvas-blue"
                              aria-label={`Message ${member.name}`}
                              title={`Message ${member.name}`}
                            >
                              <Mail className="h-4 w-4" />
                            </Link>
                          )}
                          {!studentView &&
                            ((member.role === "student" && canAddStudents) ||
                              (member.role !== "student" && canManageStaffRoster)) &&
                            !isPrimaryInstructor(member) && (
                            <button
                              type="button"
                              onClick={() => handleRemove(member.id, member.name)}
                              className="rounded p-1.5 text-canvas-red hover:bg-red-50"
                              aria-label={`Remove ${member.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAdd && canAddStudents && (
        <AddPersonModal
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
          allowedRoles={canManageStaffRoster ? undefined : ["student"]}
        />
      )}
    </div>
  );
}
