import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ClipboardList,
  Copy,
  EyeOff,
  GripVertical,
  HelpCircle,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import CanvasModal from "../components/CanvasModal";
import AssignmentGroupsWeightModal from "../components/AssignmentGroupsWeightModal";
import AssignmentGroupRulesModal from "../components/AssignmentGroupRulesModal";
import AppEmptyState from "../components/AppEmptyState";
import CourseHeader from "../components/CourseHeader";
import GradeIconLink from "../components/GradeIconLink";
import PageIdentityHeader from "../components/PageIdentityHeader";
import Tooltip from "../components/ui/Tooltip";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";
import { htmlPreview } from "../utils/htmlPreview";
import {
  autoPublishAssignment,
  duplicateAssignment,
  formatAssignmentDueDate,
  formatAvailabilityColumn,
  isAssignmentClosedToStudents,
  isAssignmentNotYetAvailable,
  loadAssignments,
  saveAssignments,
} from "../utils/assignments";
import {
  autoPublishQuiz,
  duplicateQuiz,
  isQuizClosedToStudents,
  isQuizNotYetAvailable,
  loadQuizzes,
  saveQuizzes,
} from "../utils/quizzes";
import {
  autoPublishTopic,
  loadTopics,
  saveTopics,
  uid as discussionUid,
  type DiscussionTopic,
} from "../utils/discussions";
import {
  createAssignmentGroupId,
  getCourseAssignmentGroups,
  getCourseById,
  isWeightedGradingEnabled,
  normalizeAssignmentGroups,
  reassignItemsToValidGroups,
  resolveItemGroupId,
  takeWeightFromGroups,
  updateCourse,
  type AssignmentGroup,
} from "../utils/coursesStore";
import {
  getPendingAssignmentCount,
  getPendingDiscussionCount,
  getPendingQuizCount,
  getTotalPendingGradeCount,
} from "../utils/gradingCounts";
import { getStudentSubmissionStatus } from "../utils/studentSubmissionStatus";
import SubmissionStatusBadge from "../components/SubmissionStatusBadge";
import { loadUser } from "../utils/userStore";
import {
  applyEffectiveDates,
  DUE_DATE_OVERRIDES_CHANGED_EVENT,
  hasDueDateOverrides,
} from "../utils/dueDateOverrides";

type SortKey = "due" | "title" | "points";
type FilterKey = "all" | "published" | "draft";
type WorkKind = "assignment" | "quiz" | "discussion";

type WorkItem = {
  key: string;
  kind: WorkKind;
  id: string;
  title: string;
  preview: string;
  dueAt?: number;
  points?: number | null;
  published: boolean;
  groupId: string;
  viewerPath: string;
  editPath: string;
  gradePath: string;
  availability: string[];
  notYetAvailable: boolean;
  closed: boolean;
  multipleDates?: boolean;
};

const UNWEIGHTED_DROP_ID = "drop:unweighted";

function groupDropId(groupId: string) {
  return `drop:group:${groupId}`;
}

function parseDropTarget(overId: string | number | undefined): string | null {
  if (overId == null) return null;
  const id = String(overId);
  if (id === UNWEIGHTED_DROP_ID) return "";
  if (id.startsWith("drop:group:")) return id.slice("drop:group:".length);
  return null;
}

const GRID_STUDENT =
  "grid-cols-[minmax(0,1fr)_minmax(0,160px)_minmax(0,200px)_90px]";
const GRID_INSTRUCTOR =
  "grid-cols-[28px_minmax(0,1fr)_minmax(0,160px)_minmax(0,200px)_90px_100px_minmax(140px,auto)]";

const KIND_ORDER: WorkKind[] = ["assignment", "quiz", "discussion"];

const KIND_META: Record<
  WorkKind,
  { label: string; plural: string; className: string; icon: typeof ClipboardList }
> = {
  assignment: {
    label: "Assignment",
    plural: "Assignments",
    className: "bg-sky-50 text-sky-700",
    icon: ClipboardList,
  },
  quiz: {
    label: "Quiz",
    plural: "Quizzes",
    className: "bg-violet-50 text-violet-700",
    icon: HelpCircle,
  },
  discussion: {
    label: "Discussion",
    plural: "Discussions",
    className: "bg-emerald-50 text-emerald-700",
    icon: MessageSquare,
  },
};

