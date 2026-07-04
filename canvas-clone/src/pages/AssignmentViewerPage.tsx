import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Circle, Languages, Pencil, Paperclip } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import AssignmentAvailabilityFields, {
  MetadataItem,
} from "../components/AssignmentAvailabilityFields";
import PastDueBadge from "../components/PastDueBadge";
import LateSubmissionBadge from "../components/LateSubmissionBadge";
import RichContentEditor from "../components/RichContentEditor";
import RichContentViewer from "../components/RichContentViewer";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../hooks/useStudentView";
import { formatSubmissionTimestamp } from "../utils/assignmentDisplay";
import {
  deleteSubmissionFile,
  downloadStoredFile,
  getSubmissionFile,
  saveSubmissionFileFromUpload,
} from "../utils/submissionFileStorage";
import { getCourseById } from "../utils/coursesStore";
import { resolveStudentBackPath } from "../utils/courseNavigation";
import {
  autoPublishAssignment,
  canStudentSubmit,
  formatAssignmentDueDate,
  formatSubmissionTypeLabel,
  getAssignmentById,
  isAssignmentPastDue,
  isStudentViewableAssignment,
  loadAssignments,
  saveAssignments,
} from "../utils/assignments";
import {
  getFeedbackEntries,
  getStudentSubmission,
  loadSubmissionsForAssignment,
  submitAssignment,
} from "../utils/assignmentSubmissions";
import { isLateSubmission } from "../utils/latePenalty";

