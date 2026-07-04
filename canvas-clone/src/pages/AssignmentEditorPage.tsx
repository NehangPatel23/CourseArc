import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import DateTimeField from "../components/DateTimeField";
import RichContentEditor from "../components/RichContentEditor";
import { useStudentView } from "../hooks/useStudentView";
import {
  loadAssignments,
  saveAssignments,
  type Assignment,
  type AssignmentSubmissionType,
  uid,
} from "../utils/assignments";
import { getCourseAssignmentDefaults, getCourseById } from "../utils/coursesStore";

export default function AssignmentEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, assignmentId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);

  const fromState = (location.state as { from?: string } | null)?.from;
  const backTo = fromState ?? `/courses/${effectiveCourseId}/assignments`;

  // After saving, return to the item's viewer (unless we came from elsewhere,
  // e.g. a module, in which case honor that origin).
  const afterSave = (id: string) =>
    navigate(fromState ?? `/courses/${effectiveCourseId}/assignments/${id}`);

  useEffect(() => {
    if (studentView) navigate(backTo, { replace: true });
  }, [studentView, navigate, backTo]);

  const all = useMemo(() => loadAssignments(effectiveCourseId), [effectiveCourseId]);
  const courseDefaults = useMemo(
    () => getCourseAssignmentDefaults(getCourseById(effectiveCourseId)),
    [effectiveCourseId],
  );
  const isNew = !assignmentId || assignmentId === "new";
  const existing = useMemo(() => {
    if (isNew) return undefined;
    return all.find((a) => a.id === assignmentId);
  }, [all, assignmentId, isNew]);

  useEffect(() => {
    if (!studentView && !isNew && !existing) navigate(backTo, { replace: true });
  }, [studentView, isNew, existing, navigate, backTo]);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [dueAt, setDueAt] = useState<number | undefined>(existing?.dueAt);
  const [points, setPoints] = useState(existing?.points?.toString() ?? "");
  const [publishAt, setPublishAt] = useState<number | undefined>(existing?.publishAt);
  const [availableFrom, setAvailableFrom] = useState<number | undefined>(existing?.availableFrom);
  const [availableUntil, setAvailableUntil] = useState<number | undefined>(existing?.availableUntil);
  const [submissionType, setSubmissionType] = useState<AssignmentSubmissionType>(
    existing?.submissionType ?? courseDefaults.submissionType,
  );
  const [allowLate, setAllowLate] = useState(
    existing?.allowLateSubmissions ?? courseDefaults.allowLateSubmissions,
  );
  const [allowResubmit, setAllowResubmissions] = useState(
    existing?.allowResubmissions ?? courseDefaults.allowResubmissions,
  );

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setDueAt(existing?.dueAt);
    setPoints(existing?.points?.toString() ?? "");
    setPublishAt(existing?.publishAt);
    setAvailableFrom(existing?.availableFrom);
    setAvailableUntil(existing?.availableUntil);
    setSubmissionType(existing?.submissionType ?? courseDefaults.submissionType);
    setAllowLate(existing?.allowLateSubmissions ?? courseDefaults.allowLateSubmissions);
    setAllowResubmissions(existing?.allowResubmissions ?? courseDefaults.allowResubmissions);
  }, [existing?.id, courseDefaults]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = title.trim().length > 0;
  const hasWindowError =
    typeof availableFrom === "number" &&
    typeof availableUntil === "number" &&
    availableUntil < availableFrom;
  const isPublished = existing?.status === "published";

  const upsert = (patch: Partial<Assignment> & Pick<Assignment, "id">) => {
    const next = [...all];
    const idx = next.findIndex((x) => x.id === patch.id);
    const now = Date.now();
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...patch, updatedAt: now };
    } else {
      next.unshift({
        id: patch.id,
        title: patch.title ?? "",
        description: patch.description,
        dueAt: patch.dueAt,
        points: patch.points,
        status: patch.status ?? "draft",
        published: patch.published ?? false,
        publishAt: patch.publishAt,
        availableFrom: patch.availableFrom,
        availableUntil: patch.availableUntil,
        submissionType: patch.submissionType ?? "online_text",
        allowLateSubmissions: patch.allowLateSubmissions,
        allowResubmissions: patch.allowResubmissions,
        createdAt: now,
        updatedAt: now,
      });
    }
    saveAssignments(effectiveCourseId, next);
  };

  const buildPatch = (status: "draft" | "published", published: boolean): Partial<Assignment> => ({
    title: title.trim(),
    description: description.trim() || undefined,
    dueAt,
    points: points ? Number(points) : undefined,
    status,
    published,
    publishAt: status === "draft" ? publishAt : undefined,
    availableFrom,
    availableUntil,
    submissionType,
    allowLateSubmissions: allowLate,
    allowResubmissions: allowResubmit,
  });

  const onSaveDraft = () => {
    if (!canSave || hasWindowError) return;
    const id = isNew ? uid("asg") : existing?.id;
    if (isNew) {
      upsert({ id: id as string, ...buildPatch("draft", false) });
    } else if (existing) {
      upsert({ id: existing.id, ...buildPatch("draft", false) });
    }
    if (id) afterSave(id);
    else navigate(backTo);
  };

  const onPublish = () => {
    if (!canSave || hasWindowError) return;
    const now = Date.now();
    const shouldSchedule =
      typeof publishAt === "number" && Number.isFinite(publishAt) && publishAt > now;

    if (isNew) {
      const id = uid("asg");
      if (shouldSchedule) {
        upsert({ id, ...buildPatch("draft", false), publishAt });
      } else {
        upsert({ id, ...buildPatch("published", true), publishAt: undefined });
      }
      afterSave(id);
      return;
    }

    if (!existing) return navigate(backTo);

    if (shouldSchedule) {
      upsert({ id: existing.id, ...buildPatch("draft", false), publishAt });
    } else {
      upsert({ id: existing.id, ...buildPatch("published", true), publishAt: undefined });
    }
    afterSave(existing.id);
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8 text-canvas-grayDark">
        <div className="w-full">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-gray-500" />
            <h1 className="text-2xl font-semibold text-canvas-grayDark">
              {isNew ? "New Assignment" : "Edit Assignment"}
            </h1>
            <span
              className={[
                "ml-2 rounded-full border px-2 py-0.5 text-xs font-medium",
                isPublished
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-gray-200 bg-gray-50 text-gray-700",
              ].join(" ")}
            >
              {isPublished ? "Published" : "Draft"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4 rounded-xl border border-canvas-border bg-white p-5 shadow-sm">
            <div>
              <div className="form-label">Title</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Assignment title"
                className="form-input"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DateTimeField label="Due date" value={dueAt} onChange={setDueAt} />
              <div>
                <div className="form-label">Points</div>
                <input
                  type="number"
                  min={0}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="100"
                  className="form-input h-10"
                />
              </div>
            </div>

            <RichContentEditor
              label="Description"
              value={existing?.description ?? ""}
              onChange={setDescription}
              height={360}
              courseId={effectiveCourseId}
              mountKey={assignmentId ?? "new-assignment"}
            />

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="form-section-title">Submission settings</div>
              <select
                value={submissionType}
                onChange={(e) => setSubmissionType(e.target.value as AssignmentSubmissionType)}
                className="form-input mt-2"
              >
                <option value="online_text">Online text entry</option>
                <option value="online_upload">File upload</option>
                <option value="online_text_upload">Text or file upload</option>
                <option value="none">No submission</option>
              </select>
              <label className="form-checkbox-label mt-3">
                <input type="checkbox" checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} />
                Allow late submissions
              </label>
              <label className="form-checkbox-label mt-2">
                <input type="checkbox" checked={allowResubmit} onChange={(e) => setAllowResubmissions(e.target.checked)} />
                Allow resubmissions
              </label>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="form-section-title">Publishing & availability</div>
              <DateTimeField
                label="Publish later"
                value={publishAt}
                onChange={setPublishAt}
                disabled={isPublished}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DateTimeField label="Available from" value={availableFrom} onChange={setAvailableFrom} />
                <DateTimeField label="Available until" value={availableUntil} onChange={setAvailableUntil} />
              </div>
              {hasWindowError && (
                <p className="text-sm text-red-600">Available until must be after available from.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
              <button type="button" onClick={() => navigate(backTo)} className="btn-canvas-secondary">
                Cancel
              </button>
              <button type="button" disabled={!canSave} onClick={onSaveDraft} className="btn-canvas-secondary">
                {!isNew && isPublished ? "Unpublish" : "Save draft"}
              </button>
              <button type="button" disabled={!canSave || hasWindowError} onClick={onPublish} className="btn-canvas-primary">
                {typeof publishAt === "number" && publishAt > Date.now() ? "Schedule" : isPublished ? "Update" : "Publish"}
              </button>
            </div>
            </div>

            <aside className="lg:pt-1">
              <div className="space-y-4 lg:sticky lg:top-4">
                <div className="rounded-xl border border-canvas-border bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-canvas-grayDark">Summary</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Status</dt>
                      <dd className="font-medium text-canvas-grayDark">
                        {isPublished ? "Published" : "Draft"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Points</dt>
                      <dd className="font-medium text-canvas-grayDark">{points || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Submission</dt>
                      <dd className="font-medium text-canvas-grayDark">
                        {submissionType === "online_text"
                          ? "Online text"
                          : submissionType === "online_upload"
                            ? "File upload"
                            : submissionType === "online_text_upload"
                              ? "Text or file"
                              : "No submission"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Late</dt>
                      <dd className="font-medium text-canvas-grayDark">
                        {allowLate ? "Allowed" : "Not allowed"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