export default function AssignmentsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const { studentView } = useStudentView(effectiveCourseId);
  const { canEditCourseContent, canEditAssignments } = usePermissions();
  const canAuthorKind = (kind: WorkKind) =>
    kind === "assignment" ? canEditAssignments : canEditCourseContent;
  const showAuthoring = canEditAssignments || canEditCourseContent;
  const { showToast } = useToast();
  const assignmentsPath = `/courses/${effectiveCourseId}/assignments`;

  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("due");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | WorkKind>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ kind: WorkKind; id: string } | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createForGroupId, setCreateForGroupId] = useState<string | undefined>();
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupWeight, setNewGroupWeight] = useState("0");
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [groupMenuId, setGroupMenuId] = useState<string | null>(null);
  const [rulesGroupId, setRulesGroupId] = useState<string | null>(null);
  const [activeDragKey, setActiveDragKey] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    const refresh = () => {
      const assignments = loadAssignments(effectiveCourseId).map(autoPublishAssignment);
      const rawAssignments = loadAssignments(effectiveCourseId);
      if (assignments.some((a, i) => a.status !== rawAssignments[i]?.status)) {
        saveAssignments(effectiveCourseId, assignments);
      }
      const quizzes = loadQuizzes(effectiveCourseId).map(autoPublishQuiz);
      const rawQuizzes = loadQuizzes(effectiveCourseId);
      if (quizzes.some((q, i) => q.status !== rawQuizzes[i]?.status)) {
        saveQuizzes(effectiveCourseId, quizzes);
      }
      const topics = loadTopics(effectiveCourseId).map(autoPublishTopic);
      const rawTopics = loadTopics(effectiveCourseId);
      if (topics.some((t, i) => t.status !== rawTopics[i]?.status || t.published !== rawTopics[i]?.published)) {
        saveTopics(effectiveCourseId, topics);
      }
      setTick((n) => n + 1);
    };
    refresh();
    const events = [
      "canvasClone:assignmentsChanged",
      "canvasClone:quizzesChanged",
      "canvasClone:discussionsChanged",
      "canvasClone:assignmentSubmissionsChanged",
      "canvasClone:coursesChanged",
      DUE_DATE_OVERRIDES_CHANGED_EVENT,
    ];
    for (const ev of events) window.addEventListener(ev, refresh);
    return () => {
      for (const ev of events) window.removeEventListener(ev, refresh);
    };
  }, [effectiveCourseId]);

  const course = getCourseById(effectiveCourseId);
  const groups = getCourseAssignmentGroups(course);
  const weighted = isWeightedGradingEnabled(course);

  const persistGroups = (
    next: AssignmentGroup[],
    extra?: { weightedGrading?: boolean },
  ) => {
    const cleaned = normalizeAssignmentGroups(next);
    if (cleaned.length === 0) {
      showToast("Keep at least one assignment group", "negative");
      return;
    }
    const validIds = new Set(cleaned.map((g) => g.id));
    reassignItemsToValidGroups(effectiveCourseId, validIds);
    updateCourse(effectiveCourseId, {
      assignmentGroups: cleaned,
      ...extra,
    });
  };

  const patchGroup = (id: string, patch: Partial<AssignmentGroup>) => {
    persistGroups(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const moveItemToGroup = (item: WorkItem, nextGroupId: string) => {
    if (!canAuthorKind(item.kind)) return;
    if (item.groupId === nextGroupId) return;
    const groupId = nextGroupId || undefined;
    if (item.kind === "assignment") {
      saveAssignments(
        effectiveCourseId,
        loadAssignments(effectiveCourseId).map((a) =>
          a.id === item.id ? { ...a, groupId } : a,
        ),
      );
    } else if (item.kind === "quiz") {
      saveQuizzes(
        effectiveCourseId,
        loadQuizzes(effectiveCourseId).map((q) =>
          q.id === item.id ? { ...q, groupId } : q,
        ),
      );
    } else {
      saveTopics(
        effectiveCourseId,
        loadTopics(effectiveCourseId).map((t) =>
          t.id === item.id ? { ...t, groupId } : t,
        ),
      );
    }
    const dest =
      nextGroupId === ""
        ? weighted
          ? "Unweighted"
          : "Ungrouped"
        : groups.find((g) => g.id === nextGroupId)?.name ?? "group";
    showToast(`Moved to ${dest}`, "positive", "saved");
  };

  const items = useMemo(() => {
    const now = Date.now();
    const next: WorkItem[] = [];
    const studentId = loadUser().id;
    const dated = <T extends { id: string; dueAt?: number; availableFrom?: number; availableUntil?: number }>(
      kind: "assignment" | "quiz" | "discussion",
      item: T,
    ) => (studentView ? applyEffectiveDates(effectiveCourseId, kind, item, studentId) : item);

    const assignments = loadAssignments(effectiveCourseId).map(autoPublishAssignment);
    for (const raw of assignments) {
      const a = dated("assignment", raw);
      next.push({
        key: `assignment:${a.id}`,
        kind: "assignment",
        id: a.id,
        title: a.title,
        preview: htmlPreview(a.description).text,
        dueAt: a.dueAt,
        points: a.points,
        published: a.status === "published" || Boolean(a.published),
        groupId: resolveItemGroupId(groups, a.groupId) ?? "",
        viewerPath: `${assignmentsPath}/${a.id}`,
        editPath: `${assignmentsPath}/${a.id}/edit`,
        gradePath: `${assignmentsPath}/${a.id}/grade`,
        availability: formatAvailabilityColumn(a),
        notYetAvailable: isAssignmentNotYetAvailable(a, now),
        closed: isAssignmentClosedToStudents(a, now),
        multipleDates: !studentView && hasDueDateOverrides(effectiveCourseId, "assignment", a.id),
      });
    }

    const quizzes = loadQuizzes(effectiveCourseId).map(autoPublishQuiz);
    for (const raw of quizzes) {
      const q = dated("quiz", raw);
      next.push({
        key: `quiz:${q.id}`,
        kind: "quiz",
        id: q.id,
        title: q.title,
        preview: htmlPreview(q.description).text,
        dueAt: q.dueAt,
        points: q.points,
        published: q.status === "published" || Boolean(q.published),
        groupId: resolveItemGroupId(groups, q.groupId) ?? "",
        viewerPath: `/courses/${effectiveCourseId}/quizzes/${q.id}`,
        editPath: `/courses/${effectiveCourseId}/quizzes/${q.id}/edit`,
        gradePath: `/courses/${effectiveCourseId}/quizzes/${q.id}/grade`,
        availability: formatAvailabilityColumn(q),
        notYetAvailable: isQuizNotYetAvailable(q, now),
        closed: isQuizClosedToStudents(q, now),
        multipleDates: !studentView && hasDueDateOverrides(effectiveCourseId, "quiz", q.id),
      });
    }

    const topics = loadTopics(effectiveCourseId).map(autoPublishTopic);
    for (const raw of topics) {
      const t = dated("discussion", raw);
      next.push({
        key: `discussion:${t.id}`,
        kind: "discussion",
        id: t.id,
        title: t.title,
        preview: htmlPreview(t.body).text,
        dueAt: t.dueAt,
        points: t.points,
        published: t.status === "published" || Boolean(t.published),
        groupId: resolveItemGroupId(groups, t.groupId) ?? "",
        viewerPath: `/courses/${effectiveCourseId}/discussions/${t.id}`,
        editPath: `/courses/${effectiveCourseId}/discussions/${t.id}/edit`,
        gradePath: `/courses/${effectiveCourseId}/discussions/${t.id}/grade`,
        availability: formatAvailabilityColumn(t),
        notYetAvailable:
          typeof t.availableFrom === "number" && t.availableFrom > now,
        closed: typeof t.availableUntil === "number" && t.availableUntil < now,
        multipleDates: !studentView && hasDueDateOverrides(effectiveCourseId, "discussion", t.id),
      });
    }

    return next;
    // tick forces a reload after storage events
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCourseId, groups, assignmentsPath, tick, studentView]);

  const pendingCount = studentView ? 0 : getTotalPendingGradeCount(effectiveCourseId);

  const filtered = useMemo(() => {
    let list = studentView ? items.filter((item) => item.published) : items;

    if (!studentView && filter === "published") {
      list = list.filter((item) => item.published);
    } else if (!studentView && filter === "draft") {
      list = list.filter((item) => !item.published);
    }

    if (typeFilter !== "all") {
      list = list.filter((item) => item.kind === typeFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.preview.toLowerCase().includes(q) ||
          KIND_META[item.kind].label.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "points") return (b.points ?? 0) - (a.points ?? 0);
      return (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity);
    });
  }, [items, studentView, search, sort, filter, typeFilter]);

  const grouped = useMemo(() => {
    return groups.map((group) => ({
      group,
      items: filtered.filter((item) => item.groupId === group.id),
    }));
  }, [groups, filtered]);

  const unweightedItems = useMemo(
    () => filtered.filter((item) => !item.groupId),
    [filtered],
  );

  const activeDragItem = useMemo(
    () => (activeDragKey ? items.find((i) => i.key === activeDragKey) ?? null : null),
    [activeDragKey, items],
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveDragKey(String(event.active.id));
    setGroupMenuId(null);
    setPageMenuOpen(false);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDragKey(null);
    const { active, over } = event;
    if (!over) return;
    const item = items.find((i) => i.key === String(active.id));
    if (!item) return;
    const targetGroupId = parseDropTarget(over.id);
    if (targetGroupId == null) return;
    moveItemToGroup(item, targetGroupId);
  };

  const onDragCancel = () => setActiveDragKey(null);

  const remove = (target: { kind: WorkKind; id: string }) => {
    if (!canAuthorKind(target.kind)) return;
    if (target.kind === "assignment") {
      saveAssignments(
        effectiveCourseId,
        loadAssignments(effectiveCourseId).filter((a) => a.id !== target.id),
      );
      showToast("Assignment deleted", "neutral", "deleted");
    } else if (target.kind === "quiz") {
      saveQuizzes(
        effectiveCourseId,
        loadQuizzes(effectiveCourseId).filter((q) => q.id !== target.id),
      );
      showToast("Quiz deleted", "neutral", "deleted");
    } else {
      saveTopics(
        effectiveCourseId,
        loadTopics(effectiveCourseId).filter((t) => t.id !== target.id),
      );
      showToast("Discussion deleted", "neutral", "deleted");
    }
    setDeleteTarget(null);
  };

  const handleDuplicate = (item: WorkItem) => {
    if (!canAuthorKind(item.kind)) return;
    if (item.kind === "assignment") {
      const a = loadAssignments(effectiveCourseId).find((x) => x.id === item.id);
      if (!a) return;
      saveAssignments(effectiveCourseId, [duplicateAssignment(a), ...loadAssignments(effectiveCourseId)]);
      showToast("Assignment duplicated", "positive", "created");
      return;
    }
    if (item.kind === "quiz") {
      const q = loadQuizzes(effectiveCourseId).find((x) => x.id === item.id);
      if (!q) return;
      saveQuizzes(effectiveCourseId, [duplicateQuiz(q), ...loadQuizzes(effectiveCourseId)]);
      showToast("Quiz duplicated", "positive", "created");
      return;
    }
    const t = loadTopics(effectiveCourseId).find((x) => x.id === item.id);
    if (!t) return;
    const copy: DiscussionTopic = {
      ...t,
      id: discussionUid("topic"),
      title: `${t.title} (Copy)`,
      published: false,
      status: "draft",
      createdAt: Date.now(),
    };
    saveTopics(effectiveCourseId, [copy, ...loadTopics(effectiveCourseId)]);
    showToast("Discussion duplicated", "positive", "created");
  };

  const setPublished = (item: WorkItem, published: boolean) => {
    if (!canAuthorKind(item.kind)) return;
    if (item.kind === "assignment") {
      saveAssignments(
        effectiveCourseId,
        loadAssignments(effectiveCourseId).map((x) =>
          x.id === item.id
            ? {
                ...x,
                status: published ? ("published" as const) : ("draft" as const),
                published,
                publishAt: undefined,
              }
            : x,
        ),
      );
    } else if (item.kind === "quiz") {
      saveQuizzes(
        effectiveCourseId,
        loadQuizzes(effectiveCourseId).map((x) =>
          x.id === item.id
            ? {
                ...x,
                status: published ? ("published" as const) : ("draft" as const),
                published,
                publishAt: undefined,
              }
            : x,
        ),
      );
    } else {
      saveTopics(
        effectiveCourseId,
        loadTopics(effectiveCourseId).map((x) =>
          x.id === item.id
            ? {
                ...x,
                status: published ? ("published" as const) : ("draft" as const),
                published,
                publishAt: undefined,
              }
            : x,
        ),
      );
    }
    showToast(published ? "Published" : "Unpublished", published ? "positive" : "neutral", "published");
  };

  const pendingFor = (item: WorkItem) => {
    if (item.kind === "assignment") return getPendingAssignmentCount(effectiveCourseId, item.id);
    if (item.kind === "quiz") return getPendingQuizCount(effectiveCourseId, item.id);
    return getPendingDiscussionCount(effectiveCourseId, item.id);
  };

  const openCreate = (kind: WorkKind, groupId?: string) => {
    setCreateOpen(false);
    const from = assignmentsPath;
    const state = { from, groupId: groupId ?? createForGroupId };
    setCreateForGroupId(undefined);
    if (kind === "assignment") navigate(`${assignmentsPath}/new`, { state });
    else if (kind === "quiz") {
      navigate(`/courses/${effectiveCourseId}/quizzes/new`, { state });
    } else {
      navigate(`/courses/${effectiveCourseId}/discussions/new`, { state });
    }
  };

  const TableHeader = () => (
    <div
      className={[
        "grid items-center gap-4 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500",
        studentView ? GRID_STUDENT : GRID_INSTRUCTOR,
      ].join(" ")}
    >
      {showAuthoring && (
        <span className="block w-4" aria-hidden="true" />
      )}
      <span className="pl-15 text-left">Item</span>
      <span className="-ml-6 text-center">Due Date</span>
      <span className="-ml-6 text-center">Availability</span>
      <span className="-ml-6 text-center">Points</span>
      {!studentView && <span className="-ml-6 text-center">Status</span>}
      {!studentView && <span className="mr-6 text-right">Actions</span>}
    </div>
  );

  const WorkRow = ({ item }: { item: WorkItem }) => {
    const meta = KIND_META[item.kind];
    const KindIcon = meta.icon;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: item.key,
      disabled: !canAuthorKind(item.kind),
      data: { kind: item.kind, itemId: item.id, groupId: item.groupId },
    });

    return (
      <div
        ref={setNodeRef}
        className={[
          "grid items-center gap-4 border-b border-canvas-border px-5 py-4 last:border-0 bg-arc-paper",
          studentView ? GRID_STUDENT : GRID_INSTRUCTOR,
          isDragging ? "opacity-40" : "",
        ].join(" ")}
      >
        {showAuthoring && (
          <button
            type="button"
            className="cursor-grab touch-none rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing disabled:cursor-default disabled:opacity-30"
            aria-label={`Drag ${item.title}`}
            disabled={!canAuthorKind(item.kind)}
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <Link to={item.viewerPath} className="min-w-0 text-left hover:underline">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${meta.className}`}
              title={meta.label}
            >
              <KindIcon className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold text-canvas-grayDark">{item.title}</span>
          </div>
          {studentView && (
            <div className="mt-1">
              <SubmissionStatusBadge
                status={getStudentSubmissionStatus(
                  effectiveCourseId,
                  {
                    id: item.key,
                    title: item.title,
                    kind: item.kind,
                    points: item.points ?? 0,
                    gradePath: "",
                    viewerPath: "",
                  },
                  loadUser().id,
                )}
              />
            </div>
          )}
          {studentView && item.notYetAvailable && (
            <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              Not yet available
            </span>
          )}
          {item.preview && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">{item.preview}</p>
          )}
        </Link>

        <div className="min-w-0 text-center text-sm text-gray-700">
          {item.dueAt ? (
            formatAssignmentDueDate(item.dueAt)
          ) : (
            <span className="text-gray-400">—</span>
          )}
          {item.multipleDates && (
            <div className="text-[11px] font-medium text-canvas-blue">Multiple dates</div>
          )}
        </div>

        <div className="min-w-0 text-center text-sm text-gray-700">
          {item.availability.length > 0 ? (
            <div className="space-y-0.5">
              {item.availability.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>

        <div className="text-center text-sm text-gray-700">
          {item.points != null ? (
            `${item.points} pts`
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>

        {!studentView && (
          <div className="flex justify-center">
            <span
              className={[
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                item.published ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600",
              ].join(" ")}
            >
              {item.published ? "Published" : "Draft"}
            </span>
          </div>
        )}

        {!studentView && (
          <div className="flex shrink-0 items-center justify-end gap-1">
            {canAuthorKind(item.kind) && (
              <>
            {!item.published ? (
              <Tooltip label="Publish">
                <button
                  type="button"
                  onClick={() => setPublished(item, true)}
                  aria-label={`Publish ${meta.label.toLowerCase()}`}
                  className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </Tooltip>
            ) : (
              <Tooltip label="Unpublish">
                <button
                  type="button"
                  onClick={() => setPublished(item, false)}
                  aria-label={`Unpublish ${meta.label.toLowerCase()}`}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip label="Edit">
              <Link
                to={item.editPath}
                state={{ from: assignmentsPath }}
                aria-label={`Edit ${meta.label.toLowerCase()}`}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </Tooltip>
              </>
            )}
            <Tooltip label="Grade">
              <GradeIconLink
                to={item.gradePath}
                pendingCount={pendingFor(item)}
                label={`Grade ${meta.label.toLowerCase()}`}
              />
            </Tooltip>
            {canAuthorKind(item.kind) && (
              <>
            <Tooltip label="Duplicate">
              <button
                type="button"
                onClick={() => handleDuplicate(item)}
                aria-label={`Duplicate ${meta.label.toLowerCase()}`}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <Copy className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label="Delete">
              <button
                type="button"
                onClick={() => setDeleteTarget({ kind: item.kind, id: item.id })}
                aria-label={`Delete ${meta.label.toLowerCase()}`}
                className="rounded-md p-1.5 text-canvas-red hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Tooltip>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const DroppableBody = ({
    dropId,
    children,
  }: {
    dropId: string;
    children: ReactNode;
  }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: dropId,
      disabled: studentView,
    });
    return (
      <div
        ref={setNodeRef}
        className={[
          "min-h-[4.5rem] transition-colors",
          isOver ? "bg-canvas-blueTint/50 ring-2 ring-inset ring-canvas-blue/40" : "",
        ].join(" ")}
      >
        {children}
      </div>
    );
  };

  const KindSections = ({
    items: sectionItems,
    groupId,
  }: {
    items: WorkItem[];
    groupId?: string;
  }) => (
    <div className="pb-4">
      {KIND_ORDER.map((kind) => {
        const kindItems = sectionItems.filter((item) => item.kind === kind);
        if (kindItems.length === 0) return null;
        const meta = KIND_META[kind];
        return (
          <div key={`${groupId ?? "unweighted"}:${kind}`}>
            <div className="flex items-center gap-2 border-b border-canvas-border bg-arc-paper px-5 py-3">
              <h3 className="text-sm font-semibold text-canvas-grayDark">
                {meta.plural}
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({kindItems.length})
                </span>
              </h3>
              {canAuthorKind(kind) && (
                <Tooltip label={`Add ${meta.label.toLowerCase()}`}>
                  <button
                    type="button"
                    onClick={() => openCreate(kind, groupId)}
                    className="ml-auto rounded-md p-1 text-gray-500 hover:bg-gray-100"
                    aria-label={`Add ${meta.label.toLowerCase()}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              )}
            </div>
            {kindItems.map((item) => (
              <WorkRow key={item.key} item={item} />
            ))}
          </div>
        );
      })}
    </div>
  );

  const EmptyGroupState = ({ label }: { label?: string }) => (
    <div className="px-4 pb-6 pt-2">
      <AppEmptyState
        compact
        variant="list"
        studio={studentView ? "student" : "instructor"}
        title={label ?? "No assignments in this group"}
        subtitle="Add an assignment, quiz, or discussion to get started."
      />
    </div>
  );

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-transparent px-8 py-8">
        <div className="w-full">
          <PageIdentityHeader
            size="md"
            icon="clipboard"
            label="Assignments"
            title="Assignments"
            description={
              studentView
                ? "View assignments, quizzes, and discussions for this course."
                : "Organize work into grading groups. Drag the grip handle to move items between groups."
            }
            actions={
              !studentView && pendingCount > 0 ? (
                <span className="text-xs text-canvas-red">{pendingCount} to grade</span>
              ) : undefined
            }
          />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for Assignment"
                className="form-input w-full rounded-lg py-2 pl-9 pr-3 text-sm"
              />
            </div>
            {!studentView && (
              <>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as "all" | WorkKind)}
                  className="form-input w-auto rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All types</option>
                  <option value="assignment">Assignments</option>
                  <option value="quiz">Quizzes</option>
                  <option value="discussion">Discussions</option>
                </select>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as FilterKey)}
                  className="form-input w-auto rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts</option>
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="form-input w-auto rounded-lg px-3 py-2 text-sm"
                >
                  <option value="due">Sort by due date</option>
                  <option value="title">Sort by title</option>
                  <option value="points">Sort by points</option>
                </select>
                {canEditAssignments && (
                  <>
                <button
                  type="button"
                  onClick={() => {
                    setNewGroupName("");
                    setNewGroupWeight("0");
                    setCreateGroupOpen(true);
                  }}
                  className="btn-canvas-secondary inline-flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Group
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateForGroupId(undefined);
                    setCreateOpen(true);
                  }}
                  className="btn-canvas-primary inline-flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Assignment
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPageMenuOpen((o) => !o)}
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                    aria-label="Assignment options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {pageMenuOpen && (
                    <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-gray-200 bg-arc-paper py-1 shadow-lg">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          setPageMenuOpen(false);
                          setWeightModalOpen(true);
                        }}
                      >
                        Assignment Groups Weight
                      </button>
                    </div>
                  )}
                </div>
                  </>
                )}
              </>
            )}
            {studentView && (
              <>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as "all" | WorkKind)}
                  className="form-input w-auto rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All types</option>
                  <option value="assignment">Assignments</option>
                  <option value="quiz">Quizzes</option>
                  <option value="discussion">Discussions</option>
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="form-input w-auto rounded-lg px-3 py-2 text-sm"
                >
                  <option value="due">Sort by due date</option>
                  <option value="title">Sort by title</option>
                  <option value="points">Sort by points</option>
                </select>
              </>
            )}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <div className="mt-6 space-y-6 pb-8">
              {weighted && (!studentView || unweightedItems.length > 0) && (
                <section className="overflow-hidden rounded-xl border border-canvas-border bg-arc-paper shadow-sm">
                  <div className="border-b border-canvas-border bg-gray-50 px-5 py-3">
                    <h2 className="text-sm font-semibold text-canvas-grayDark">Unweighted</h2>
                    <p className="mt-0.5 text-xs text-gray-500">
                      These items do not count toward the weighted final grade. Drag items here to
                      remove them from a weighted group.
                    </p>
                  </div>
                  <DroppableBody dropId={UNWEIGHTED_DROP_ID}>
                    {unweightedItems.length === 0 ? (
                      <EmptyGroupState label="No unweighted items" />
                    ) : (
                      <>
                        <TableHeader />
                        <KindSections items={unweightedItems} />
                      </>
                    )}
                  </DroppableBody>
                </section>
              )}
              {!weighted && unweightedItems.length > 0 && (
                <section className="overflow-hidden rounded-xl border border-canvas-border bg-arc-paper shadow-sm">
                  <div className="border-b border-canvas-border bg-gray-50 px-5 py-3">
                    <h2 className="text-sm font-semibold text-canvas-grayDark">Ungrouped</h2>
                  </div>
                  <DroppableBody dropId={UNWEIGHTED_DROP_ID}>
                    <TableHeader />
                    <KindSections items={unweightedItems} />
                  </DroppableBody>
                </section>
              )}
              {grouped.map(({ group, items: groupItems }) => {
                if (studentView && groupItems.length === 0) return null;
                const dropParts = [
                  group.dropLowest ? `${group.dropLowest} lowest` : null,
                  group.dropHighest ? `${group.dropHighest} highest` : null,
                ].filter(Boolean);
                return (
                  <section
                    key={group.id}
                    className="overflow-hidden rounded-xl border border-canvas-border bg-arc-paper shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 border-b border-canvas-border bg-gray-50 px-5 py-3">
                      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-canvas-grayDark">
                        {group.name}
                      </h2>
                      {weighted && (
                        <span className="rounded-full border border-gray-300 bg-arc-paper px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          {group.weight}% of Total
                        </span>
                      )}
                      {group.extraCredit && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          Extra credit
                        </span>
                      )}
                      {dropParts.length > 0 && (
                        <span className="text-xs text-gray-400">Drop {dropParts.join(", ")}</span>
                      )}
                      {canEditAssignments && (
                        <>
                          <Tooltip label="Add to this group">
                            <button
                              type="button"
                              onClick={() => {
                                setCreateForGroupId(group.id);
                                setCreateOpen(true);
                              }}
                              className="rounded-md p-1.5 text-gray-500 hover:bg-arc-ivory"
                              aria-label="Add item to group"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setGroupMenuId((id) => (id === group.id ? null : group.id))
                              }
                              className="rounded-md p-1.5 text-gray-500 hover:bg-arc-ivory"
                              aria-label={`${group.name} options`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {groupMenuId === group.id && (
                              <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-gray-200 bg-arc-paper py-1 shadow-lg">
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                  onClick={() => {
                                    setGroupMenuId(null);
                                    setRulesGroupId(group.id);
                                  }}
                                >
                                  Edit / drop scores
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-canvas-red hover:bg-red-50"
                                  disabled={groups.length <= 1}
                                  onClick={() => {
                                    setGroupMenuId(null);
                                    if (groups.length <= 1) return;
                                    persistGroups(groups.filter((g) => g.id !== group.id));
                                    showToast("Assignment group deleted", "positive", "deleted");
                                  }}
                                >
                                  Delete group
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <DroppableBody dropId={groupDropId(group.id)}>
                      {groupItems.length === 0 ? (
                        <EmptyGroupState />
                      ) : (
                        <>
                          <TableHeader />
                          <KindSections items={groupItems} groupId={group.id} />
                        </>
                      )}
                    </DroppableBody>
                  </section>
                );
              })}
            </div>
            <DragOverlay dropAnimation={null}>
              {activeDragItem ? (
                <div className="flex max-w-md items-center gap-2 rounded-lg border border-canvas-blue bg-arc-paper px-3 py-2 shadow-lg">
                  <GripVertical className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate text-sm font-semibold text-canvas-grayDark">
                    {activeDragItem.title}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {createOpen && (
        <CanvasModal
          title="Create"
          onClose={() => {
            setCreateOpen(false);
            setCreateForGroupId(undefined);
          }}
          size="sm"
        >
          <p className="mb-4 text-sm text-gray-600">What would you like to create?</p>
          <div className="grid gap-2">
            {(
              [
                ["assignment", ClipboardList, "Assignment"] as const,
                ["quiz", HelpCircle, "Quiz"] as const,
                ["discussion", MessageSquare, "Discussion"] as const,
              ] as const
            )
              .filter(([kind]) => canAuthorKind(kind))
              .map(([kind, Icon, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => openCreate(kind)}
                className="flex items-center gap-3 rounded-lg border border-canvas-border px-4 py-3 text-left hover:bg-canvas-blueTint/40"
              >
                <Icon className="h-5 w-5 text-canvas-blue" />
                <span className="text-sm font-medium text-canvas-grayDark">{label}</span>
              </button>
            ))}
          </div>
        </CanvasModal>
      )}

      {createGroupOpen && (
        <CanvasModal
          title="Add Assignment Group"
          onClose={() => {
            setCreateGroupOpen(false);
            setNewGroupName("");
            setNewGroupWeight("0");
          }}
          size="sm"
        >
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Group name</span>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Homework, Exams, Labs…"
                className="mt-1 w-full form-input"
                autoFocus
              />
            </label>
            {weighted && (
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Weight (% of total)</span>
                <div className="mt-1 flex items-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newGroupWeight}
                    onChange={(e) => setNewGroupWeight(e.target.value)}
                    className="w-24 rounded-l-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="rounded-r-md border border-l-0 border-gray-300 bg-gray-100 px-2 py-1.5 text-sm text-gray-600">
                    %
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Existing group weights are reduced as needed so the course total stays near 100%.
                </p>
              </label>
            )}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateGroupOpen(false);
                setNewGroupName("");
                setNewGroupWeight("0");
              }}
              className="btn-canvas-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const name = newGroupName.trim();
                if (!name) return;
                const weight = Math.max(0, Number(newGroupWeight) || 0);
                const adjusted = weighted ? takeWeightFromGroups(groups, weight) : groups;
                persistGroups([
                  ...adjusted,
                  {
                    id: createAssignmentGroupId(),
                    name,
                    weight: weighted ? weight : 0,
                  },
                ]);
                showToast("Assignment group added", "positive", "created");
                setCreateGroupOpen(false);
                setNewGroupName("");
                setNewGroupWeight("0");
              }}
              className="btn-canvas-primary"
            >
              Save
            </button>
          </div>
        </CanvasModal>
      )}

      {weightModalOpen && (
        <AssignmentGroupsWeightModal
          groups={groups}
          weighted={weighted}
          onClose={() => setWeightModalOpen(false)}
          onSave={({ groups: next, weighted: nextWeighted }) => {
            persistGroups(next, { weightedGrading: nextWeighted });
            setWeightModalOpen(false);
            showToast("Assignment group weights saved", "positive", "saved");
          }}
        />
      )}

      {rulesGroupId &&
        (() => {
          const group = groups.find((g) => g.id === rulesGroupId);
          if (!group) return null;
          return (
            <AssignmentGroupRulesModal
              group={group}
              items={items
                .filter((item) => item.groupId === group.id)
                .map((item) => ({ key: item.key, title: item.title }))}
              onClose={() => setRulesGroupId(null)}
              onSave={(patch) => {
                patchGroup(group.id, patch);
                setRulesGroupId(null);
                showToast("Assignment group rules saved", "positive", "saved");
              }}
            />
          );
        })()}

      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-arc-paper p-6 shadow-xl">
            <p className="text-sm text-gray-700">
              Delete this {KIND_META[deleteTarget.kind].label.toLowerCase()}? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn-canvas-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => remove(deleteTarget)}
                className="btn-canvas-primary bg-canvas-red hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