export default function AssignmentViewerPage() {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const { showToast } = useToast();

  const course = getCourseById(effectiveCourseId);
  const backTo = resolveStudentBackPath(
    effectiveCourseId,
    "assignments",
    course,
    (location.state as { from?: string } | null)?.from ??
      `/courses/${effectiveCourseId}/assignments`,
  );

  const [assignment, setAssignment] = useState(() =>
    assignmentId ? getAssignmentById(effectiveCourseId, assignmentId) : undefined,
  );
  const [submissionBody, setSubmissionBody] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attemptFormOpen, setAttemptFormOpen] = useState(false);
  const [submissionRevision, setSubmissionRevision] = useState(0);

  useEffect(() => {
    if ((location.state as { openSubmit?: boolean } | null)?.openSubmit) {
      setAttemptFormOpen(true);
    }
  }, [location.state]);

  useEffect(() => {
    const refresh = () => {
      if (!assignmentId) return;
      const all = loadAssignments(effectiveCourseId).map((a) => autoPublishAssignment(a));
      const changed = all.some((a, i) => a.status !== loadAssignments(effectiveCourseId)[i]?.status);
      if (changed) saveAssignments(effectiveCourseId, all);
      setAssignment(all.find((a) => a.id === assignmentId));
    };
    refresh();
    window.addEventListener("canvasClone:assignmentsChanged", refresh);
    return () => window.removeEventListener("canvasClone:assignmentsChanged", refresh);
  }, [effectiveCourseId, assignmentId]);

  const submission = useMemo(() => {
    if (!assignmentId) return undefined;
    return getStudentSubmission(effectiveCourseId, assignmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCourseId, assignmentId, assignment, submissionRevision]);

  const instructorSubmissionCount = useMemo(() => {
    if (!assignmentId || studentView) return 0;
    return loadSubmissionsForAssignment(effectiveCourseId, assignmentId).length;
  }, [effectiveCourseId, assignmentId, studentView, submissionRevision]);

  useEffect(() => {
    if (submission?.body) setSubmissionBody(submission.body);
    setSelectedFile(null);
    if (!submission) setAttemptFormOpen(true);
  }, [submission?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const refreshSubmission = () => setSubmissionRevision((n) => n + 1);
    window.addEventListener("canvasClone:assignmentSubmissionsChanged", refreshSubmission);
    return () => window.removeEventListener("canvasClone:assignmentSubmissionsChanged", refreshSubmission);
  }, []);

  const fromPath = (location.state as { from?: string } | null)?.from;
  const fromModules = typeof fromPath === "string" && fromPath.includes("/modules");

  useEffect(() => {
    const redirectAway = (reason: string) => {
      if (fromModules) {
        navigate(`/courses/${effectiveCourseId}/modules/unavailable`, {
          replace: true,
          state: { reason, from: fromPath },
        });
      } else {
        navigate(backTo, { replace: true });
      }
    };
    if (!assignment) {
      redirectAway("This assignment is no longer available.");
      return;
    }
    if (studentView && !isStudentViewableAssignment(assignment)) {
      redirectAway("This assignment hasn't been published yet.");
    }
  }, [assignment, studentView, navigate, backTo, effectiveCourseId, fromModules, fromPath]);

  if (!assignment || !assignmentId) return null;

  const now = Date.now();
  const isPublished = assignment.status === "published" || assignment.published === true;
  const togglePublish = () => {
    const all = loadAssignments(effectiveCourseId).map((a) =>
      a.id === assignment.id
        ? {
            ...a,
            status: (isPublished ? "draft" : "published") as "draft" | "published",
            published: !isPublished,
            publishAt: undefined,
          }
        : a,
    );
    saveAssignments(effectiveCourseId, all);
  };
  const canSubmit = studentView && canStudentSubmit(assignment, now);
  const pastDue = isAssignmentPastDue(assignment, now);
  const allowsText =
    assignment.submissionType === "online_text" ||
    assignment.submissionType === "online_text_upload";
  const allowsFile =
    assignment.submissionType === "online_upload" ||
    assignment.submissionType === "online_text_upload";
  const eitherTextOrFile = assignment.submissionType === "online_text_upload";
  const hasSubmissionPanel = assignment.submissionType !== "none";
  const showNewAttempt =
    studentView &&
    submission &&
    assignment.allowResubmissions &&
    canSubmit &&
    !attemptFormOpen;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const hasText = Boolean(submissionBody.trim());
    const hasFile = Boolean(selectedFile);
    const hasExistingText = Boolean(submission?.body?.trim());

    let result;

    if (eitherTextOrFile) {
      if (!hasText && !hasFile) {
        showToast("Add a text entry or a file upload", "negative");
        return;
      }
      result = submitAssignment(effectiveCourseId, assignmentId, {
        body: hasText ? submissionBody.trim() : undefined,
        fileName: hasFile ? selectedFile!.name : undefined,
        fileSize: hasFile ? selectedFile!.size : undefined,
        replaceContent: true,
      });
      if (hasFile && selectedFile) {
        const { saved, tooLarge } = await saveSubmissionFileFromUpload(result.id, selectedFile);
        if (tooLarge) {
          showToast("File submitted but is too large to preview locally", "negative");
        } else if (!saved) {
          showToast("File submitted but preview could not be saved", "negative");
        }
      } else {
        deleteSubmissionFile(result.id);
      }
    } else if (allowsText) {
      if (!hasText && !hasExistingText) {
        showToast("Add a text submission", "negative");
        return;
      }
      result = submitAssignment(effectiveCourseId, assignmentId, {
        body: submissionBody.trim() || submission?.body,
      });
    } else if (allowsFile) {
      const uploadedName = selectedFile?.name ?? submission?.fileName;
      if (!uploadedName) {
        showToast("Choose a file to upload", "negative");
        return;
      }
      result = submitAssignment(effectiveCourseId, assignmentId, {
        fileName: uploadedName,
        fileSize: selectedFile?.size,
      });
      if (selectedFile) {
        const { saved, tooLarge } = await saveSubmissionFileFromUpload(result.id, selectedFile);
        if (tooLarge) {
          showToast("File submitted but is too large to preview locally", "negative");
        } else if (!saved) {
          showToast("File submitted but preview could not be saved", "negative");
        }
      }
    } else {
      return;
    }

    setSelectedFile(null);
    setAttemptFormOpen(false);
    setSubmissionRevision((n) => n + 1);
    showToast("Submission recorded", "positive");
  };

  const canSubmitAttempt =
    eitherTextOrFile
      ? Boolean(submissionBody.trim() || selectedFile)
      : allowsText
        ? Boolean(submissionBody.trim() || submission?.body?.trim())
        : Boolean(selectedFile || submission?.fileName);

  const dueLabel = assignment.dueAt
    ? formatAssignmentDueDate(assignment.dueAt)
    : "No due date";
  const pointsLabel =
    assignment.points != null ? String(assignment.points) : "—";
  const submittingLabel = formatSubmissionTypeLabel(assignment.submissionType);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-white">
      <CourseHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto px-10 py-8 lg:px-14">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-2">
                <h1 className="text-2xl font-normal text-canvas-grayDark">{assignment.title}</h1>
                {!studentView && !isPublished && (
                  <span className="mt-1.5 shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Unpublished
                  </span>
                )}
                <button
                  type="button"
                  className="mt-1 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-canvas-blue"
                  title="Immersive Reader"
                  aria-label="Immersive Reader"
                >
                  <Languages className="h-5 w-5" />
                </button>
              </div>
              {studentView && showNewAttempt && (
                <button
                  type="button"
                  onClick={() => setAttemptFormOpen(true)}
                  className="btn-canvas-primary shrink-0"
                >
                  New Attempt
                </button>
              )}
              {!studentView && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePublish}
                    title={isPublished ? "Published — click to unpublish" : "Unpublished — click to publish"}
                    className={
                      isPublished
                        ? "inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
                        : "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    }
                  >
                    {isPublished ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                    {isPublished ? "Published" : "Publish"}
                  </button>
                  <Link
                    to={`/courses/${effectiveCourseId}/assignments/${assignmentId}/edit`}
                    className="btn-canvas-secondary inline-flex items-center gap-1"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Link>
                  <Link
                    to={`/courses/${effectiveCourseId}/assignments/${assignmentId}/grade`}
                    className="btn-canvas-primary"
                  >
                    Grade
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-10 gap-y-2 border-b border-canvas-border pb-5">
              <AssignmentAvailabilityFields assignment={assignment} />
              <MetadataItem label="Due" value={dueLabel} />
              <MetadataItem label="Points" value={pointsLabel} />
              <MetadataItem label="Submitting" value={submittingLabel} />
              {pastDue && studentView && <PastDueBadge />}
            </div>

            {assignment.description ? (
              <div className="prose prose-sm mt-6 max-w-none text-canvas-grayDark">
                <RichContentViewer html={assignment.description} courseId={effectiveCourseId} />
              </div>
            ) : (
              <p className="mt-6 text-sm text-gray-500">No additional instructions.</p>
            )}

            {studentView && hasSubmissionPanel && attemptFormOpen && canSubmit && (
              <div className="mt-10 border-t border-canvas-border pt-8">
                <h2 className="text-lg font-semibold text-canvas-grayDark">
                  {submission ? "New attempt" : "Submit assignment"}
                </h2>
                <div className="mt-4 space-y-4">
                  {eitherTextOrFile && (
                    <p className="text-sm text-gray-600">
                      Submit a text entry, a file upload, or both.
                    </p>
                  )}
                  {allowsText && (
                    <RichContentEditor
                      value={submissionBody}
                      onChange={setSubmissionBody}
                      height={180}
                      label={eitherTextOrFile ? "Text entry (optional)" : "Text entry"}
                      courseId={effectiveCourseId}
                    />
                  )}
                  {allowsFile && (
                    <div>
                      <label className="form-label" htmlFor="submission-file">
                        {eitherTextOrFile ? "File upload (optional)" : "File upload"}
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Choose file
                        </button>
                        <span className="min-w-0 truncate text-sm text-gray-600">
                          {selectedFile?.name ?? "No file selected"}
                        </span>
                        {selectedFile && (
                          <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="text-sm text-canvas-blue hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        id="submission-file"
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setSelectedFile(file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSubmitAttempt}
                      className="btn-canvas-primary disabled:opacity-50"
                    >
                      {submission ? "Submit attempt" : "Submit assignment"}
                    </button>
                    {submission && (
                      <button
                        type="button"
                        onClick={() => setAttemptFormOpen(false)}
                        className="btn-canvas-secondary"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {studentView && hasSubmissionPanel && !canSubmit && !submission && (
              <p className="mt-8 text-sm text-gray-500">
                {typeof assignment.availableUntil === "number" &&
                assignment.availableUntil < now
                  ? "This assignment is locked because its availability window has ended."
                  : "Submissions are not available."}
              </p>
            )}
          </div>
        </div>

        {hasSubmissionPanel && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-canvas-border bg-white px-6 py-8">
            {studentView ? (
              <div className="space-y-5">
                <h2 className="text-base font-semibold text-canvas-grayDark">Submission</h2>

                {submission ? (
                  <>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-canvas-green" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-canvas-grayDark">Submitted!</p>
                          {isLateSubmission(submission, assignment.dueAt) && (
                            <LateSubmissionBadge />
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {formatSubmissionTimestamp(submission.submittedAt)}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/courses/${effectiveCourseId}/assignments/${assignmentId}/submission`}
                      className="text-sm text-canvas-blue hover:underline"
                    >
                      Submission Details
                    </Link>

                    {submission.fileName && (
                      <button
                        type="button"
                        onClick={() => {
                          const stored = getSubmissionFile(submission.id);
                          if (stored) downloadStoredFile(stored);
                          else showToast("Re-submit the file to enable download", "negative");
                        }}
                        className="flex w-full items-center gap-2 text-sm text-canvas-blue hover:underline"
                      >
                        <Paperclip className="h-4 w-4 shrink-0" />
                        <span className="break-all">Download {submission.fileName}</span>
                      </button>
                    )}

                    {submission.body && (
                      <div className="rounded-md border border-canvas-border bg-canvas-grayLight/60 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Text entry
                        </p>
                        <RichContentViewer
                          html={submission.body}
                          courseId={effectiveCourseId}
                          className="text-sm"
                        />
                      </div>
                    )}

                    {submission.status === "graded" && submission.score != null && (
                      <div className="space-y-1 text-sm text-gray-700">
                        <p>
                          <span className="font-semibold text-canvas-grayDark">Grade:</span>{" "}
                          {submission.score}
                          {assignment.points != null
                            ? ` (${assignment.points} pts possible)`
                            : ""}
                        </p>
                        <p>
                          <span className="font-semibold text-canvas-grayDark">Graded Anonymously:</span>{" "}
                          no
                        </p>
                      </div>
                    )}

                    {submission.status === "graded" && getFeedbackEntries(submission).length > 0 && (
                      <div className="space-y-2">
                        {getFeedbackEntries(submission).map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-md border border-green-200 bg-green-50 p-3"
                          >
                            <p className="mb-2 text-xs font-semibold text-green-800">
                              Assignment feedback
                            </p>
                            <RichContentViewer
                              html={entry.body}
                              courseId={effectiveCourseId}
                              className="text-sm text-gray-700"
                            />
                            <p className="mt-3 text-xs text-gray-500">
                              {entry.author}
                              {entry.createdAt
                                ? `, ${formatSubmissionTimestamp(entry.createdAt)}`
                                : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {submission.status === "submitted" && (
                      <p className="text-sm text-gray-600">Awaiting grade from instructor.</p>
                    )}
                  </>
                ) : canSubmit ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">You have not submitted this assignment yet.</p>
                    <button
                      type="button"
                      onClick={() => setAttemptFormOpen(true)}
                      className="btn-canvas-primary w-full"
                    >
                      Submit Assignment
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No submission yet.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-canvas-grayDark">Submissions</h2>
                <p className="text-sm text-gray-600">
                  {instructorSubmissionCount === 0
                    ? "No student submissions yet."
                    : `${instructorSubmissionCount} submission${instructorSubmissionCount === 1 ? "" : "s"} received.`}
                </p>
                <Link
                  to={`/courses/${effectiveCourseId}/assignments/${assignmentId}/grade`}
                  className="btn-canvas-primary inline-block text-sm"
                >
                  Open GradePro
                </Link>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
