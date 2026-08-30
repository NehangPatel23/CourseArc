import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ClipboardList,
  ExternalLink,
  Mail,
  MessagesSquare,
  Plus,
  Shuffle,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import CourseHeader from "../components/CourseHeader";
import PageIdentityHeader from "../components/PageIdentityHeader";
import PeopleTabBar from "../components/PeopleTabBar";
import UserAvatar from "../components/UserAvatar";
import { useToast } from "../components/ui/Toast";
import { isStudentVisibleAssignment, loadAssignments, type Assignment } from "../utils/assignments";
import { isStudentVisibleTopic, loadTopics, type DiscussionTopic } from "../utils/discussions";
import { getCourseById } from "../utils/coursesStore";
import {
  COURSE_ROSTER_CHANGED_EVENT,
  loadRoster,
  type RosterMember,
} from "../utils/courseRoster";
import {
  addGroupSet,
  addGroupToSet,
  deleteGroup,
  deleteGroupSet,
  GROUP_SETS_CHANGED_EVENT,
  groupsForStudent,
  loadGroupSets,
  reasonCannotJoinGroup,
  setStudentGroup,
  studentSelfSignup,
  updateGroup,
  updateGroupSet,
  type CourseGroup,
  type GroupJoinError,
  type GroupSet,
} from "../utils/groupSets";
import { usePermissions } from "../utils/permissions";
import { useStudentView } from "../utils/studentView";
import { loadUser } from "../utils/userStore";

type LinkedWork = {
  assignments: Assignment[];
  discussions: DiscussionTopic[];
};

function linkedWorkForSet(courseId: string, setId: string, studentView: boolean): LinkedWork {
  const assignments = loadAssignments(courseId).filter(
    (a) => a.groupSetId === setId && (!studentView || isStudentVisibleAssignment(a)),
  );
  const discussions = loadTopics(courseId).filter(
    (t) => t.groupSetId === setId && (!studentView || isStudentVisibleTopic(t)),
  );
  return { assignments, discussions };
}

function memberCountLabel(n: number) {
  return `${n} ${n === 1 ? "member" : "members"}`;
}

function joinErrorMessage(err: GroupJoinError) {
  return err === "full"
    ? "That group is full."
    : "Students in this set must be from the same section.";
}

