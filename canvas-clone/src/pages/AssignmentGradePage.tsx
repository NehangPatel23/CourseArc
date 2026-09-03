import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useParams, useSearchParams } from "react-router-dom";
import GradeProShell, { gradeProChipClass, gradeProNavBtnClass } from "../components/GradeProShell";
import Icon from "../icons/Icon";
import {
  MousePointer2,
  Pencil,
  Type,
} from "lucide-react";
import LatePenaltyPolicySelect from "../components/LatePenaltyPolicySelect";
import SpeedGraderDocumentViewer, {
  type GraderAnnotationTool,
} from "../components/SpeedGraderDocumentViewer";
import SubmissionContentPreview from "../components/SubmissionContentPreview";
import MissingStudentsPanel from "../components/MissingStudentsPanel";
import { useToast } from "../components/ui/Toast";
import RichPromptField from "../components/RichPromptField";
import RichContentViewer from "../components/RichContentViewer";
import { useStudentView } from "../hooks/useStudentView";
import { formatSubmissionTimestamp } from "../utils/assignmentDisplay";
import {
  defaultAssessments,
  getAssessmentForCriterion,
  ratingLabelForAssessment,
  sumRubricAssessments,
  type RubricAssessment,
} from "../utils/assignmentRubric";
import { resolveAssignmentRubric } from "../utils/rubricLibrary";
import {
  formatAssignmentDueDate,
  formatAvailabilitySummary,
  getAssignmentById,
} from "../utils/assignments";
import {
  calculateLatePenalty,
  formatLateDuration,
  lateDuration,
  finalScoreAfterPenalty,
  getLatePenaltyPreset,
  inferRawScore,
  isLateSubmission,
  MANUAL_LATE_PENALTY_PRESET_ID,
  shouldAutoApplyLatePenalty,
  computeAutoLatePenalty,
} from "../utils/latePenalty";
import { getEffectiveDueAt } from "../utils/dueDateOverrides";
import GradeEmptyState from "../components/GradeEmptyState";
import GradePublishButton from "../components/GradePublishButton";
import StudentGradeProScoreSection from "../components/StudentGradeProScoreSection";
import SubmissionCommentComposer from "../components/SubmissionCommentComposer";
import LateSubmissionBadge from "../components/LateSubmissionBadge";
import ListFiltersBar from "../components/ListFiltersBar";
import { getRosterStudentName } from "../utils/gradebook";
import { anonymousFileLabel, graderDisplayName, isIdentityHidden } from "../utils/anonymousGrading";
import { isGradeExcused, setGradeExcused } from "../utils/excusedGrades";
import {
  addSubmissionComment,
  appendSubmissionFeedback,
  commentRoleLabel,
  deleteFeedbackEntry,
  deleteSubmissionComment,
  getFeedbackEntries,
  gradeSubmission,
  applyGradeToGroupmates,
  loadSubmissionsForAssignment,
  type AssignmentSubmission,
  type FeedbackEntry,
  type SubmissionComment,
} from "../utils/assignmentSubmissions";
import { staffCommentRole } from "../utils/permissions";
import {
  deleteDocumentAnnotation,
  loadDocumentAnnotations,
  type DocumentAnnotation,
} from "../utils/submissionAnnotations";
import { downloadStoredFile, getCommentAttachment, getSubmissionFile } from "../utils/submissionFileStorage";
import {
  GRADE_PUBLISH_CHANGED_EVENT,
  isItemGradeVisible,
} from "../utils/gradeVisibility";

import { loadCourses, getCourseAssignmentDefaults, getCourseLatePenaltyPresets } from "../utils/coursesStore";
import { loadUser } from "../utils/userStore";
import { richTextIsEmpty, wrapPlainTextAsHtml } from "../utils/richContent";
import {
  filterAssignmentSubmissions,
  SUBMISSION_SORT_OPTIONS,
  SUBMISSION_STATUS_OPTIONS,
  type SubmissionSortKey,
  type SubmissionStatusFilter,
} from "../utils/listFilters";
import {
  getPeerReviewsForReviewee,
  listIncompletePeerReviewers,
  PEER_REVIEWS_CHANGED_EVENT,
} from "../utils/peerReviews";
import { getRosterMemberName } from "../utils/courseRoster";

const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 720;
const SIDEBAR_DEFAULT_WIDTH = 400;

function safeReturnPath(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function buildAssignmentGraderParams(
  submissionId: string,
  returnTo: string | null,
): Record<string, string> {
  const params: Record<string, string> = { submission: submissionId };
  if (returnTo) params.returnTo = returnTo;
  return params;
}
const SIDEBAR_WIDTH_KEY = "canvasClone:speedGraderSidebarWidth";

function readSidebarWidth(): number {
  try {
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(stored)) {
      return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, stored));
    }
  } catch {}
  return SIDEBAR_DEFAULT_WIDTH;
}

function savedSubmissionStatus(submission: AssignmentSubmission): string {
  if (submission.late) return "Late";
  if (submission.status === "graded") return "Graded";
  return "None";
}

function scoresEqual(scoreInput: string, savedScore?: number): boolean {
  const trimmed = scoreInput.trim();
  if (!trimmed) return savedScore == null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed === savedScore;
}

function rubricAssessmentsEqual(a: RubricAssessment[], b: RubricAssessment[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item) => {
    const other = b.find((entry) => entry.criterionId === item.criterionId);
    return (
      other != null &&
      other.ratingId === item.ratingId &&
      other.earned === item.earned
    );
  });
}

function latePenaltyFieldsEqual(
  selected: AssignmentSubmission,
  isLate: boolean,
  presetId: string,
  penaltyPoints: number,
  rawScoreValue: number,
  courseDefaultPresetId: string,
): boolean {
  if (!isLate) return !selected.late;
  if (!selected.late) return false;
  const savedPreset = selected.latePenaltyPresetId ?? courseDefaultPresetId;
  const savedPenalty = selected.latePenalty ?? 0;
  const savedRaw = inferRawScore(selected.score, selected.latePenalty, selected.rawScore);
  return (
    presetId === savedPreset &&
    penaltyPoints === savedPenalty &&
    rawScoreValue === savedRaw
  );
}

