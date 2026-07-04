import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { MessageSquare, Pin, PinOff } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import DateTimeField from "../components/DateTimeField";
import RichContentEditor from "../components/RichContentEditor";
import { useStudentView } from "../hooks/useStudentView";
import {
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

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setBody(existing?.body ?? "");
    setPinned(!!existing?.pinned);
    setPublishAt(existing?.publishAt);
    setAvailableFrom(existing?.availableFrom);
    setAvailableUntil(existing?.availableUntil);
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
    return {
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

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-16 py-10 text-canvas-grayDark">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-gray-500" />
            <h1 className="text-2xl font-semibold text-canvas-grayDark">
              {isNew ? "New Discussion" : "Edit Discussion"}
            </h1>
          </div>

          <div className="mt-6 space-y-4 rounded-xl border border-canvas-border bg-white p-5 shadow-sm">
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
        </div>
      </div>
    </div>
  );
}