export default function PeopleGroupsPage() {
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const course = courseId ? getCourseById(courseId) : null;
  const { studentView } = useStudentView(effectiveCourseId);
  const { canEditCourseContent: canEdit } = usePermissions();
  const { showToast } = useToast();

  const [sets, setSets] = useState<GroupSet[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [newSetName, setNewSetName] = useState("");
  const [selfSignup, setSelfSignup] = useState(false);
  const [sameSectionOnly, setSameSectionOnly] = useState(false);
  const [maxGroupSize, setMaxGroupSize] = useState("");

  useEffect(() => {
    const refresh = () => {
      setSets(loadGroupSets(effectiveCourseId));
      setRoster(loadRoster(effectiveCourseId));
    };
    refresh();
    window.addEventListener(GROUP_SETS_CHANGED_EVENT, refresh);
    window.addEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(GROUP_SETS_CHANGED_EVENT, refresh);
      window.removeEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
    };
  }, [effectiveCourseId]);

  const students = useMemo(() => roster.filter((m) => m.role === "student"), [roster]);
  const me = loadUser();
  const mine = useMemo(
    () => groupsForStudent(effectiveCourseId, me.id),
    [effectiveCourseId, sets, me.id],
  );

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

  const assignedAnywhere = new Set(sets.flatMap((s) => s.groups.flatMap((g) => g.studentIds)));
  const unassignedAnywhere = students.filter((s) => !assignedAnywhere.has(s.id)).length;

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <PageIdentityHeader
          size="md"
          icon="users"
          label="People"
          title="Groups"
          description={
            studentView
              ? "Your teammates, how to reach them, and group assignments attached to each set."
              : "Build group sets, assign students, and reuse a set on an assignment or discussion."
          }
        />
        <PeopleTabBar
          courseId={effectiveCourseId}
          active="groups"
          studentView={studentView}
        />

        {!canEdit ? (
          <StudentGroupsView
            courseId={effectiveCourseId}
            sets={sets}
            students={students}
            meId={me.id}
            mine={mine}
            onToast={showToast}
          />
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Group sets" value={sets.length} />
              <StatCard label="Groups" value={sets.reduce((n, s) => n + s.groups.length, 0)} />
              <StatCard
                label="Unassigned students"
                value={unassignedAnywhere}
                hint={
                  students.length
                    ? `${students.length - unassignedAnywhere} of ${students.length} in at least one group`
                    : "No students on the roster yet"
                }
              />
            </div>

            <form
              className="rounded-xl border border-gray-200 bg-canvas-grayLight/40 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                addGroupSet(effectiveCourseId, {
                  name: newSetName.trim() || `Group set ${sets.length + 1}`,
                  selfSignup,
                  sameSectionOnly,
                  maxGroupSize: maxGroupSize ? Number(maxGroupSize) : undefined,
                });
                setNewSetName("");
                setSelfSignup(false);
                setSameSectionOnly(false);
                setMaxGroupSize("");
                showToast("Group set created", "positive");
              }}
            >
              <p className="text-sm font-semibold text-canvas-grayDark">New group set</p>
              <p className="mt-1 text-sm text-gray-600">
                A set is a collection of teams you can attach to group work. Students belong to one
                team per set.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="New group set name"
                  className="form-input h-10 min-w-[12rem] flex-1"
                />
                <label className="form-checkbox-label text-sm">
                  <input
                    type="checkbox"
                    checked={selfSignup}
                    onChange={(e) => setSelfSignup(e.target.checked)}
                  />
                  Self-signup
                </label>
                <label className="form-checkbox-label text-sm">
                  <input
                    type="checkbox"
                    checked={sameSectionOnly}
                    onChange={(e) => setSameSectionOnly(e.target.checked)}
                  />
                  Same section only
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxGroupSize}
                  onChange={(e) => setMaxGroupSize(e.target.value)}
                  placeholder="Max size"
                  className="form-input h-10 w-28"
                  aria-label="Maximum group size"
                />
                <button type="submit" className="btn-canvas-primary inline-flex items-center gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add set
                </button>
              </div>
            </form>

            {sets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-5 py-12 text-center">
                <UsersRound className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-canvas-grayDark">No group sets yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  Create a set such as Project teams or Lab pairs, then add groups and assign students.
                </p>
              </div>
            ) : (
              sets.map((set) => (
                <GroupSetCard
                  key={set.id}
                  courseId={effectiveCourseId}
                  set={set}
                  students={students}
                  work={linkedWorkForSet(effectiveCourseId, set.id, false)}
                  onToast={showToast}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-canvas-grayDark">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function GroupSetCard({
  courseId,
  set,
  students,
  work,
  onToast,
}: {
  courseId: string;
  set: GroupSet;
  students: RosterMember[];
  work: LinkedWork;
  onToast: (msg: string, kind: "positive" | "negative") => void;
}) {
  const [groupName, setGroupName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<"set" | { groupId: string; name: string } | null>(
    null,
  );
  const assigned = new Set(set.groups.flatMap((g) => g.studentIds));
  const unassigned = students.filter((s) => !assigned.has(s.id));
  const assignedCount = students.length - unassigned.length;
  const coverage = students.length ? Math.round((assignedCount / students.length) * 100) : 0;

  const splitEvenly = () => {
    if (set.groups.length === 0 || unassigned.length === 0) return;
    unassigned.forEach((student, index) => {
      const group = set.groups[index % set.groups.length];
      if (group) setStudentGroup(courseId, set.id, student.id, group.id);
    });
    onToast("Unassigned students split across groups", "positive");
  };

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-canvas-grayLight/40 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <input
              defaultValue={set.name}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== set.name) updateGroupSet(courseId, set.id, { name });
              }}
              className="form-input h-9 max-w-sm font-semibold"
              aria-label="Group set name"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                  set.selfSignup
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {set.selfSignup ? "Self-signup" : "Instructor assigned"}
              </span>
              <span className="text-sm text-gray-500">
                {set.groups.length} {set.groups.length === 1 ? "group" : "groups"} · {assignedCount}/
                {students.length} students
              </span>
            </div>
            <div className="mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-canvas-blue transition-all"
                style={{ width: `${coverage}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingDelete("set")}
            className="rounded p-1.5 text-canvas-red hover:bg-red-50"
            aria-label={`Delete ${set.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <label className="form-checkbox-label mt-3 text-sm">
          <input
            type="checkbox"
            checked={Boolean(set.selfSignup)}
            onChange={(e) => updateGroupSet(courseId, set.id, { selfSignup: e.target.checked })}
          />
          Allow students to sign up
        </label>
        <label className="form-checkbox-label mt-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(set.sameSectionOnly)}
            onChange={(e) =>
              updateGroupSet(courseId, set.id, { sameSectionOnly: e.target.checked })
            }
          />
          Require same section
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
          Max group size
          <input
            type="number"
            min={0}
            value={set.maxGroupSize ?? ""}
            onChange={(e) =>
              updateGroupSet(courseId, set.id, {
                maxGroupSize: e.target.value ? Number(e.target.value) : 0,
              })
            }
            placeholder="None"
            className="form-input h-8 w-24"
          />
        </label>
        <LinkedWorkChips courseId={courseId} work={work} />
      </div>

      <div className="px-5 py-4">
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addGroupToSet(courseId, set.id, {
              name: groupName.trim() || `Group ${set.groups.length + 1}`,
            });
            setGroupName("");
            onToast("Group added", "positive");
          }}
        >
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="New group name"
            className="form-input h-9 flex-1"
          />
          <button
            type="submit"
            className="btn-canvas-secondary inline-flex h-9 items-center gap-1 px-3 text-sm"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Add group
          </button>
        </form>

        {unassigned.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {unassigned.length} unassigned {unassigned.length === 1 ? "student" : "students"}
                </p>
                <p className="text-xs text-amber-800/80">
                  Place them in a group, or split everyone remaining evenly.
                </p>
              </div>
              {set.groups.length > 0 ? (
                <button
                  type="button"
                  className="btn-canvas-secondary inline-flex items-center gap-1.5 text-xs"
                  onClick={splitEvenly}
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  Split evenly
                </button>
              ) : null}
            </div>
            <ul className="mt-3 space-y-2">
              {unassigned.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2">
                  <GroupMemberIdentity member={m} compact />
                  {set.groups.length > 0 ? (
                    <select
                      className="form-input h-8 max-w-xs text-sm"
                      defaultValue=""
                      aria-label={`Assign ${m.name}`}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const ok = setStudentGroup(courseId, set.id, m.id, e.target.value);
                        if (!ok) {
                          const group = set.groups.find((g) => g.id === e.target.value);
                          const err = group
                            ? reasonCannotJoinGroup(courseId, set, group, m.id)
                            : "full";
                          onToast(err ? joinErrorMessage(err) : "Could not assign", "negative");
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">Choose group…</option>
                      {set.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.studentIds.length})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-amber-800/80">Add a group first</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : students.length > 0 ? (
          <p className="mt-3 text-sm text-emerald-700">Every student is in a group.</p>
        ) : null}

        {set.groups.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            No groups in this set yet. Add Team A, Lab 1, or another name above.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {set.groups.map((group) => {
              const members = students.filter((s) => group.studentIds.includes(s.id));
              return (
                <div key={group.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        defaultValue={group.name}
                        onBlur={(e) => {
                          const name = e.target.value.trim();
                          if (name && name !== group.name) {
                            updateGroup(courseId, set.id, group.id, { name });
                          }
                        }}
                        className="form-input h-8 font-medium"
                        aria-label="Group name"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <AvatarStack members={members} />
                        <span className="text-xs text-gray-500">{memberCountLabel(members.length)}</span>
                      </div>
                      <Link
                        to={`/courses/${courseId}/groups/${group.id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-canvas-blue hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open homepage
                      </Link>
                      {members.length > 0 && (
                        <label className="mt-2 block text-xs text-gray-500">
                          Leader
                          <select
                            value={group.leaderId ?? ""}
                            onChange={(e) =>
                              updateGroup(courseId, set.id, group.id, {
                                leaderId: e.target.value || undefined,
                              })
                            }
                            className="form-input mt-1 h-8 text-sm"
                          >
                            <option value="">None</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingDelete({ groupId: group.id, name: group.name })}
                      className="rounded p-1 text-canvas-red hover:bg-red-50"
                      aria-label={`Delete ${group.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="mt-3 divide-y divide-gray-100">
                    {members.length === 0 ? (
                      <li className="py-2 text-sm text-gray-500">No students yet.</li>
                    ) : (
                      members.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                          <GroupMemberIdentity member={m} />
                          <button
                            type="button"
                            onClick={() => setStudentGroup(courseId, set.id, m.id, null)}
                            className="shrink-0 text-xs text-gray-500 hover:text-canvas-red"
                          >
                            Remove
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmActionModal
        isOpen={pendingDelete !== null}
        tone="danger"
        title={pendingDelete === "set" ? `Delete ${set.name}?` : `Delete ${pendingDelete?.name}?`}
        description={
          pendingDelete === "set"
            ? "Students will be unassigned from every group in this set."
            : "Students in this group will become unassigned."
        }
        confirmText="Delete"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete === "set") {
            deleteGroupSet(courseId, set.id);
            onToast("Group set deleted", "positive");
          } else if (pendingDelete) {
            deleteGroup(courseId, set.id, pendingDelete.groupId);
            onToast("Group deleted", "positive");
          }
          setPendingDelete(null);
        }}
      />
    </section>
  );
}

function LinkedWorkChips({
  courseId,
  work,
}: {
  courseId: string;
  work: LinkedWork;
}) {
  if (work.assignments.length === 0 && work.discussions.length === 0) {
    return (
      <p className="mt-3 text-xs text-gray-500">
        Not attached to any assignment or discussion yet.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {work.assignments.map((a) => (
        <Link
          key={a.id}
          to={`/courses/${courseId}/assignments/${a.id}`}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-canvas-blue hover:border-canvas-blue/40"
        >
          <ClipboardList className="h-3 w-3" />
          {a.title}
        </Link>
      ))}
      {work.discussions.map((t) => (
        <Link
          key={t.id}
          to={`/courses/${courseId}/discussions/${t.id}`}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-canvas-blue hover:border-canvas-blue/40"
        >
          <MessagesSquare className="h-3 w-3" />
          {t.title}
        </Link>
      ))}
    </div>
  );
}

function AvatarStack({ members }: { members: RosterMember[] }) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  if (members.length === 0) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <UserPlus className="h-3.5 w-3.5" />
      </div>
    );
  }
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((m) => (
        <UserAvatar key={m.id} name={m.name} size="sm" className="ring-2 ring-white" />
      ))}
      {extra > 0 ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 ring-2 ring-white">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

function GroupMemberIdentity({
  member,
  you = false,
  compact = false,
}: {
  member: RosterMember;
  you?: boolean;
  compact?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <UserAvatar name={member.name} size="sm" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm text-canvas-grayDark">
          <span className="truncate font-medium">{member.name}</span>
          {you && (
            <span className="shrink-0 rounded bg-canvas-blueTint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-canvas-blue">
              You
            </span>
          )}
        </span>
        {member.email ? (
          <a
            href={`mailto:${member.email}`}
            className={`mt-0.5 block truncate text-canvas-blue hover:underline ${
              compact ? "text-[11px]" : "text-xs"
            }`}
          >
            {member.email}
          </a>
        ) : (
          <span className={`mt-0.5 block text-gray-400 ${compact ? "text-[11px]" : "text-xs"}`}>
            No email on file
          </span>
        )}
      </span>
    </span>
  );
}

function SelfSignupGroupList({
  courseId,
  set,
  students,
  meId,
  currentGroupId,
  canSwitch,
  onToast,
}: {
  courseId: string;
  set: GroupSet;
  students: RosterMember[];
  meId: string;
  currentGroupId?: string;
  canSwitch: boolean;
  onToast: (msg: string, kind: "positive" | "negative") => void;
}) {
  const join = (group: CourseGroup) => {
    const err = reasonCannotJoinGroup(courseId, set, group, meId);
    if (err) {
      onToast(joinErrorMessage(err), "negative");
      return;
    }
    const ok = studentSelfSignup(courseId, set.id, meId, group.id);
    if (!ok) {
      onToast("Could not join this group", "negative");
      return;
    }
    onToast(currentGroupId ? `Switched to ${group.name}` : `Joined ${group.name}`, "positive");
  };

  const leave = () => {
    studentSelfSignup(courseId, set.id, meId, null);
    onToast("Left the group", "positive");
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <div
        className={`hidden gap-3 border-b border-gray-200 bg-canvas-grayLight/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:grid ${
          canSwitch
            ? "sm:grid-cols-[minmax(8rem,1fr)_minmax(12rem,1.6fr)_7rem]"
            : "sm:grid-cols-[minmax(8rem,1fr)_minmax(12rem,1.6fr)]"
        }`}
      >
        <span>Group</span>
        <span>Members</span>
        {canSwitch ? <span className="text-right">Join</span> : null}
      </div>
      <ul className="divide-y divide-gray-100">
        {set.groups.length === 0 ? (
          <li className="px-4 py-6 text-sm text-gray-500">No groups in this set yet.</li>
        ) : (
          set.groups.map((group) => {
            const members = students.filter((s) => group.studentIds.includes(s.id));
            const isCurrent = group.id === currentGroupId;
            return (
              <li
                key={group.id}
                className={`grid items-start gap-3 px-4 py-3 ${
                  canSwitch
                    ? "sm:grid-cols-[minmax(8rem,1fr)_minmax(12rem,1.6fr)_7rem]"
                    : "sm:grid-cols-[minmax(8rem,1fr)_minmax(12rem,1.6fr)]"
                } ${isCurrent ? "bg-canvas-blueTint/50" : "bg-white"}`}
              >
                <div className="min-w-0 pt-0.5">
                  <p className="truncate font-medium text-canvas-grayDark">{group.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{memberCountLabel(members.length)}</p>
                  {isCurrent ? (
                    <span className="mt-1 inline-block rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-canvas-blue">
                      Your group
                    </span>
                  ) : null}
                </div>
                <ul className="min-w-0 space-y-2">
                  {members.length === 0 ? (
                    <li className="text-sm text-gray-500">No students yet</li>
                  ) : (
                    members.map((m) => (
                      <li key={m.id}>
                        <GroupMemberIdentity member={m} you={m.id === meId} compact />
                      </li>
                    ))
                  )}
                </ul>
                {canSwitch ? (
                  <div className="flex shrink-0 justify-end pt-0.5">
                    {isCurrent ? (
                      <button
                        type="button"
                        className="text-xs text-gray-500 hover:text-canvas-red"
                        onClick={leave}
                      >
                        Leave
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-canvas-primary text-xs"
                        onClick={() => join(group)}
                      >
                        {currentGroupId ? "Switch to" : "Join"}
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function StudentGroupsView({
  courseId,
  sets,
  students,
  meId,
  mine,
  onToast,
}: {
  courseId: string;
  sets: GroupSet[];
  students: RosterMember[];
  meId: string;
  mine: { set: GroupSet; group: CourseGroup }[];
  onToast: (msg: string, kind: "positive" | "negative") => void;
}) {
  const mineSetIds = new Set(mine.map(({ set }) => set.id));
  const joinable = sets.filter((set) => set.selfSignup && !mineSetIds.has(set.id));
  const waiting = sets.filter((set) => !set.selfSignup && !mineSetIds.has(set.id));

  if (mine.length === 0 && joinable.length === 0 && waiting.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-gray-200 px-5 py-12 text-center">
        <UsersRound className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-3 text-sm font-medium text-canvas-grayDark">You’re not in a group yet</p>
        <p className="mt-1 text-sm text-gray-500">
          Your instructor will assign teams, or open self-signup so you can join from this page.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      {mine.map(({ set, group }) => {
        const members = students.filter((s) => group.studentIds.includes(s.id));
        const emails = members
          .filter((m) => m.id !== meId && m.email)
          .map((m) => m.email) as string[];
        const work = linkedWorkForSet(courseId, set.id, true);
        return (
          <section key={set.id} className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <div className="bg-gradient-to-r from-canvas-blueTint/80 to-white px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{set.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <AvatarStack members={members} />
                <div>
                  <h3 className="text-lg font-semibold text-canvas-grayDark">{group.name}</h3>
                  <p className="text-sm text-gray-600">
                    {memberCountLabel(members.length)}
                    {set.selfSignup ? " · Self-signup is open" : " · Assigned by your instructor"}
                  </p>
                  <Link
                    to={`/courses/${courseId}/groups/${group.id}`}
                    className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-canvas-blue hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open group homepage
                  </Link>
                </div>
              </div>
              <LinkedWorkChips courseId={courseId} work={work} />
            </div>

            <div className="px-5 py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-canvas-grayDark">All groups</p>
                  <p className="text-xs text-gray-500">
                    {set.selfSignup
                      ? "See who is in each group, then join or switch."
                      : "Everyone in this set. Your instructor assigned your group."}
                  </p>
                </div>
                {emails.length > 0 ? (
                  <a
                    href={`mailto:${emails.join(",")}`}
                    className="inline-flex items-center gap-1.5 text-sm text-canvas-blue hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email teammates
                  </a>
                ) : null}
              </div>
              <SelfSignupGroupList
                courseId={courseId}
                set={set}
                students={students}
                meId={meId}
                currentGroupId={group.id}
                canSwitch={Boolean(set.selfSignup)}
                onToast={onToast}
              />
            </div>
          </section>
        );
      })}

      {joinable.map((set) => (
        <section key={set.id} className="rounded-xl border border-dashed border-canvas-blue/30 bg-canvas-blueTint/30 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{set.name}</p>
          <h3 className="mt-1 text-base font-semibold text-canvas-grayDark">Self-signup is open</h3>
          <p className="mt-0.5 text-sm text-gray-600">
            Browse every group and its members, then join the one you want.
          </p>
          <div className="mt-4">
            <SelfSignupGroupList
              courseId={courseId}
              set={set}
              students={students}
              meId={meId}
              canSwitch
              onToast={onToast}
            />
          </div>
        </section>
      ))}

      {waiting.map((set) => (
        <section key={set.id} className="rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{set.name}</p>
          <p className="mt-1 text-sm text-gray-600">
            Your instructor will place you in a group.
          </p>
          <div className="mt-4">
            <SelfSignupGroupList
              courseId={courseId}
              set={set}
              students={students}
              meId={meId}
              canSwitch={false}
              onToast={onToast}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
