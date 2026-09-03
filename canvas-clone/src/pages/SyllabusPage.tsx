import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import DateTimeField from "../components/DateTimeField";
import PageIdentityHeader from "../components/PageIdentityHeader";
import RichContentEditor from "../components/RichContentEditor";
import RichContentViewer from "../components/RichContentViewer";
import { useToast } from "../components/ui/Toast";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";
import { studentViewEventName, useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";
import { COURSE_ROSTER_CHANGED_EVENT, isPrimaryInstructor } from "../utils/courseRoster";
import {
  createAssignmentGroupId,
  getCourseAssignmentGroups,
  getCourseById,
  isWeightedGradingEnabled,
  type AssignmentGroup,
} from "../utils/coursesStore";
import { getGradingScheme, type LetterGradeBand } from "../utils/gradingScheme";
import { APPOINTMENT_GROUPS_CHANGED_EVENT, newAppointmentGroupId } from "../utils/appointmentGroups";
import { DEMO_PERSONA_CHANGED_EVENT } from "../utils/demoPersona";
import { DUE_DATE_OVERRIDES_CHANGED_EVENT } from "../utils/dueDateOverrides";
import { loadUser } from "../utils/userStore";
import {
  applySyllabusGrading,
  applySyllabusLetterScheme,
  applySyllabusOfficeHours,
  applySyllabusSummaryItems,
  applySyllabusTeachingTeam,
  cloneGradingGroups,
  cloneLetterBands,
  cloneOfficeHours,
  cloneSummaryItems,
  cloneTeachingTeam,
  filterAndSortCourseSummaryItems,
  formatOfficeHoursWhen,
  formatSummaryDue,
  formatSummaryPoints,
  formatSyllabusUpdatedAt,
  getCourseSummaryItems,
  getSyllabusOfficeHours,
  getSyllabusTeachingTeam,
  loadSyllabus,
  newSyllabusMemberId,
  saveSyllabus,
  serializeGradingGroups,
  serializeLetterBands,
  serializeOfficeHours,
  serializeSummaryItems,
  serializeTeachingTeam,
  summaryKindLabel,
  syllabusContentEqual,
  SYLLABUS_CHANGED_EVENT,
  teachingRoleLabel,
  withSyllabusHeadingIds,
  type CourseSummaryItem,
  type CourseSummaryKindFilter,
  type CourseSummarySortDir,
  type CourseSummarySortKey,
  type CourseSummaryWhenFilter,
  type SyllabusOfficeHoursRow,
  type SyllabusTeachingMember,
} from "../utils/syllabus";

const KIND_FILTERS: { value: CourseSummaryKindFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "assignment", label: "Assignments" },
  { value: "quiz", label: "Quizzes" },
  { value: "discussion", label: "Discussions" },
];

