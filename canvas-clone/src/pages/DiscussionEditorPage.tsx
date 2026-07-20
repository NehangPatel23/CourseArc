import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { MessageSquare, Pin, PinOff } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import DateTimeField from "../components/DateTimeField";
import RichContentEditor from "../components/RichContentEditor";
import { useStudentView } from "../hooks/useStudentView";
import { formatAssignmentDueDate } from "../utils/assignments";
import {
  loadReplyCount,
  loadTopics,
  saveTopics,
  type DiscussionTopic,
  uid,
} from "../utils/discussions";

export default function DiscussionEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, topicId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);

  const fromState = (location.state as { from?: string } | null)?.from;
  const backTo = fromState ?? `/courses/${effectiveCourseId}/discussions`;

  // After saving, return to the topic viewer (unless we came from elsewhere,
  // e.g. a module, in which case honor that origin).
  const afterSave = (id: string) =>
    navigate(fromState ?? `/courses/${effectiveCourseId}/discussions/${id}`);

  useEffect(() => {
    if (studentView) navigate(backTo, { replace: true });
  }, [studentView, navigate, backTo]);

  const all = useMemo(() => loadTopics(effectiveCourseId), [effectiveCourseId]);
  const isNew = !topicId || topicId === "new";
  const existing = useMemo(() => {
    if (isNew) return undefined;
    return all.find((t) => t.id === topicId);
  }, [all, topicId, isNew]);

  useEffect(() => {
    if (!studentView && !isNew && !existing) navigate(backTo, { replace: true });
  }, [studentView, isNew, existing, navigate, backTo]);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [pinned, setPinned] = useState(!!existing?.pinned);
  const [publishAt, setPublishAt] = useState<number | undefined>(existing?.publishAt);
  const [availableFrom, setAvailableFrom] = useState<number | undefined>(existing?.availableFrom);
  const [availableUntil, setAvailableUntil] = useState<number | undefined>(existing?.availableUntil);
  const [graded, setGraded] = useState(!!existing?.graded);
  const [points, setPoints] = useState(existing?.points ?? 10);
  const [dueAt, setDueAt] = useState<number | undefined>(existing?.dueAt);
  const [requireInitialPost, setRequireInitialPost] = useState(!!existing?.requireInitialPost);

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setBody(existing?.body ?? "");
    setPinned(!!existing?.pinned);
    setPublishAt(existing?.publishAt);
    setAvailableFrom(existing?.availableFrom);
    setAvailableUntil(existing?.availableUntil);
    setGraded(!!existing?.graded);
    setPoints(existing?.points ?? 10);
    setDueAt(existing?.dueAt);
    setRequireInitialPost(!!existing?.requireInitialPost);
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = title.trim().length > 0;
  const hasWindowError =
    typeof availableFrom === "number" &&
    typeof availableUntil === "number" &&
    availableUntil < availableFrom;
  const isPublished = existing?.published || existing?.status === "published";

  const persist = (next: DiscussionTopic[]) => {
    saveTopics(effectiveCourseId, next);
  };

  const upsertTopic = (topic: DiscussionTopic) => {
    const idx = all.findIndex((t) => t.id === topic.id);
    if (idx >= 0) {
      const next = [...all];
      next[idx] = topic;
      persist(next);
    } else {
      persist([topic, ...all]);
    }
  };

  const buildTopic = (published: boolean, status: "draft" | "published"): DiscussionTopic => {
    const now = Date.now();
    const base: DiscussionTopic = {
      id: existing?.id ?? uid("topic"),
      title: title.trim(),
      body: body.trim() || "<p></p>",
      author: existing?.author ?? "Instructor",
      createdAt: existing?.createdAt ?? now,
      pinned,
      locked: existing?.locked,
      published,
      status,
      publishAt: published ? undefined : publishAt,
      availableFrom,
      availableUntil,
      lastActivityAt: existing?.lastActivityAt ?? now,
    };
    if (graded) {
      base.graded = true;
      base.points = Math.max(0, points);
      base.dueAt = dueAt;
      base.requireInitialPost = requireInitialPost;
    }
    return base;
  };

  const onSaveDraft = () => {
    if (!canSave || hasWindowError) return;
    const topic = buildTopic(false, "draft");
    upsertTopic(topic);
    afterSave(topic.id);
  };

  const onPublish = () => {
    if (!canSave || hasWindowError) return;
    const now = Date.now();
    const shouldSchedule =
      typeof publishAt === "number" && Number.isFinite(publishAt) && publishAt > now;

    const topic = shouldSchedule
      ? { ...buildTopic(false, "draft"), publishAt }
      : buildTopic(true, "published");
    upsertTopic(topic);
    afterSave(topic.id);
  };

  const draftStatus = isPublished ? "Published" : "Draft";
  const replyCount =
    existing?.id ? loadReplyCount(effectiveCourseId, existing.id) : 0;

  const availabilitySummary = (() => {
    if (typeof availableFrom === "number" && typeof availableUntil === "number") {
      return `${formatAssignmentDueDate(availableFrom).replace(" by ", " at ")} – ${formatAssignmentDueDate(availableUntil).replace(" by ", " at ")}`;
    }
    if (typeof availableFrom === "number") {
      return `From ${formatAssignmentDueDate(availableFrom).replace(" by ", " at ")}`;
    }
    if (typeof availableUntil === "number") {
      return `Until ${formatAssignmentDueDate(availableUntil).replace(" by ", " at ")}`;
    }
    return "Always available";
  })();

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8 text-canvas-grayDark">
        <div className="w-full">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-gray-500" />
            <h1 className="text-2xl font-semibold text-canvas-grayDark">
              {isNew ? "New Discussion" : "Edit Discussion"}
            </h1>
            {!isNew && (
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                  isPublished
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {draftStatus}
              </span>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4 rounded-xl border border-canvas-border bg-white p-5 shadow-sm">
            <div>
              <div className="form-label">Title</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Discussion title"
                className="form-input"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="text-sm text-gray-700">Pin this discussion</span>
              <button
                type="button"
                onClick={() => setPinned((v) => !v)}
                className="btn-canvas-secondary inline-flex items-center gap-2 text-sm"
              >
                {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {pinned ? "Unpin" : "Pin"}
              </button>
            </div>

            <RichContentEditor label="First post" value={body} onChange={setBody} height={360} courseId={effectiveCourseId} />

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

            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="form-section-title">Graded discussion</div>
                <button
                  type="button"
                  onClick={() => setGraded((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                    graded ? "bg-canvas-blue" : "bg-gray-300"
                  }`}
                  aria-pressed={graded}
                >
                  <span
                    className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                      graded ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              {graded && (
                <>
                  <div>
                    <div className="form-label">Points</div>
                    <input
                      type="number"
                      min={0}
                      value={points}
                      onChange={(e) => setPoints(Number(e.target.value) || 0)}
                      className="form-input w-32"
                    />
                  </div>
                  <DateTimeField label="Due" value={dueAt} onChange={setDueAt} />
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={requireInitialPost}
                      onChange={(e) => setRequireInitialPost(e.target.checked)}
                    />
                    Require initial post before grading
                  </label>
                </>
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
                      <dd className="font-medium text-canvas-grayDark">{draftStatus}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Type</dt>
                      <dd className="font-medium text-canvas-grayDark">
                        {graded ? "Graded discussion" : "Discussion"}
                      </dd>
                    </div>
                    {pinned && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Pinned</dt>
                        <dd className="font-medium text-canvas-grayDark">Yes</dd>
                      </div>
                    )}
                    {graded && (
                      <>
                        <div className="flex justify-between gap-3">
                          <dt className="text-gray-500">Points</dt>
                          <dd className="font-medium text-canvas-grayDark">{points}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-gray-500">Due</dt>
                          <dd className="font-medium text-canvas-grayDark">
                            {dueAt
                              ? formatAssignmentDueDate(dueAt).replace(" by ", " at ")
                              : "—"}
                          </dd>
                        </div>
                      </>
                    )}
                    {!isNew && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Replies</dt>
                        <dd className="font-medium text-canvas-grayDark">{replyCount}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-gray-500">Availability</dt>
                      <dd className="mt-0.5 text-xs text-canvas-grayDark">{availabilitySummary}</dd>
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
