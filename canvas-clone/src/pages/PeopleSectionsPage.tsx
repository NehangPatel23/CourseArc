import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layers, Plus, Trash2, Users } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import PageIdentityHeader from "../components/PageIdentityHeader";
import PeopleTabBar from "../components/PeopleTabBar";
import StudentSectionBadge from "../components/StudentSectionBadge";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";
import { getCourseById } from "../utils/coursesStore";
import { loadUser } from "../utils/userStore";
import {
  COURSE_ROSTER_CHANGED_EVENT,
  loadRoster,
  type RosterMember,
} from "../utils/courseRoster";
import {
  addSection,
  COURSE_SECTIONS_CHANGED_EVENT,
  deleteSection,
  loadSections,
  setStudentSection,
  updateSection,
  type CourseSection,
} from "../utils/courseSections";

export default function PeopleSectionsPage() {
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const course = courseId ? getCourseById(courseId) : null;
  const { studentView } = useStudentView(effectiveCourseId);
  const { canManageCourse } = usePermissions();
  const { showToast } = useToast();

  const [sections, setSections] = useState<CourseSection[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [newName, setNewName] = useState("");
  const [assignFilter, setAssignFilter] = useState<"all" | "unassigned">("all");

  useEffect(() => {
    const refresh = () => {
      setSections(loadSections(effectiveCourseId));
      setRoster(loadRoster(effectiveCourseId));
    };
    refresh();
    window.addEventListener(COURSE_SECTIONS_CHANGED_EVENT, refresh);
    window.addEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(COURSE_SECTIONS_CHANGED_EVENT, refresh);
      window.removeEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
    };
  }, [effectiveCourseId]);

  const students = useMemo(
    () => roster.filter((m) => m.role === "student"),
    [roster],
  );
  const sectionByStudent = useMemo(() => {
    const map = new Map<string, CourseSection>();
    for (const s of sections) {
      for (const id of s.studentIds) map.set(id, s);
    }
    return map;
  }, [sections]);
  const unassignedStudents = useMemo(
    () => students.filter((s) => !sectionByStudent.get(s.id)),
    [students, sectionByStudent],
  );
  const assignRows = assignFilter === "unassigned" ? unassignedStudents : students;

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

  const add = () => {
    const name = newName.trim() || `Section ${String(sections.length + 1).padStart(3, "0")}`;
    addSection(effectiveCourseId, { name });
    setNewName("");
    showToast("Section created", "positive");
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <PageIdentityHeader
          size="md"
          icon={Layers}
          label="People"
          title="Sections"
          description={
            studentView
              ? "Your section membership for this course."
              : "Assign students to sections so you can set differentiated due dates."
          }
        />

        <PeopleTabBar
          courseId={effectiveCourseId}
          active="sections"
          studentView={studentView}
        />

        {studentView ? (
          <div className="mt-6 rounded-xl border border-gray-200 px-5 py-6">
            <StudentSectionBadge courseId={effectiveCourseId} studentView />
            <p className="mt-2 text-sm text-canvas-grayDark">
              {sectionByStudent.get(loadUser().id)
                ? `You are in ${sectionByStudent.get(loadUser().id)!.name}.`
                : "You are not assigned to a section."}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {canManageCourse && (
            <form
              className="flex max-w-md gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New section name"
                className="form-input h-10"
              />
              <button type="submit" className="btn-canvas-primary inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                Add
              </button>
            </form>
            )}

            {sections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
                No sections yet.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-gray-600">
                    Unassigned students: {unassignedStudents.length}
                  </p>
                  <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setAssignFilter("all")}
                      className={`rounded-md px-2.5 py-1 font-medium ${
                        assignFilter === "all"
                          ? "bg-canvas-grayDark text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignFilter("unassigned")}
                      className={`rounded-md px-2.5 py-1 font-medium ${
                        assignFilter === "unassigned"
                          ? "bg-canvas-grayDark text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Unassigned
                    </button>
                  </div>
                </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {sections.map((section) => {
                  const members = students.filter((s) => section.studentIds.includes(s.id));
                  return (
                    <div key={section.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <input
                          defaultValue={section.name}
                          readOnly={!canManageCourse}
                          onBlur={(e) => {
                            if (!canManageCourse) return;
                            const name = e.target.value.trim();
                            if (name && name !== section.name) {
                              updateSection(effectiveCourseId, section.id, { name });
                            }
                          }}
                          className="form-input h-9 font-semibold"
                        />
                        {canManageCourse && (
                          <button
                            type="button"
                            onClick={() => {
                              deleteSection(effectiveCourseId, section.id);
                              showToast("Section deleted", "positive");
                            }}
                            className="rounded p-1.5 text-canvas-red hover:bg-red-50"
                            aria-label={`Delete ${section.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {members.length} student{members.length === 1 ? "" : "s"}
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {members.length === 0 ? (
                          <li className="text-sm text-gray-500">No students assigned.</li>
                        ) : (
                          members.map((m) => (
                            <li
                              key={m.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span className="text-canvas-grayDark">{m.name}</span>
                              {canManageCourse && (
                              <button
                                type="button"
                                onClick={() => setStudentSection(effectiveCourseId, m.id, null)}
                                className="text-xs text-gray-500 hover:text-canvas-red"
                              >
                                Remove
                              </button>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
              </>
            )}

            <div>
              <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-canvas-grayDark">
                <Users className="h-4 w-4" />
                Assign students
              </h2>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-canvas-grayLight/60 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-5 py-3 font-semibold">Student</th>
                      <th className="px-5 py-3 font-semibold">Section</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignRows.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-5 py-6 text-center text-sm text-gray-500">
                          {assignFilter === "unassigned"
                            ? "Every student is in a section."
                            : "No students on the roster."}
                        </td>
                      </tr>
                    ) : (
                    assignRows.map((student) => (
                      <tr key={student.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-5 py-3 font-medium text-canvas-grayDark">
                          {student.name}
                        </td>
                        <td className="px-5 py-3">
                          {canManageCourse ? (
                          <select
                            value={sectionByStudent.get(student.id)?.id ?? ""}
                            onChange={(e) =>
                              setStudentSection(
                                effectiveCourseId,
                                student.id,
                                e.target.value || null,
                              )
                            }
                            className="form-input h-9 max-w-xs"
                          >
                            <option value="">Unassigned</option>
                            {sections.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          ) : (
                            <span className="text-canvas-grayDark">
                              {sectionByStudent.get(student.id)?.name ?? "Unassigned"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