const WHEN_FILTERS: { value: CourseSummaryWhenFilter; label: string }[] = [
  { value: "all", label: "All dates" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

function studentLetterGradeRows(bands: LetterGradeBand[]) {
  const sorted = [...bands]
    .filter((b) => b.letter.trim())
    .sort((a, b) => b.minPercent - a.minPercent);
  return sorted.map((band, index) => {
    const higher = sorted[index - 1];
    let range: string;
    if (!higher) {
      range = band.minPercent >= 100 ? "100%" : `${band.minPercent}% and above`;
    } else if (band.minPercent <= 0) {
      range = `Below ${higher.minPercent}%`;
    } else {
      const top = higher.minPercent - 1;
      range = top <= band.minPercent ? `${band.minPercent}%` : `${band.minPercent}–${top}%`;
    }
    return { letter: band.letter, range };
  });
}

export default function SyllabusPage() {
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const course = courseId ? getCourseById(courseId) : null;
  const { studentView } = useStudentView(effectiveCourseId);
  const { canEditCourseContent: canEdit } = usePermissions();
  const { showToast } = useToast();
  const studentId = loadUser().id;

  const [content, setContent] = useState("");
  const [showCourseSummary, setShowCourseSummary] = useState(true);
  const [showTeachingTeam, setShowTeachingTeam] = useState(true);
  const [showGrading, setShowGrading] = useState(true);
  const [showOfficeHours, setShowOfficeHours] = useState(true);
  const [teachingTeam, setTeachingTeam] = useState<SyllabusTeachingMember[]>([]);
  const [gradingGroups, setGradingGroups] = useState<AssignmentGroup[]>([]);
  const [weighted, setWeighted] = useState(true);
  const [officeHours, setOfficeHours] = useState<SyllabusOfficeHoursRow[]>([]);
  const [letterBands, setLetterBands] = useState<LetterGradeBand[]>([]);
  const [summaryItems, setSummaryItems] = useState<CourseSummaryItem[]>([]);
  const [savedAt, setSavedAt] = useState(0);
  const [savedContent, setSavedContent] = useState("");
  const [savedShowCourseSummary, setSavedShowCourseSummary] = useState(true);
  const [savedShowTeachingTeam, setSavedShowTeachingTeam] = useState(true);
  const [savedShowGrading, setSavedShowGrading] = useState(true);
  const [savedShowOfficeHours, setSavedShowOfficeHours] = useState(true);
  const [savedTeam, setSavedTeam] = useState("[]");
  const [savedGroups, setSavedGroups] = useState("[]");
  const [savedWeighted, setSavedWeighted] = useState(true);
  const [savedHours, setSavedHours] = useState("[]");
  const [savedBands, setSavedBands] = useState("[]");
  const [savedSummary, setSavedSummary] = useState("[]");
  const [summaryTick, setSummaryTick] = useState(0);

  const contentDirty =
    canEdit &&
    (!syllabusContentEqual(content, savedContent) ||
      showCourseSummary !== savedShowCourseSummary ||
      showTeachingTeam !== savedShowTeachingTeam ||
      showGrading !== savedShowGrading ||
      showOfficeHours !== savedShowOfficeHours);
  const teamDirty = canEdit && serializeTeachingTeam(teachingTeam) !== savedTeam;
  const gradingDirty =
    canEdit &&
    (serializeGradingGroups(gradingGroups) !== savedGroups ||
      weighted !== savedWeighted ||
      serializeLetterBands(letterBands) !== savedBands);
  const hoursDirty = canEdit && serializeOfficeHours(officeHours) !== savedHours;
  const summaryDirty = canEdit && serializeSummaryItems(summaryItems) !== savedSummary;
  const dirty = contentDirty || teamDirty || gradingDirty || hoursDirty || summaryDirty;

  const contentDirtyRef = useRef(contentDirty);
  const teamDirtyRef = useRef(teamDirty);
  const gradingDirtyRef = useRef(gradingDirty);
  const hoursDirtyRef = useRef(hoursDirty);
  const summaryDirtyRef = useRef(summaryDirty);
  contentDirtyRef.current = contentDirty;
  teamDirtyRef.current = teamDirty;
  gradingDirtyRef.current = gradingDirty;
  hoursDirtyRef.current = hoursDirty;
  summaryDirtyRef.current = summaryDirty;

  const { leaveGuardModal } = useUnsavedChangesGuard(dirty, {
    message: "You have unsaved syllabus changes. Leave without saving?",
  });

  useEffect(() => {
    const pull = () => {
      const s = loadSyllabus(effectiveCourseId);
      const courseNow = getCourseById(effectiveCourseId);
      const team = getSyllabusTeachingTeam(effectiveCourseId);
      const groups = getCourseAssignmentGroups(courseNow);
      const hours = getSyllabusOfficeHours(effectiveCourseId, { studentView });
      const bands = getGradingScheme(effectiveCourseId).bands;
      const rows = getCourseSummaryItems(effectiveCourseId, { studentView: false });
      if (!contentDirtyRef.current) {
        setContent(s.content);
        setShowCourseSummary(s.showCourseSummary);
        setShowTeachingTeam(s.showTeachingTeam);
        setShowGrading(s.showGrading);
        setShowOfficeHours(s.showOfficeHours);
        setSavedContent(s.content);
        setSavedShowCourseSummary(s.showCourseSummary);
        setSavedShowTeachingTeam(s.showTeachingTeam);
        setSavedShowGrading(s.showGrading);
        setSavedShowOfficeHours(s.showOfficeHours);
        setSavedAt(s.updatedAt);
      }
      if (!teamDirtyRef.current) {
        setTeachingTeam(cloneTeachingTeam(team));
        setSavedTeam(serializeTeachingTeam(team));
      }
      if (!gradingDirtyRef.current) {
        setGradingGroups(cloneGradingGroups(groups));
        setWeighted(isWeightedGradingEnabled(courseNow));
        setLetterBands(cloneLetterBands(bands));
        setSavedGroups(serializeGradingGroups(groups));
        setSavedWeighted(isWeightedGradingEnabled(courseNow));
        setSavedBands(serializeLetterBands(bands));
      }
      if (!hoursDirtyRef.current) {
        setOfficeHours(cloneOfficeHours(hours));
        setSavedHours(serializeOfficeHours(hours));
      }
      if (!summaryDirtyRef.current) {
        setSummaryItems(cloneSummaryItems(rows));
        setSavedSummary(serializeSummaryItems(rows));
      }
      setSummaryTick((n) => n + 1);
    };
    pull();
    const events = [
      SYLLABUS_CHANGED_EVENT,
      "canvasClone:assignmentsChanged",
      "canvasClone:quizzesChanged",
      "canvasClone:discussionsChanged",
      COURSE_ROSTER_CHANGED_EVENT,
      APPOINTMENT_GROUPS_CHANGED_EVENT,
      "canvasClone:coursesChanged",
      DUE_DATE_OVERRIDES_CHANGED_EVENT,
      "canvasClone:userChanged",
      studentViewEventName,
      DEMO_PERSONA_CHANGED_EVENT,
    ];
    for (const event of events) {
      window.addEventListener(event, pull);
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("canvasClone:")) pull();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      for (const event of events) {
        window.removeEventListener(event, pull);
      }
      window.removeEventListener("storage", onStorage);
    };
  }, [effectiveCourseId, studentView]);

  const liveSummary = useMemo(() => {
    void summaryTick;
    return getCourseSummaryItems(effectiveCourseId, {
      studentView,
      studentId: studentView ? studentId : undefined,
    });
  }, [effectiveCourseId, studentView, studentId, savedAt, summaryTick]);

  const displayedSummary = canEdit ? summaryItems : liveSummary;

  const { html: contentWithIds, headings } = useMemo(
    () => withSyllabusHeadingIds(content),
    [content],
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

  const save = () => {
    if (!dirty) return;
    if (teamDirty) {
      const team = applySyllabusTeachingTeam(effectiveCourseId, teachingTeam);
      setTeachingTeam(cloneTeachingTeam(team));
      setSavedTeam(serializeTeachingTeam(team));
    }
    if (gradingDirty) {
      const groups = applySyllabusGrading(effectiveCourseId, gradingGroups, weighted);
      const bands = applySyllabusLetterScheme(effectiveCourseId, letterBands);
      setGradingGroups(cloneGradingGroups(groups));
      setLetterBands(cloneLetterBands(bands));
      setSavedGroups(serializeGradingGroups(groups));
      setSavedWeighted(weighted);
      setSavedBands(serializeLetterBands(bands));
    }
    if (hoursDirty) {
      const hours = applySyllabusOfficeHours(effectiveCourseId, officeHours);
      setOfficeHours(cloneOfficeHours(hours));
      setSavedHours(serializeOfficeHours(hours));
    }
    if (summaryDirty) {
      const rows = applySyllabusSummaryItems(effectiveCourseId, summaryItems);
      setSummaryItems(cloneSummaryItems(rows));
      setSavedSummary(serializeSummaryItems(rows));
    }
    if (contentDirty) {
      const next = saveSyllabus(effectiveCourseId, {
        content,
        showCourseSummary,
        showTeachingTeam,
        showGrading,
        showOfficeHours,
      });
      setContent(next.content);
      setShowCourseSummary(next.showCourseSummary);
      setShowTeachingTeam(next.showTeachingTeam);
      setShowGrading(next.showGrading);
      setShowOfficeHours(next.showOfficeHours);
      setSavedContent(next.content);
      setSavedShowCourseSummary(next.showCourseSummary);
      setSavedShowTeachingTeam(next.showTeachingTeam);
      setSavedShowGrading(next.showGrading);
      setSavedShowOfficeHours(next.showOfficeHours);
      setSavedAt(next.updatedAt);
    }
    setSummaryTick((n) => n + 1);
    showToast("Syllabus saved", "positive", "saved");
  };

  const jumpLinks = [
    ...(studentView ? headings.map((h) => ({ href: `#${h.id}`, label: h.text })) : []),
    ...((canEdit || (showTeachingTeam && teachingTeam.length > 0))
      ? [{ href: "#teaching-team", label: "Teaching Team" }]
      : []),
    ...(canEdit || showGrading ? [{ href: "#grading", label: "Grading" }] : []),
    ...((canEdit || (showOfficeHours && officeHours.length > 0))
      ? [{ href: "#office-hours", label: "Office Hours" }]
      : []),
    ...(canEdit || showCourseSummary ? [{ href: "#course-summary", label: "Course Summary" }] : []),
  ];

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      {leaveGuardModal}
      <div className="print-hide">
        <CourseHeader />
      </div>
      <div className="flex-1 overflow-y-auto bg-transparent px-8 py-8">
        <div className="mb-6 hidden print:block">
          <p className="text-sm text-gray-500">
            {course.code}
            {course.term ? ` · ${course.term}` : ""}
            {savedAt ? ` · Updated ${formatSyllabusUpdatedAt(savedAt)}` : ""}
          </p>
          <h1 className="text-2xl font-semibold text-canvas-grayDark">
            {course.title} — Syllabus
          </h1>
        </div>
        <PageIdentityHeader
          className="print-hide"
          size="md"
          icon="file"
          label="Syllabus"
          title="Syllabus"
          actions={
            <div className="print-hide flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-canvas-secondary inline-flex items-center gap-2 text-sm"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              {canEdit ? (
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty}
                  className="btn-canvas-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save Syllabus
                </button>
              ) : null}
            </div>
          }
        />

        <p className="mt-2 text-sm text-gray-500 print-hide">
          {course.code}
          {course.term ? ` · ${course.term}` : ""}
          {savedAt ? ` · Updated ${formatSyllabusUpdatedAt(savedAt)}` : ""}
        </p>

        {jumpLinks.length > 1 && (
          <nav
            aria-label="On this page"
            className="print-hide mt-5 flex flex-wrap gap-2 text-sm"
          >
            {jumpLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full border border-gray-200 bg-canvas-grayLight/70 px-3 py-1 text-canvas-blue hover:border-canvas-blue/40 hover:bg-arc-ivory"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="mt-8 space-y-8">
          {!canEdit ? (
            content.trim() ? (
              <div className="rounded-xl border border-arc-line bg-arc-ivory px-8 py-10 sm:px-10 sm:py-12">
                <RichContentViewer html={contentWithIds} courseId={effectiveCourseId} />
              </div>
            ) : (
              <p className="text-sm text-gray-500">No syllabus has been published yet.</p>
            )
          ) : (
            <div className="space-y-4">
              <div className="print-hide">
                <RichContentEditor
                  label="Syllabus content"
                  value={content}
                  onChange={setContent}
                  height={360}
                  courseId={effectiveCourseId}
                  mountKey={`${effectiveCourseId}-syllabus-${savedAt}`}
                />
              </div>
              <div className="hidden print:block">
                {content.trim() ? (
                  <RichContentViewer html={contentWithIds} courseId={effectiveCourseId} />
                ) : null}
              </div>
              <label className="form-checkbox-label print-hide">
                <input
                  type="checkbox"
                  checked={showCourseSummary}
                  onChange={(e) => setShowCourseSummary(e.target.checked)}
                />
                Show Course Summary to students
              </label>
              <label className="form-checkbox-label print-hide">
                <input
                  type="checkbox"
                  checked={showTeachingTeam}
                  onChange={(e) => setShowTeachingTeam(e.target.checked)}
                />
                Show Teaching Team to students
              </label>
              <label className="form-checkbox-label print-hide">
                <input
                  type="checkbox"
                  checked={showGrading}
                  onChange={(e) => setShowGrading(e.target.checked)}
                />
                Show Grading to students
              </label>
              <label className="form-checkbox-label print-hide">
                <input
                  type="checkbox"
                  checked={showOfficeHours}
                  onChange={(e) => setShowOfficeHours(e.target.checked)}
                />
                Show Office Hours to students
              </label>
            </div>
          )}

          {(canEdit || (showTeachingTeam && teachingTeam.length > 0)) && (
            <TeachingTeamSection
              members={teachingTeam}
              canEdit={canEdit}
              onChange={setTeachingTeam}
            />
          )}

          {(canEdit || showGrading) && (
            <GradingSection
              groups={gradingGroups}
              weighted={weighted}
              canEdit={canEdit}
              bands={letterBands}
              onChangeGroups={setGradingGroups}
              onChangeWeighted={setWeighted}
              onChangeBands={setLetterBands}
            />
          )}

          {(canEdit || (showOfficeHours && officeHours.length > 0)) && (
            <OfficeHoursSection
              rows={officeHours}
              canEdit={canEdit}
              onChange={setOfficeHours}
            />
          )}

          {(canEdit || showCourseSummary) && (
            <CourseSummaryTable
              items={displayedSummary}
              canEdit={canEdit}
              studentView={studentView}
              onChange={setSummaryItems}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TeachingTeamSection({
  members,
  canEdit,
  onChange,
}: {
  members: SyllabusTeachingMember[];
  canEdit: boolean;
  onChange: (next: SyllabusTeachingMember[]) => void;
}) {
  return (
    <section id="teaching-team">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-canvas-grayDark">Teaching Team</h2>
          <p className="mt-1 text-sm text-gray-600">
            {canEdit
              ? "Instructors and TAs from People. This list updates automatically; saving also writes back to People."
              : "Instructors and TAs for this course. Message them from Inbox if you have a question."}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="btn-canvas-secondary print-hide inline-flex items-center gap-1.5 text-sm"
            onClick={() =>
              onChange([
                ...members,
                { id: newSyllabusMemberId(), name: "", role: "ta", email: "" },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add person
          </button>
        )}
      </div>
      {members.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-500">
          No instructors or TAs listed yet.
        </p>
      ) : canEdit ? (
        <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          {members.map((member, index) => {
            const locked = isPrimaryInstructor(member);
            return (
              <li key={member.id} className="grid gap-3 px-5 py-3 md:grid-cols-[1fr_8rem_1fr_auto]">
                <label className="block">
                  <span className="sr-only">Name</span>
                  <input
                    value={member.name}
                    onChange={(e) =>
                      onChange(
                        members.map((m, i) => (i === index ? { ...m, name: e.target.value } : m)),
                      )
                    }
                    placeholder="Name"
                    className="form-input"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">Role</span>
                  <select
                    value={member.role}
                    disabled={locked}
                    onChange={(e) =>
                      onChange(
                        members.map((m, i) =>
                          i === index
                            ? { ...m, role: e.target.value === "ta" ? "ta" : "instructor" }
                            : m,
                        ),
                      )
                    }
                    className="form-input"
                  >
                    <option value="instructor">Instructor</option>
                    <option value="ta">TA</option>
                  </select>
                </label>
                <label className="block">
                  <span className="sr-only">Email</span>
                  <input
                    type="email"
                    value={member.email ?? ""}
                    onChange={(e) =>
                      onChange(
                        members.map((m, i) => (i === index ? { ...m, email: e.target.value } : m)),
                      )
                    }
                    placeholder="Email"
                    className="form-input"
                  />
                </label>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onChange(members.filter((m) => m.id !== member.id))}
                  className="print-hide self-center rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-canvas-red disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Remove ${member.name || "person"}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
              <div>
                <p className="font-medium text-canvas-grayDark">{member.name}</p>
                <p className="text-xs text-gray-500">{teachingRoleLabel(member.role)}</p>
              </div>
              {member.email ? (
                <a href={`mailto:${member.email}`} className="text-sm text-canvas-blue hover:underline">
                  {member.email}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GradingSection({
  groups,
  weighted,
  canEdit,
  bands,
  onChangeGroups,
  onChangeWeighted,
  onChangeBands,
}: {
  groups: AssignmentGroup[];
  weighted: boolean;
  canEdit: boolean;
  bands: LetterGradeBand[];
  onChangeGroups: (next: AssignmentGroup[]) => void;
  onChangeWeighted: (next: boolean) => void;
  onChangeBands: (next: LetterGradeBand[]) => void;
}) {
  return (
    <section id="grading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-canvas-grayDark">Grading</h2>
          <p className="mt-1 text-sm text-gray-600">
            {canEdit
              ? "Assignment groups from Course Settings. This list updates automatically; saving also writes back to Course Settings."
              : weighted
                ? "Overall grades use weighted assignment groups from Course Settings."
                : "Overall grades use total points. Assignment groups are not weighted."}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="btn-canvas-secondary print-hide inline-flex items-center gap-1.5 text-sm"
            onClick={() =>
              onChangeGroups([
                ...groups,
                { id: createAssignmentGroupId(), name: "New group", weight: 0 },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add group
          </button>
        )}
      </div>
      {canEdit && (
        <label className="form-checkbox-label print-hide mt-3">
          <input
            type="checkbox"
            checked={weighted}
            onChange={(e) => onChangeWeighted(e.target.checked)}
          />
          Weighted grading
        </label>
      )}
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-canvas-grayLight/60 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3 font-semibold">Group</th>
              <th className="px-5 py-3 font-semibold">{weighted ? "Weight" : "Notes"}</th>
              {canEdit ? <th className="px-5 py-3 font-semibold">Extra credit</th> : null}
              {canEdit ? <th className="w-12 px-3 py-3"><span className="sr-only">Remove</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {groups.map((group, index) => (
              <tr key={group.id} className="border-b border-gray-100 last:border-0">
                <td className="px-5 py-3 font-medium text-canvas-grayDark">
                  {canEdit ? (
                    <input
                      value={group.name}
                      onChange={(e) =>
                        onChangeGroups(
                          groups.map((g, i) => (i === index ? { ...g, name: e.target.value } : g)),
                        )
                      }
                      className="form-input"
                      aria-label="Group name"
                    />
                  ) : (
                    <>
                      {group.name}
                      {group.extraCredit ? (
                        <span className="ml-2 text-xs font-normal text-gray-500">Extra credit</span>
                      ) : null}
                    </>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-600">
                  {canEdit && weighted ? (
                    group.extraCredit ? (
                      <span className="text-sm">Adds to overall % without a weight share</span>
                    ) : (
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={group.weight}
                          onChange={(e) =>
                            onChangeGroups(
                              groups.map((g, i) =>
                                i === index ? { ...g, weight: Number(e.target.value) || 0 } : g,
                              ),
                            )
                          }
                          className="form-input w-20"
                          aria-label={`${group.name} weight`}
                        />
                        %
                      </label>
                    )
                  ) : weighted ? (
                    group.extraCredit ? "Adds to overall % without a weight share" : `${group.weight}%`
                  ) : (
                    "Counts toward total points"
                  )}
                </td>
                {canEdit ? (
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(group.extraCredit)}
                      onChange={(e) =>
                        onChangeGroups(
                          groups.map((g, i) =>
                            i === index ? { ...g, extraCredit: e.target.checked } : g,
                          ),
                        )
                      }
                      aria-label={`${group.name} extra credit`}
                    />
                  </td>
                ) : null}
                {canEdit ? (
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      disabled={groups.length <= 1}
                      onClick={() => onChangeGroups(groups.filter((g) => g.id !== group.id))}
                      className="print-hide rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-canvas-red disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Remove ${group.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-canvas-grayDark">Letter grades</h3>
            <button
              type="button"
              className="print-hide text-sm text-canvas-blue hover:underline"
              onClick={() => onChangeBands([...bands, { letter: "", minPercent: 0 }])}
            >
              Add band
            </button>
          </div>
          <ul className="space-y-2">
            {bands.map((band, index) => (
              <li key={`${band.letter}-${index}`} className="flex flex-wrap items-center gap-2">
                <input
                  value={band.letter}
                  onChange={(e) =>
                    onChangeBands(
                      bands.map((b, i) => (i === index ? { ...b, letter: e.target.value } : b)),
                    )
                  }
                  placeholder="Letter"
                  aria-label={`Letter grade ${index + 1}`}
                  className="form-input w-20"
                />
                <span className="text-sm text-gray-500">≥</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={band.minPercent}
                  onChange={(e) =>
                    onChangeBands(
                      bands.map((b, i) =>
                        i === index ? { ...b, minPercent: Number(e.target.value) || 0 } : b,
                      ),
                    )
                  }
                  aria-label={`${band.letter || "Letter"} minimum percent`}
                  className="form-input w-24"
                />
                <span className="text-sm text-gray-500">%</span>
                <button
                  type="button"
                  disabled={bands.length <= 1}
                  onClick={() => onChangeBands(bands.filter((_, i) => i !== index))}
                  className="print-hide rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-canvas-red disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Remove ${band.letter || "letter band"}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : bands.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <caption className="sr-only">Letter grade scale</caption>
            <thead>
              <tr className="border-b border-gray-200 bg-canvas-grayLight/60 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3 font-semibold">Letter</th>
                <th className="px-5 py-3 font-semibold">Range</th>
              </tr>
            </thead>
            <tbody>
              {studentLetterGradeRows(bands).map((row, index) => (
                <tr key={`${row.letter}-${index}`} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-canvas-grayDark">{row.letter}</td>
                  <td className="px-5 py-3 text-gray-600">{row.range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function OfficeHoursSection({
  rows,
  canEdit,
  onChange,
}: {
  rows: SyllabusOfficeHoursRow[];
  canEdit: boolean;
  onChange: (next: SyllabusOfficeHoursRow[]) => void;
}) {
  return (
    <section id="office-hours">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-canvas-grayDark">Office Hours</h2>
          <p className="mt-1 text-sm text-gray-600">
            {canEdit
              ? "Upcoming meeting times from Calendar. This list updates automatically; saving also writes back to appointment groups."
              : "Upcoming appointment groups for this course. Sign up from Calendar."}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="btn-canvas-secondary print-hide inline-flex items-center gap-1.5 text-sm"
            onClick={() => {
              const startAt = Date.now() + 24 * 60 * 60 * 1000;
              onChange([
                ...rows,
                {
                  id: newAppointmentGroupId(),
                  title: "Office hours",
                  location: "",
                  nextStartAt: startAt,
                  nextEndAt: startAt + 30 * 60 * 1000,
                  href: "/calendar",
                },
              ]);
            }}
          >
            <Plus className="h-4 w-4" />
            Add office hours
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-500">
          No office hours listed yet.
        </p>
      ) : canEdit ? (
        <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          {rows.map((row, index) => (
            <li key={row.id} className="space-y-3 px-5 py-4">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <label className="block">
                  <span className="sr-only">Title</span>
                  <input
                    value={row.title}
                    onChange={(e) =>
                      onChange(rows.map((r, i) => (i === index ? { ...r, title: e.target.value } : r)))
                    }
                    placeholder="Title"
                    className="form-input"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">Location</span>
                  <input
                    value={row.location ?? ""}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) => (i === index ? { ...r, location: e.target.value } : r)),
                      )
                    }
                    placeholder="Location or Zoom"
                    className="form-input"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                  className="print-hide self-center rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-canvas-red"
                  aria-label={`Remove ${row.title || "office hours"}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <DateTimeField
                  label="Starts"
                  compact
                  value={row.nextStartAt}
                  onChange={(ms) =>
                    onChange(
                      rows.map((r, i) =>
                        i === index
                          ? {
                              ...r,
                              nextStartAt: ms,
                              nextEndAt:
                                typeof ms === "number" &&
                                (typeof r.nextEndAt !== "number" || r.nextEndAt <= ms)
                                  ? ms + 30 * 60 * 1000
                                  : r.nextEndAt,
                            }
                          : r,
                      ),
                    )
                  }
                />
                <DateTimeField
                  label="Ends"
                  compact
                  value={row.nextEndAt}
                  onChange={(ms) =>
                    onChange(rows.map((r, i) => (i === index ? { ...r, nextEndAt: ms } : r)))
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
              <div>
                <Link to={row.href} className="font-medium text-canvas-blue hover:underline">
                  {row.title}
                </Link>
                {row.location ? <p className="text-xs text-gray-500">{row.location}</p> : null}
              </div>
              <p className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                <Clock className="h-3.5 w-3.5" />
                {formatOfficeHoursWhen(row.nextStartAt, row.nextEndAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CourseSummaryTable({
  items,
  canEdit,
  studentView,
  onChange,
}: {
  items: CourseSummaryItem[];
  canEdit: boolean;
  studentView: boolean;
  onChange: (next: CourseSummaryItem[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CourseSummaryKindFilter>("all");
  const [when, setWhen] = useState<CourseSummaryWhenFilter>("all");
  const [sortKey, setSortKey] = useState<CourseSummarySortKey>("due");
  const [sortDir, setSortDir] = useState<CourseSummarySortDir>("asc");

  const visible = useMemo(
    () =>
      filterAndSortCourseSummaryItems(items, {
        query,
        kind,
        when,
        sortKey,
        sortDir,
      }),
    [items, query, kind, when, sortKey, sortDir],
  );

  const toggleSort = (key: CourseSummarySortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const patchRow = (row: CourseSummaryItem, patch: Partial<CourseSummaryItem>) => {
    onChange(
      items.map((it) => (it.kind === row.kind && it.id === row.id ? { ...it, ...patch } : it)),
    );
  };

  return (
    <section id="course-summary">
      <h2 className="text-lg font-semibold text-canvas-grayDark">Course Summary</h2>
      <p className="mt-1 text-sm text-gray-600">
        {canEdit
          ? "Titles, points, and due dates from Assignments, Quizzes, and Discussions. This table updates automatically; saving also writes back to those tools."
          : "Due dates for graded work in this course, pulled from Assignments, Quizzes, and Discussions."}
      </p>

      <div className="print-hide mt-4 space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter items…"
            aria-label="Filter course summary"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-canvas-blue focus:ring-2 focus:ring-canvas-blue/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {KIND_FILTERS.map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              active={kind === opt.value}
              onClick={() => setKind(opt.value)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {WHEN_FILTERS.map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              active={when === opt.value}
              onClick={() => setWhen(opt.value)}
            />
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-500">
          No dated items yet.
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-500">
          No items match these filters.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-canvas-grayLight/60 text-left text-xs uppercase tracking-wide text-gray-500">
                <SortableTh
                  label="Item"
                  column="title"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Type"
                  column="kind"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Points"
                  column="points"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Due"
                  column="due"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3">
                    {canEdit ? (
                      <div className="flex flex-col gap-1">
                        <input
                          value={row.title}
                          onChange={(e) => patchRow(row, { title: e.target.value })}
                          className="form-input"
                          aria-label={`${summaryKindLabel(row.kind)} title`}
                        />
                        {row.published === false ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Draft
                          </span>
                        ) : (
                          <Link to={row.href} className="text-xs text-canvas-blue hover:underline">
                            Open
                          </Link>
                        )}
                      </div>
                    ) : (
                      <>
                        <Link to={row.href} className="font-medium text-canvas-blue hover:underline">
                          {row.title}
                        </Link>
                        {!studentView && row.published === false ? (
                          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Draft
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{summaryKindLabel(row.kind)}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {canEdit ? (
                      <input
                        type="number"
                        min={0}
                        value={typeof row.points === "number" ? row.points : ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          patchRow(row, {
                            points: raw === "" ? undefined : Number(raw) || 0,
                          });
                        }}
                        className="form-input w-24"
                        aria-label={`${row.title} points`}
                      />
                    ) : (
                      formatSummaryPoints(row.points)
                    )}
                  </td>
                  <td className="px-5 py-3 text-canvas-grayDark">
                    {canEdit ? (
                      <DateTimeField
                        label="Due"
                        hideLabel
                        compact
                        value={row.dueAt}
                        onChange={(ms) => patchRow(row, { dueAt: ms })}
                      />
                    ) : (
                      formatSummaryDue(row.dueAt)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length > 0 && (
        <p className="mt-2 text-xs text-gray-500 print-hide">
          Showing {visible.length} of {items.length}
        </p>
      )}
    </section>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        active
          ? "border-canvas-blue bg-canvas-blueTint text-canvas-blue"
          : "border-gray-200 bg-arc-paper text-gray-600 hover:border-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

function SortableTh({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: CourseSummarySortKey;
  sortKey: CourseSummarySortKey;
  sortDir: CourseSummarySortDir;
  onSort: (column: CourseSummarySortKey) => void;
}) {
  const active = sortKey === column;
  const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th
      aria-sort={ariaSort}
      className="p-0 font-semibold"
      scope="col"
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex w-full items-center gap-1 px-5 py-3 uppercase tracking-wide hover:text-canvas-grayDark"
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
        )}
      </button>
    </th>
  );
}