function SubmissionPreview({
  submission,
  zoom,
  rotation,
  page,
  activeTool,
  readOnly,
  hideAnnotations,
  onPageCountChange,
  onAnnotationsChange,
}: {
  submission: AssignmentSubmission;
  zoom: number;
  rotation: number;
  page: number;
  activeTool: GraderAnnotationTool;
  readOnly?: boolean;
  hideAnnotations?: boolean;
  onPageCountChange?: (total: number) => void;
  onAnnotationsChange?: () => void;
}) {
  const stored = useMemo(() => getSubmissionFile(submission.id), [submission.id]);

  if (submission.fileName) {
    return (
      <SpeedGraderDocumentViewer
        submissionId={submission.id}
        stored={stored}
        fileName={submission.fileName}
        zoom={zoom}
        rotation={rotation}
        page={page}
        activeTool={activeTool}
        readOnly={readOnly}
        hideAnnotations={hideAnnotations}
        onPageCountChange={onPageCountChange}
        onAnnotationsChange={onAnnotationsChange}
      />
    );
  }

  if (submission.body) {
    return (
      <SubmissionContentPreview
        fillHeight
        target={{ kind: "text", body: submission.body, courseId: submission.courseId }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-full items-center justify-center text-gray-500">
      No submission content.
    </div>
  );
}

const MemoizedSubmissionPreview = memo(
  SubmissionPreview,
  (prev, next) =>
    prev.submission.id === next.submission.id &&
    prev.submission.fileName === next.submission.fileName &&
    prev.submission.body === next.submission.body &&
    prev.zoom === next.zoom &&
    prev.rotation === next.rotation &&
    prev.page === next.page &&
    prev.activeTool === next.activeTool &&
    prev.readOnly === next.readOnly &&
    prev.hideAnnotations === next.hideAnnotations,
);

function FeedbackEntryItem({
  entry,
  courseId,
  onDelete,
}: {
  entry: FeedbackEntry;
  courseId: string;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-green-800">Saved feedback</p>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-red-600 hover:bg-red-50"
          title="Delete feedback"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
      <RichContentViewer
        html={wrapPlainTextAsHtml(entry.body)}
        courseId={courseId}
        spacing="compact"
        className="text-sm text-gray-700"
      />
      <p className="mt-1 text-xs text-gray-500">
        {entry.author} · {formatSubmissionTimestamp(entry.createdAt)}
      </p>
    </div>
  );
}

function DocumentCommentItem({
  ann,
  onDelete,
}: {
  ann: DocumentAnnotation;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-canvas-blue">
          On document · Page {ann.page} · {ann.type === "pin" ? "Comment pin" : "Text note"}
        </p>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-red-600 hover:bg-red-50"
          title="Delete annotation"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{ann.body}</p>
      <p className="mt-1 text-xs text-gray-500">
        {ann.author}, {formatSubmissionTimestamp(ann.createdAt)}
      </p>
    </div>
  );
}

function CommentItem({
  comment,
  courseId,
  onDelete,
}: {
  comment: SubmissionComment;
  courseId: string;
  onDelete?: () => void;
}) {
  const attachment = comment.attachmentName ? getCommentAttachment(comment.id) : null;

  return (
    <div className="rounded-md border border-canvas-border bg-arc-paper p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {comment.mediaComment && attachment ? (
            <div className="space-y-2">
              <RichContentViewer
                html={wrapPlainTextAsHtml(comment.body)}
                courseId={courseId}
                spacing="compact"
                className="text-sm text-gray-700"
              />
              <audio controls src={attachment.dataUrl} className="w-full max-w-full" />
            </div>
          ) : (
            <RichContentViewer
              html={wrapPlainTextAsHtml(comment.body)}
              courseId={courseId}
              spacing="compact"
              className="text-sm text-gray-700"
            />
          )}
          {comment.attachmentName && !comment.mediaComment && (
            <p className="mt-2 text-xs text-gray-500">Attachment: {comment.attachmentName}</p>
          )}
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 rounded p-1 text-red-600 hover:bg-red-50"
            title="Delete comment"
          >
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {comment.author} · {commentRoleLabel(comment.role)} ·{" "}
        {formatSubmissionTimestamp(comment.createdAt)}
      </p>
    </div>
  );
}

export default function AssignmentGradePage() {
  const { courseId, assignmentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const currentUser = loadUser();
  const { showToast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);

  const assignment = assignmentId ? getAssignmentById(effectiveCourseId, assignmentId) : undefined;
  const course = loadCourses().find((c) => c.id === effectiveCourseId);
  const courseLatePenaltyPresets = getCourseLatePenaltyPresets(course);
  const courseLatePreset = getCourseAssignmentDefaults(course).latePenaltyPresetId;
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionSort, setSubmissionSort] = useState<SubmissionSortKey>("newest");
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatusFilter>("all");
  const [score, setScore] = useState("");
  const [rawScore, setRawScore] = useState("");
  const [status, setStatus] = useState("None");
  const [latePenaltyPresetId, setLatePenaltyPresetId] = useState(courseLatePreset);
  const [latePenaltyManual, setLatePenaltyManual] = useState(0);
  const [latePenaltyPoints, setLatePenaltyPoints] = useState(0);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [rubricOpen, setRubricOpen] = useState(true);
  const [applyToGroup, setApplyToGroup] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [activeTool, setActiveTool] = useState<GraderAnnotationTool>("select");
  const [helpOpen, setHelpOpen] = useState(false);
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);
  const [rubricAssessments, setRubricAssessments] = useState<RubricAssessment[]>([]);
  const [previewLoaded, setPreviewLoaded] = useState(true);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [docAnnotations, setDocAnnotations] = useState<DocumentAnnotation[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [publishTick, setPublishTick] = useState(0);
  const [peerReviewTick, setPeerReviewTick] = useState(0);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const submissionParam = searchParams.get("submission");
  const studentIdParam = searchParams.get("student");
  const columnKey = assignmentId ? `assignment:${assignmentId}` : "";

  useEffect(() => {
    const bump = () => setPublishTick((n) => n + 1);
    window.addEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
    return () => window.removeEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    const bump = () => setPeerReviewTick((n) => n + 1);
    window.addEventListener(PEER_REVIEWS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(PEER_REVIEWS_CHANGED_EVENT, bump);
  }, []);

  const rosterSubmissions = useMemo(
    () =>
      studentView
        ? submissions.filter((s) => s.studentId === currentUser.id)
        : submissions,
    [studentView, submissions, currentUser.id],
  );

  const selectedId = useMemo(() => {
    if (submissionParam) {
      const match = rosterSubmissions.find((s) => s.id === submissionParam);
      if (match) return submissionParam;
      if (studentView && rosterSubmissions[0]) return rosterSubmissions[0].id;
    }
    if (studentIdParam) {
      const subs = rosterSubmissions.filter((s) => s.studentId === studentIdParam);
      const preferred =
        subs.find((s) => s.status === "submitted") ??
        subs.find((s) => s.status === "graded") ??
        subs[0];
      return preferred?.id ?? null;
    }
    return rosterSubmissions[0]?.id ?? null;
  }, [submissionParam, studentIdParam, rosterSubmissions, studentView]);

  const studentOnlyMode = !!studentIdParam && selectedId == null;
  const pendingStudentName = studentOnlyMode
    ? getRosterStudentName(effectiveCourseId, studentIdParam!)
    : null;
  const anonymousEnabled = !!assignment?.anonymousGrading;
  const displayNameFor = (studentId: string, realName: string) =>
    graderDisplayName({
      courseId: effectiveCourseId,
      columnKey,
      studentId,
      realName,
      anonymousEnabled,
    });

  const handlePageCountChange = useCallback((total: number) => {
    setPageCount((prev) => (prev === total ? prev : total));
    setPage((p) => (p > total ? total : p));
  }, []);

  const handleAnnotationsChange = useCallback(() => {
    if (selectedId) setDocAnnotations(loadDocumentAnnotations(selectedId));
  }, [selectedId]);

  const handleSidebarResizeStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    sidebarResizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!sidebarResizeRef.current) return;
      const delta = sidebarResizeRef.current.startX - e.clientX;
      const next = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, sidebarResizeRef.current.startWidth + delta),
      );
      setSidebarWidth(next);
    };

    const onUp = () => {
      if (!sidebarResizeRef.current) return;
      sidebarResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarWidth((width) => {
        try {
          window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
        } catch {}
        return width;
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const maxPoints = assignment?.points ?? 100;
  const rubricDef = useMemo(
    () => resolveAssignmentRubric(effectiveCourseId, assignment, maxPoints),
    [effectiveCourseId, assignment, maxPoints],
  );

  useEffect(() => {
    if (!assignmentId) return;
    const refresh = () => setSubmissions(loadSubmissionsForAssignment(effectiveCourseId, assignmentId));
    refresh();
    window.addEventListener("canvasClone:assignmentSubmissionsChanged", refresh);
    return () => window.removeEventListener("canvasClone:assignmentSubmissionsChanged", refresh);
  }, [effectiveCourseId, assignmentId]);

  useEffect(() => {
    if (!studentView || !submissionParam || rosterSubmissions.length === 0) return;
    const allowed = rosterSubmissions.some((s) => s.id === submissionParam);
    if (!allowed) {
      setSearchParams(
        buildAssignmentGraderParams(rosterSubmissions[0].id, searchParams.get("returnTo")),
        { replace: true },
      );
    }
  }, [studentView, submissionParam, rosterSubmissions, searchParams, setSearchParams]);

  const filteredSubmissions = useMemo(
    () =>
      filterAssignmentSubmissions(
        rosterSubmissions,
        {
          search: submissionSearch,
          sort: submissionSort,
          status: submissionStatus,
        },
        assignment
          ? (studentId) =>
              getEffectiveDueAt(
                effectiveCourseId,
                "assignment",
                assignment.id,
                assignment.dueAt,
                studentId,
              )
          : undefined,
      ),
    [rosterSubmissions, submissionSearch, submissionSort, submissionStatus, assignment, effectiveCourseId],
  );

  const selectedIndex = rosterSubmissions.findIndex((s) => s.id === selectedId);
  const selected = selectedIndex >= 0 ? rosterSubmissions[selectedIndex] : rosterSubmissions[0];
  const headerDisplayName = selected
    ? displayNameFor(selected.studentId, selected.studentName)
    : studentOnlyMode && studentIdParam && pendingStudentName
      ? displayNameFor(studentIdParam, pendingStudentName)
      : pendingStudentName;
  const headerInitials = (headerDisplayName ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!selected) return;
    const savedStatus = savedSubmissionStatus(selected);
    const assessments = defaultAssessments(rubricDef, selected.rubricAssessments ?? undefined);
    const rubricTotal = sumRubricAssessments(assessments);
    const base = inferRawScore(selected.score, selected.latePenalty, selected.rawScore);
    const resolvedRaw = base > 0 ? base : rubricTotal;
    const dueAt = selected
      ? getEffectiveDueAt(
          effectiveCourseId,
          "assignment",
          assignment?.id ?? "",
          assignment?.dueAt,
          selected.studentId,
        )
      : assignment?.dueAt;
    const autoApplyLate = dueAt && shouldAutoApplyLatePenalty(selected, dueAt);

    setFeedbackDraft("");
    setRubricAssessments(assessments);
    setCommentDraft("");
    setPreviewLoaded(true);
    setRotation(0);
    setZoom(100);
    setPage(1);
    setPageCount(1);
    setDocAnnotations(loadDocumentAnnotations(selected.id));

    if (autoApplyLate) {
      const presetId =
        selected.latePenaltyPresetId ?? courseLatePreset;
      const { penalty, finalScore } = computeAutoLatePenalty(
        resolvedRaw,
        selected.submittedAt,
        dueAt,
        presetId,
        0,
        courseLatePenaltyPresets,
      );
      setStatus("Late");
      setLatePenaltyPresetId(presetId);
      setLatePenaltyManual(0);
      setLatePenaltyPoints(penalty);
      setRawScore(String(resolvedRaw));
      setScore(String(finalScore));
      return;
    }

    setScore(selected.score?.toString() ?? "");
    setRawScore(String(resolvedRaw));
    setStatus(savedStatus);
    setLatePenaltyPresetId(selected.latePenaltyPresetId ?? courseLatePreset);
    setLatePenaltyManual(selected.latePenalty ?? 0);
    setLatePenaltyPoints(selected.late ? (selected.latePenalty ?? 0) : 0);
  }, [selected?.id, selected?.studentId, rubricDef, assignment?.dueAt, assignment?.id, effectiveCourseId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return;
    const refresh = () => setDocAnnotations(loadDocumentAnnotations(selected.id));
    window.addEventListener("canvasClone:docAnnotationsChanged", refresh);
    return () => window.removeEventListener("canvasClone:docAnnotationsChanged", refresh);
  }, [selected?.id]);

  const hasUnsavedGradeChanges = useMemo(() => {
    if (!selected) return false;
    const savedRubric = defaultAssessments(rubricDef, selected.rubricAssessments ?? undefined);
    const rawScoreValue = Number(rawScore) || 0;
    return (
      !scoresEqual(score, selected.score) ||
      status !== savedSubmissionStatus(selected) ||
      !rubricAssessmentsEqual(rubricAssessments, savedRubric) ||
      !latePenaltyFieldsEqual(
        selected,
        status === "Late",
        latePenaltyPresetId,
        latePenaltyPoints,
        rawScoreValue,
        courseLatePreset,
      ) ||
      feedbackDraft.trim().length > 0
    );
  }, [
    selected,
    score,
    rawScore,
    status,
    rubricAssessments,
    rubricDef,
    feedbackDraft,
    latePenaltyPresetId,
    latePenaltyPoints,
    courseLatePreset,
  ]);

  const gradedCount = rosterSubmissions.filter((s) => s.status === "graded").length;
  const averageScore =
    gradedCount > 0
      ? rosterSubmissions
          .filter((s) => s.status === "graded" && typeof s.score === "number")
          .reduce((sum, s) => sum + (s.score ?? 0), 0) / gradedCount
      : 0;
  const averagePct = maxPoints > 0 ? Math.round((averageScore / maxPoints) * 100) : 0;

  if (!assignment || !assignmentId) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Assignment not found.</p>
      </div>
    );
  }

  const assignmentViewerPath = `/courses/${effectiveCourseId}/assignments/${assignmentId}`;
  const exitPath = safeReturnPath(searchParams.get("returnTo"), assignmentViewerPath);

  const selectSubmission = (id: string) => {
    setSearchParams(buildAssignmentGraderParams(id, searchParams.get("returnTo")), {
      replace: true,
    });
  };

  const activeStudentId = selected?.studentId ?? studentIdParam;
  const studentDueAt = getEffectiveDueAt(
    effectiveCourseId,
    "assignment",
    assignment.id,
    assignment.dueAt,
    activeStudentId ?? "",
  );

  const goToStudent = (delta: number) => {
    if (rosterSubmissions.length === 0) return;
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    const next = Math.max(0, Math.min(rosterSubmissions.length - 1, idx + delta));
    selectSubmission(rosterSubmissions[next]!.id);
  };

  const storedFile = selected ? getSubmissionFile(selected.id) : null;

  const peerReviewsForSelected = useMemo(() => {
    if (!assignmentId || !selected || !assignment?.peerReviewEnabled) return [];
    return getPeerReviewsForReviewee(effectiveCourseId, assignmentId, selected.studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectiveCourseId,
    assignmentId,
    selected?.studentId,
    assignment?.peerReviewEnabled,
    peerReviewTick,
  ]);

  const incompletePeerReviewers = useMemo(() => {
    if (!assignmentId || !assignment?.peerReviewEnabled || studentView) return [];
    return listIncompletePeerReviewers(effectiveCourseId, assignmentId);
  }, [
    effectiveCourseId,
    assignmentId,
    assignment?.peerReviewEnabled,
    peerReviewTick,
    studentView,
  ]);

  const handleDownload = () => {
    if (storedFile) {
      downloadStoredFile(storedFile);
      return;
    }
    showToast("File download unavailable for this submission", "negative");
  };

  const applyRubricScore = (nextAssessments: RubricAssessment[]) => {
    setRubricAssessments(nextAssessments);
    const base = sumRubricAssessments(nextAssessments);
    if (status === "Late") {
      const preset = getLatePenaltyPreset(latePenaltyPresetId, courseLatePenaltyPresets);
      const manual = preset.type === "manual" ? latePenaltyManual : 0;
      syncScoreWithLatePenalty(base, latePenaltyPresetId, manual, true);
      return;
    }
    syncScoreWithLatePenalty(base, latePenaltyPresetId, 0, false);
  };

  const syncScoreWithLatePenalty = (
    base: number,
    presetId: string,
    manualPenalty: number,
    isLate: boolean,
  ) => {
    if (!isLate) {
      setRawScore(String(base));
      setLatePenaltyPoints(0);
      setScore(String(base));
      return;
    }
    const preset = getLatePenaltyPreset(presetId, courseLatePenaltyPresets);
    const penalty = calculateLatePenalty(
      preset,
      base,
      studentDueAt,
      selected!.submittedAt,
      manualPenalty,
    );
    setRawScore(String(base));
    setLatePenaltyPoints(penalty);
    setScore(String(finalScoreAfterPenalty(base, penalty)));
  };

  const handleStatusChange = (nextStatus: string) => {
    setStatus(nextStatus);
    const base =
      Number(rawScore) || Number(score) || sumRubricAssessments(rubricAssessments);
    if (nextStatus === "Late") {
      const preset = getLatePenaltyPreset(latePenaltyPresetId, courseLatePenaltyPresets);
      const manual = preset.type === "manual" ? latePenaltyManual : 0;
      syncScoreWithLatePenalty(base, latePenaltyPresetId, manual, true);
      return;
    }
    setLatePenaltyPresetId(courseLatePreset);
    setLatePenaltyManual(0);
    syncScoreWithLatePenalty(base, latePenaltyPresetId, 0, false);
  };

  const handleLatePenaltyPresetChange = (presetId: string) => {
    setLatePenaltyPresetId(presetId);
    const base = Number(rawScore) || Number(score) || sumRubricAssessments(rubricAssessments);
    const preset = getLatePenaltyPreset(presetId, courseLatePenaltyPresets);
    const manual = preset.type === "manual" ? latePenaltyManual : 0;
    syncScoreWithLatePenalty(base, presetId, manual, true);
  };

  const handleLatePenaltyManualChange = (value: number) => {
    const safe = Math.max(0, value);
    setLatePenaltyManual(safe);
    setLatePenaltyPresetId(MANUAL_LATE_PENALTY_PRESET_ID);
    const base = Number(rawScore) || 0;
    setLatePenaltyPoints(safe);
    setScore(String(finalScoreAfterPenalty(base, safe)));
  };

  const handleScoreChange = (value: string) => {
    setScore(value);
    if (status !== "Late") {
      setRawScore(value);
      return;
    }
    const finalScore = Number(value);
    const base = Number(rawScore) || 0;
    if (!Number.isFinite(finalScore)) return;
    const manualPenalty = Math.max(0, base - finalScore);
    setLatePenaltyManual(manualPenalty);
    setLatePenaltyPoints(manualPenalty);
    setLatePenaltyPresetId(MANUAL_LATE_PENALTY_PRESET_ID);
  };

  const selectRubricRating = (criterionId: string, ratingId: string, earned: number) => {
    const next = rubricAssessments.filter((a) => a.criterionId !== criterionId);
    next.push({ criterionId, ratingId, earned });
    applyRubricScore(next);
  };

  const updateCriterionPoints = (criterionId: string, earned: number) => {
    const criterion = rubricDef.find((c) => c.id === criterionId);
    if (!criterion) return;
    const clamped = Math.max(0, Math.min(criterion.points, earned));
    const current = getAssessmentForCriterion(rubricAssessments, criterionId);
    const ratingId = current?.ratingId ?? criterion.ratings[0]!.id;
    const next = rubricAssessments.filter((a) => a.criterionId !== criterionId);
    next.push({ criterionId, ratingId, earned: clamped });
    applyRubricScore(next);
  };

  const handleAddComment = () => {
    if (!selected || richTextIsEmpty(commentDraft)) return;
    addSubmissionComment(effectiveCourseId, selected.id, commentDraft, staffCommentRole());
    setCommentDraft("");
    setSubmissions(loadSubmissionsForAssignment(effectiveCourseId, assignmentId));
    showToast("Comment added", "positive", "grading");
  };

  const handleDeleteComment = (commentId: string) => {
    if (!selected) return;
    deleteSubmissionComment(effectiveCourseId, selected.id, commentId);
    setSubmissions(loadSubmissionsForAssignment(effectiveCourseId, assignmentId));
    showToast("Comment deleted", "positive", "grading");
  };

  const handleDeleteFeedbackEntry = (entryId: string) => {
    if (!selected) return;
    deleteFeedbackEntry(effectiveCourseId, selected.id, entryId);
    setSubmissions(loadSubmissionsForAssignment(effectiveCourseId, assignmentId));
    showToast("Feedback deleted", "positive", "grading");
  };

  const handlePostFeedback = () => {
    if (!selected || richTextIsEmpty(feedbackDraft)) return;
    appendSubmissionFeedback(effectiveCourseId, selected.id, feedbackDraft);
    setFeedbackDraft("");
    setSubmissions(loadSubmissionsForAssignment(effectiveCourseId, assignmentId));
    showToast("Feedback added", "positive", "grading");
  };

  const handleDeleteDocAnnotation = (annotationId: string) => {
    if (!selected) return;
    deleteDocumentAnnotation(selected.id, annotationId);
    setDocAnnotations(loadDocumentAnnotations(selected.id));
    showToast("Document annotation deleted", "positive", "grading");
  };

  const handleSaveGrade = () => {
    if (!selected) return;
    const numericScore = score ? Number(score) : undefined;
    if (numericScore != null && (numericScore < 0 || numericScore > maxPoints)) {
      showToast(`Score must be between 0 and ${maxPoints}`, "negative");
      return;
    }

    gradeSubmission(effectiveCourseId, selected.id, {
      score: numericScore,
      rubricAssessments,
      late: status === "Late",
      rawScore: status === "Late" ? (rawScore ? Number(rawScore) : numericScore) : undefined,
      latePenalty: status === "Late" ? latePenaltyPoints : undefined,
      latePenaltyPresetId: status === "Late" ? latePenaltyPresetId : undefined,
      markGraded: true,
    });
    if (applyToGroup && assignment?.groupSetId && assignmentId) {
      applyGradeToGroupmates(effectiveCourseId, assignmentId, selected.studentId, {
        score: numericScore,
        rubricAssessments,
        late: status === "Late",
        rawScore: status === "Late" ? (rawScore ? Number(rawScore) : numericScore) : undefined,
        latePenalty: status === "Late" ? latePenaltyPoints : undefined,
        latePenaltyPresetId: status === "Late" ? latePenaltyPresetId : undefined,
      });
    }
    if (feedbackDraft.trim()) {
      appendSubmissionFeedback(effectiveCourseId, selected.id, feedbackDraft);
      setFeedbackDraft("");
    }
    showToast(
      applyToGroup && assignment?.groupSetId ? "Grade saved for the group" : "Grade saved",
      "positive",
      "grading",
    );
    const refreshed = loadSubmissionsForAssignment(effectiveCourseId, assignmentId);
    setSubmissions(refreshed);
    const updated = refreshed.find((s) => s.id === selected.id);
    if (updated) {
      setScore(updated.score?.toString() ?? "");
      setStatus(savedSubmissionStatus(updated));
      setRawScore(String(inferRawScore(updated.score, updated.latePenalty, updated.rawScore)));
      setLatePenaltyPresetId(updated.latePenaltyPresetId ?? courseLatePreset);
      setLatePenaltyManual(updated.latePenalty ?? 0);
      setLatePenaltyPoints(updated.late ? (updated.latePenalty ?? 0) : 0);
      setRubricAssessments(
        defaultAssessments(rubricDef, updated.rubricAssessments ?? undefined),
      );
    }
    setRubricOpen(false);
  };

  const allComments: SubmissionComment[] = selected?.comments ?? [];
  const feedbackEntries = selected ? getFeedbackEntries(selected) : [];
  const visibilityStudentId =
    selected?.studentId ?? studentIdParam ?? currentUser.id;
  const itemVisible =
    Boolean(columnKey) &&
    isItemGradeVisible(effectiveCourseId, columnKey, visibilityStudentId);
  // Re-evaluate when publish state changes (publishTick).
  void publishTick;
  const visibleStudentComments = studentView
    ? allComments.filter((c) => c.role === "student" || itemVisible)
    : allComments;
  const visibleDocAnnotations = studentView && !itemVisible ? [] : docAnnotations;
  const visibleFeedbackEntries = studentView && !itemVisible ? [] : feedbackEntries;
  const dueLabel = studentDueAt ? formatAssignmentDueDate(studentDueAt) : "No due date";
  const availabilityLabel = formatAvailabilitySummary(assignment);
  const courseLabel = course ? `(${course.term}) ${course.title}` : effectiveCourseId;
  const activeLatePenaltyPreset = getLatePenaltyPreset(latePenaltyPresetId, courseLatePenaltyPresets);
  const lateUnits =
    selected && studentDueAt
      ? lateDuration(
          studentDueAt,
          selected.submittedAt,
          activeLatePenaltyPreset.unit ?? "days",
        )
      : 0;
  const lateDurationLabel = formatLateDuration(
    lateUnits,
    activeLatePenaltyPreset.unit ?? "days",
  );
  const parsedRawScore = Number(rawScore) || 0;

  const toolBtn = (tool: GraderAnnotationTool, icon: ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setActiveTool(tool);
        showToast(`${label} tool selected`, "positive", "saved");
      }}
      className={`rounded p-1.5 ${activeTool === tool ? "bg-arc-paper" : "hover:bg-arc-paper"}`}
      title={label}
    >
      {icon}
    </button>
  );

  return (
    <>
    <GradeProShell
      exitTo={exitPath}
      title={assignment.title}
      subtitle={`Due: ${dueLabel}${availabilityLabel ? ` · ${availabilityLabel}` : ""} — ${courseLabel}`}
      stats={
        !studentView ? (
          <>
            <span>
              {gradedCount}/{rosterSubmissions.length} Graded
            </span>
            <span>
              {averageScore.toFixed(1)} / {maxPoints} ({averagePct}%) Average
            </span>
            <span>
              {rosterSubmissions.length === 0
                ? "0/0"
                : `${(selectedIndex >= 0 ? selectedIndex : 0) + 1}/${rosterSubmissions.length}`}{" "}
              Students
            </span>
          </>
        ) : (
          <span className="text-arc-cream/90">Your submission</span>
        )
      }
      trailing={
        <>
          {!studentView && (
            <>
              <button
                type="button"
                onClick={() => goToStudent(-1)}
                disabled={rosterSubmissions.length <= 1 || selectedIndex <= 0}
                className={gradeProNavBtnClass}
              >
                <Icon name="chevronLeft" size={20} />
              </button>
              <button
                type="button"
                onClick={() => goToStudent(1)}
                disabled={
                  rosterSubmissions.length <= 1 ||
                  selectedIndex >= rosterSubmissions.length - 1
                }
                className={gradeProNavBtnClass}
              >
                <Icon name="chevronRight" size={20} />
              </button>
            </>
          )}
          {(selected || studentOnlyMode) && (
            <div className={gradeProChipClass}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-arc-sage text-xs font-bold text-white">
                {headerInitials}
              </span>
              <span className="max-w-[140px] truncate text-sm">{headerDisplayName}</span>
              {selected && isLateSubmission(selected, studentDueAt) && (
                <LateSubmissionBadge variant="dark" />
              )}
            </div>
          )}
          {!studentView && (
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className={gradeProNavBtnClass}
              title="Help"
            >
              <Icon name="help" size={20} />
            </button>
          )}
          {!studentView && activeStudentId && (
            <GradePublishButton
              courseId={effectiveCourseId}
              studentId={activeStudentId}
              columnKey={columnKey}
              variant="dark"
            />
          )}
        </>
      }
    >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-arc-paper text-arc-ink">
          <div className="flex shrink-0 items-center gap-1 border-b border-arc-ink/10 bg-arc-ivory px-3 py-2 text-arc-ink">
            <button
              type="button"
              onClick={handleDownload}
              className="rounded p-1.5 hover:bg-arc-paper disabled:opacity-40"
              title="Download submission"
            >
              <Icon name="download" size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded p-1.5 hover:bg-arc-paper disabled:opacity-40"
              title="Previous page"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <span className="px-2 text-xs">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded p-1.5 hover:bg-arc-paper disabled:opacity-40"
              title="Next page"
            >
              <Icon name="chevronRight" size={16} />
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="rounded p-1.5 hover:bg-arc-paper disabled:opacity-40"
              title="Rotate document"
            >
              <Icon name="rotate" size={16} />
            </button>
            <div className="mx-2 h-5 w-px bg-arc-ink/15" />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="rounded p-1.5 hover:bg-arc-paper disabled:opacity-40"
            >
              <Icon name="zoomOut" size={16} />
            </button>
            <span className="min-w-[3rem] text-center text-xs">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="rounded p-1.5 hover:bg-arc-paper disabled:opacity-40"
            >
              <Icon name="zoomIn" size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(100);
                setRotation(0);
              }}
              className="rounded p-1.5 hover:bg-arc-paper disabled:opacity-40"
              title="Reset view"
            >
              <Icon name="expand" size={16} />
            </button>
            <div className="mx-2 h-5 w-px bg-arc-ink/15" />
            {!studentView && (
              <>
            {toolBtn("select", <MousePointer2 className="h-4 w-4" />, "Select")}
            {toolBtn("comment", <Pencil className="h-4 w-4" />, "Comment")}
            {toolBtn("text", <Type className="h-4 w-4" />, "Text")}
              </>
            )}
          </div>

          <div ref={previewRef} className="flex min-h-0 flex-1 overflow-auto">
            {studentOnlyMode ? (
              <GradeEmptyState
                fill
                title="No submission yet"
                subtitle={`${pendingStudentName} has not submitted this assignment.`}
              />
            ) : !selected ? (
              <GradeEmptyState
                fill
                title="No submissions to grade yet"
                subtitle="When students submit this assignment, their work will appear here."
              />
            ) : !previewLoaded ? (
              <div className="flex h-full items-center justify-center text-gray-500">
                Click a submitted file to load preview.
              </div>
            ) : (
              <MemoizedSubmissionPreview
                submission={selected}
                zoom={zoom}
                rotation={rotation}
                page={page}
                activeTool={activeTool}
                readOnly={studentView && !itemVisible}
                hideAnnotations={studentView && !itemVisible}
                onPageCountChange={handlePageCountChange}
                onAnnotationsChange={handleAnnotationsChange}
              />
            )}
          </div>
        </div>

        <aside
          style={{ width: sidebarWidth }}
          className="relative flex shrink-0 flex-col border-l border-arc-ink/10 bg-arc-ivory text-arc-ink"
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize grading panel"
            onMouseDown={handleSidebarResizeStart}
            className="absolute -left-1 top-0 z-20 h-full w-2 cursor-col-resize touch-none hover:bg-arc-copper/15 active:bg-arc-copper/25"
          />
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-4">
              {studentView ? (
                <div className="w-full space-y-5 p-5">
                  <StudentGradeProScoreSection
                    courseId={effectiveCourseId}
                    columnKey={columnKey}
                    maxPoints={maxPoints}
                    score={null}
                    isGraded={false}
                  />
                  <p className="text-center text-sm text-gray-500">
                    You haven&apos;t submitted this assignment yet.
                  </p>
                </div>
              ) : (
                <GradeEmptyState
                  compact
                  title="Select a submission"
                  subtitle="Choose a student from the list below to begin grading."
                />
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-5 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-gray-500">
                    Submitted: {formatSubmissionTimestamp(selected.submittedAt)}
                  </p>
                  {isLateSubmission(selected, studentDueAt) && <LateSubmissionBadge />}
                </div>

                <div>
                  <p className="text-sm font-semibold text-canvas-grayDark">
                    Submitted Files:{" "}
                    <span className="font-normal text-gray-500">(click to load)</span>
                  </p>
                  {selected.fileName ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewLoaded(true);
                        previewRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                        if (storedFile) showToast("Preview loaded", "positive", "saved");
                        else showToast("Preview unavailable — file not stored locally", "negative");
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded border border-canvas-border px-3 py-2 text-left text-sm text-canvas-blue hover:bg-gray-50"
                    >
                      <Icon name="download" size={16} className="shrink-0" />
                      <span className="truncate">
                        {anonymousFileLabel(
                          isIdentityHidden({
                            courseId: effectiveCourseId,
                            columnKey,
                            studentId: selected.studentId,
                            anonymousEnabled,
                          }),
                          selected.fileName,
                        )}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewLoaded(true);
                        previewRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="mt-2 text-sm text-canvas-blue hover:underline"
                    >
                      View text entry
                    </button>
                  )}
                </div>

                {studentView ? (
                  <>
                    <StudentGradeProScoreSection
                      courseId={effectiveCourseId}
                      columnKey={columnKey}
                      maxPoints={maxPoints}
                      score={
                        selected.status === "graded" && typeof selected.score === "number"
                          ? selected.score
                          : null
                      }
                      isGraded={selected.status === "graded"}
                    />

                    <div className="border-t border-canvas-border pt-4">
                      <h3 className="mb-2 text-sm font-semibold text-canvas-grayDark">Comments</h3>
                      <div className="max-h-48 space-y-2 overflow-y-auto">
                        {visibleStudentComments.length === 0 &&
                          visibleDocAnnotations.length === 0 && (
                          <p className="text-sm text-gray-500">No comments yet.</p>
                        )}
                        {visibleStudentComments.map((comment) => (
                          <CommentItem
                            key={comment.id}
                            comment={comment}
                            courseId={effectiveCourseId}
                          />
                        ))}
                        {visibleDocAnnotations.map((ann) => (
                          <div
                            key={ann.id}
                            className="rounded-md border border-blue-200 bg-blue-50/50 p-3"
                          >
                            <p className="text-xs font-medium text-canvas-blue">
                              On document · Page {ann.page}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{ann.body}</p>
                          </div>
                        ))}
                      </div>
                      <SubmissionCommentComposer
                        courseId={effectiveCourseId}
                        submissionId={selected.id}
                        onPosted={() =>
                          setSubmissions(
                            loadSubmissionsForAssignment(effectiveCourseId, assignmentId),
                          )
                        }
                      />
                    </div>

                    <div className="border-t border-canvas-border pt-4">
                      <h3 className="mb-2 text-sm font-semibold text-canvas-grayDark">
                        Assignment feedback
                      </h3>
                      {!itemVisible ? (
                        <p className="text-sm text-gray-500">
                          Feedback will appear when your grade is posted
                        </p>
                      ) : visibleFeedbackEntries.length === 0 ? (
                        <p className="text-sm text-gray-500">No feedback yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {visibleFeedbackEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-md border border-green-200 bg-green-50 p-3"
                            >
                              <p className="whitespace-pre-wrap text-sm text-gray-700">{entry.body}</p>
                              <p className="mt-1 text-xs text-gray-500">
                                {entry.author} · {formatSubmissionTimestamp(entry.createdAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                <>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Grade out of {maxPoints}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={maxPoints}
                      value={score}
                      onChange={(e) => handleScoreChange(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    {status === "Late" && (
                      <p className="mt-1 text-xs text-gray-500">
                        Base score: {parsedRawScore} · Late penalty: −{latePenaltyPoints} · Final:{" "}
                        {score || "—"}
                      </p>
                    )}
                    {rubricAssessments.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        Rubric total: {sumRubricAssessments(rubricAssessments)} / {maxPoints}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                    <div className="relative">
                      <select
                        value={status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="w-full appearance-none rounded-md border border-gray-300 bg-arc-paper px-3 py-2 text-sm"
                      >
                        <option value="None">None</option>
                        <option value="Graded">Graded</option>
                        <option value="Late">Late</option>
                      </select>
                      <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-2 top-2.5 text-arc-mute" />
                    </div>
                  </div>
                  {status === "Late" && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-900">Late penalty</p>
                      <p className="mt-1 text-xs text-amber-800">
                        {lateUnits > 0
                          ? `Submitted ${lateDurationLabel} after the due date. Penalty auto-calculated from submission date and time.`
                          : studentDueAt
                            ? "Submitted on time — adjust penalty manually if needed."
                            : "No due date set — choose a preset or enter a manual deduction."}
                      </p>
                      <label className="mb-1 mt-3 block text-xs font-medium text-gray-600">
                        Penalty policy
                      </label>
                      <div className="relative">
                        <LatePenaltyPolicySelect
                          value={latePenaltyPresetId}
                          onChange={handleLatePenaltyPresetChange}
                          customPresets={courseLatePenaltyPresets}
                          className="w-full appearance-none rounded-md border border-gray-300 bg-arc-paper px-3 py-2 text-sm"
                        />
                        <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-2 top-2.5 text-arc-mute" />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {activeLatePenaltyPreset.description}
                      </p>
                      {activeLatePenaltyPreset.type === "manual" ? (
                        <div className="mt-3">
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Points to deduct
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={parsedRawScore}
                            value={latePenaltyManual}
                            onChange={(e) =>
                              handleLatePenaltyManualChange(Number(e.target.value))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      ) : (
                        <p className="mt-3 text-sm font-medium text-amber-900">
                          Deduction: −{latePenaltyPoints} pts
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-canvas-border pt-4">
                  <button
                    type="button"
                    onClick={() => setRubricOpen((v) => !v)}
                    className="flex w-full items-center justify-between text-sm font-semibold text-canvas-grayDark"
                  >
                    <span>Rubric</span>
                    <span className="text-xs font-normal text-gray-500">
                      {sumRubricAssessments(rubricAssessments)} / {maxPoints} pts ·{" "}
                      {rubricOpen ? "Hide" : "Show"}
                    </span>
                  </button>
                  {rubricOpen && (
                    <div className="mt-3 overflow-hidden rounded-md border border-canvas-border text-xs">
                      <div className="grid grid-cols-[1fr_1.2fr_80px] bg-gray-50 px-3 py-2 font-semibold text-gray-600">
                        <span>Criteria</span>
                        <span>Ratings</span>
                        <span className="text-right">Pts</span>
                      </div>
                      {rubricDef.map((criterion) => {
                        const assessment = getAssessmentForCriterion(
                          rubricAssessments,
                          criterion.id,
                        ) ?? {
                          criterionId: criterion.id,
                          ratingId: criterion.ratings[0]!.id,
                          earned: 0,
                        };
                        const ratingLabel = ratingLabelForAssessment(rubricDef, assessment);
                        const expanded = expandedCriterion === criterion.id;

                        return (
                          <div
                            key={criterion.id}
                            className="grid grid-cols-[1fr_1.2fr_80px] border-t border-canvas-border px-3 py-3"
                          >
                            <div>
                              <p className="font-semibold text-canvas-grayDark">{criterion.title}</p>
                              <p className="mt-1 text-gray-500">{criterion.description}</p>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedCriterion(expanded ? null : criterion.id)
                                }
                                className="mt-1 text-canvas-blue hover:underline"
                              >
                                {expanded ? "hide description" : "view longer description"}
                              </button>
                              {expanded && (
                                <p className="mt-2 text-gray-600">{criterion.longDescription}</p>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-canvas-grayDark">{ratingLabel}</p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {criterion.ratings.map((rating) => (
                                  <button
                                    key={rating.id}
                                    type="button"
                                    onClick={() =>
                                      selectRubricRating(criterion.id, rating.id, rating.points)
                                    }
                                    className={`rounded border px-1.5 py-0.5 text-[10px] ${
                                      assessment.ratingId === rating.id
                                        ? "border-canvas-blue bg-canvas-blueTint text-canvas-blue"
                                        : "border-gray-300 bg-arc-paper hover:bg-gray-50"
                                    }`}
                                  >
                                    {rating.label}
                                  </button>
                                ))}
                              </div>
                              <div className="relative mt-2 h-2 rounded-full bg-gray-200">
                                <div
                                  className="absolute left-0 top-0 h-2 rounded-full bg-canvas-blue"
                                  style={{
                                    width: `${
                                      criterion.points > 0
                                        ? (assessment.earned / criterion.points) * 100
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="text-right">
                              <input
                                type="number"
                                min={0}
                                max={criterion.points}
                                value={assessment.earned}
                                onChange={(e) =>
                                  updateCriterionPoints(criterion.id, Number(e.target.value))
                                }
                                className="mb-1 w-14 rounded border border-gray-300 px-1 py-0.5 text-right text-xs"
                              />
                              <p className="font-medium text-canvas-grayDark">
                                / {criterion.points} pts
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-canvas-border pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-canvas-grayDark">Comments</h3>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {allComments.length === 0 && docAnnotations.length === 0 && (
                      <p className="text-sm text-gray-500">No comments yet.</p>
                    )}
                    {allComments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        courseId={effectiveCourseId}
                        onDelete={() => handleDeleteComment(comment.id)}
                      />
                    ))}
                    {docAnnotations.map((ann) => (
                      <DocumentCommentItem
                        key={ann.id}
                        ann={ann}
                        onDelete={() => handleDeleteDocAnnotation(ann.id)}
                      />
                    ))}
                  </div>

                  <label className="mb-1 mt-3 block text-xs font-medium text-gray-600">
                    Add comment
                  </label>
                  <RichPromptField
                    value={commentDraft}
                    onChange={setCommentDraft}
                    courseId={effectiveCourseId}
                    mountKey={`asg-grade-comment-${selected.id}`}
                    placeholder="Add a comment for this submission..."
                    height={140}
                    alwaysEdit
                  />
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={richTextIsEmpty(commentDraft)}
                    className="mt-2 text-sm text-canvas-blue hover:underline disabled:opacity-50"
                  >
                    Post comment
                  </button>
                </div>

                <div className="border-t border-canvas-border pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-canvas-grayDark">
                    Assignment feedback
                  </h3>
                  <p className="mb-3 text-xs text-gray-500">Visible to the student after grading.</p>
                  {feedbackEntries.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {feedbackEntries.map((entry) => (
                        <FeedbackEntryItem
                          key={entry.id}
                          entry={entry}
                          courseId={effectiveCourseId}
                          onDelete={() => handleDeleteFeedbackEntry(entry.id)}
                        />
                      ))}
                    </div>
                  )}
                  <RichPromptField
                    value={feedbackDraft}
                    onChange={setFeedbackDraft}
                    courseId={effectiveCourseId}
                    mountKey={`asg-grade-feedback-${selected.id}`}
                    placeholder="Write feedback for the student..."
                    height={160}
                    alwaysEdit
                  />
                  <button
                    type="button"
                    onClick={handlePostFeedback}
                    disabled={richTextIsEmpty(feedbackDraft)}
                    className="mt-2 text-sm text-canvas-blue hover:underline disabled:opacity-50"
                  >
                    Post feedback
                  </button>
                </div>

                {assignment.peerReviewEnabled && (
                  <div className="border-t border-canvas-border pt-4">
                    <h3 className="mb-2 text-sm font-semibold text-canvas-grayDark">
                      Peer reviews
                    </h3>
                    <p className="mb-3 text-xs text-gray-500">
                      Peer scores are informational and do not replace the instructor grade.
                    </p>
                    {peerReviewsForSelected.length === 0 ? (
                      <p className="text-sm text-gray-500">No peer reviews yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {peerReviewsForSelected.map((review) => {
                          const reviewerName = assignment.peerReviewAnonymous
                            ? "Anonymous peer"
                            : getRosterMemberName(
                                effectiveCourseId,
                                review.reviewerId,
                              );
                          const complete = typeof review.submittedAt === "number";
                          return (
                            <div
                              key={review.id}
                              className="rounded-md border border-canvas-border bg-gray-50 p-3"
                            >
                              <p className="text-sm font-medium text-canvas-grayDark">
                                {reviewerName}
                              </p>
                              {complete ? (
                                <>
                                  <p className="mt-1 text-sm text-gray-700">
                                    Score: {review.score}
                                    {assignment.points != null
                                      ? ` / ${assignment.points}`
                                      : ""}
                                  </p>
                                  {review.comment && (
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                                      {review.comment}
                                    </p>
                                  )}
                                  {review.submittedAt && (
                                    <p className="mt-1 text-xs text-gray-500">
                                      {formatSubmissionTimestamp(review.submittedAt)}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p className="mt-1 text-sm text-gray-500">Pending</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {incompletePeerReviewers.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-600">Who hasn’t reviewed</p>
                        <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
                          {incompletePeerReviewers.map((row) => (
                            <li key={row.reviewerId}>
                              {getRosterMemberName(effectiveCourseId, row.reviewerId)}{" "}
                              <span className="text-xs text-gray-500">
                                ({row.pending} pending)
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                </>
                )}
              </div>
              </div>

            {!studentView && (
            <div className="mt-auto shrink-0 border-t border-canvas-border p-5">
                {assignment?.groupSetId && (
                  <label className="form-checkbox-label mb-3 text-sm">
                    <input
                      type="checkbox"
                      checked={applyToGroup}
                      onChange={(e) => setApplyToGroup(e.target.checked)}
                    />
                    Apply this grade to the whole group
                  </label>
                )}
                <button
                  type="button"
                  onClick={handleSaveGrade}
                  disabled={!hasUnsavedGradeChanges}
                  className="btn-canvas-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save grade
                </button>
                {selected && (
                  <button
                    type="button"
                    className="mt-2 w-full rounded-md border border-gray-300 bg-arc-paper px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      const next = !isGradeExcused(
                        effectiveCourseId,
                        columnKey,
                        selected.studentId,
                      );
                      setGradeExcused(
                        effectiveCourseId,
                        columnKey,
                        selected.studentId,
                        next,
                      );
                      showToast(next ? "Submission excused" : "Excuse cleared", "positive", "grading");
                    }}
                  >
                    {isGradeExcused(effectiveCourseId, columnKey, selected.studentId)
                      ? "Clear excuse"
                      : "Excuse missing / this item"}
                  </button>
                )}

                {rosterSubmissions.length > 1 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      All submissions
                    </p>
                    <ListFiltersBar
                      search={submissionSearch}
                      onSearchChange={setSubmissionSearch}
                      searchPlaceholder="Search students…"
                      sort={submissionSort}
                      onSortChange={(value) => setSubmissionSort(value as SubmissionSortKey)}
                      sortOptions={SUBMISSION_SORT_OPTIONS}
                      statusFilter={submissionStatus}
                      onStatusFilterChange={(value) =>
                        setSubmissionStatus(value as SubmissionStatusFilter)
                      }
                      statusOptions={SUBMISSION_STATUS_OPTIONS}
                      resultCount={filteredSubmissions.length}
                      totalCount={rosterSubmissions.length}
                      className="mb-2"
                    />
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {filteredSubmissions.length === 0 ? (
                        <div className="px-2 py-2">
                          <GradeEmptyState
                            compact
                            title="No matches"
                            subtitle="No submissions match the current filters."
                          />
                        </div>
                      ) : (
                        filteredSubmissions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => selectSubmission(s.id)}
                            className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100 ${
                              s.id === selected.id ? "bg-canvas-blueTint font-medium" : ""
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="min-w-0 truncate">
                                {displayNameFor(s.studentId, s.studentName)}
                                {s.status === "graded" && s.score != null ? ` · ${s.score}` : ""}
                              </span>
                              {isLateSubmission(
                                s,
                                getEffectiveDueAt(
                                  effectiveCourseId,
                                  "assignment",
                                  assignment.id,
                                  assignment.dueAt,
                                  s.studentId,
                                ),
                              ) && (
                                <LateSubmissionBadge className="scale-90" />
                              )}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          )}
          {!studentView && (
            <div className="shrink-0 p-4">
              <MissingStudentsPanel
                courseId={effectiveCourseId}
                kind="assignment"
                itemId={assignmentId}
                gradePath={`/courses/${effectiveCourseId}/assignments/${assignmentId}/grade`}
              />
            </div>
          )}
        </aside>
    </GradeProShell>

      {helpOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[210] flex items-center justify-center bg-arc-moss/45 p-4"
            data-gradepro-overlay
            role="dialog"
            aria-modal="true"
            aria-labelledby="gradepro-help-title"
          >
            <div className="paper-grain w-full max-w-md bg-arc-paper p-6 text-arc-ink shadow-lift ring-1 ring-arc-ink/10">
              <div className="flex items-start justify-between gap-4">
                <h2 id="gradepro-help-title" className="font-display text-lg font-medium">
                  GradePro help
                </h2>
                <button type="button" onClick={() => setHelpOpen(false)} className="text-arc-mute">
                  <Icon name="close" size={20} />
                </button>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-arc-mute">
                <li>Use arrow buttons to move between students.</li>
                <li>Click rubric ratings or edit points — the grade updates automatically.</li>
                <li>Assignment feedback is shown to the student on Submission Details.</li>
                <li>Post comment adds a threaded comment without replacing feedback.</li>
                <li>Use Comment tool, then click on the document to pin feedback.</li>
                <li>Use Text tool to place inline notes on the submission.</li>
                <li>Rotate and zoom affect the document only — the toolbar stays fixed.</li>
              </ul>
              <button type="button" onClick={() => setHelpOpen(false)} className="btn-canvas-primary mt-4">
                Close
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
