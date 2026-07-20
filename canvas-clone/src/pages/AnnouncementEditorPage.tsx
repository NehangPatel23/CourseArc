// src/pages/AnnouncementEditorPage.tsx
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  loadAnnouncements,
  saveAnnouncements,
  type Announcement,
  type AnnouncementStatus,
} from "../utils/announcements";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CourseHeader from "../components/CourseHeader";
import RichContentEditor from "../components/RichContentEditor";
import { Megaphone, Pin, PinOff } from "lucide-react";
import { useStudentView } from "../hooks/useStudentView";
import DateTimeField from "../components/DateTimeField";

function safeUUID(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

export default function AnnouncementEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, announcementId } = useParams();
  const effectiveCourseId = courseId ?? "default";

  const studentView = useStudentView(effectiveCourseId);

  const fromState = (location.state as any)?.from as string | undefined;
  const backTo = fromState ?? `/courses/${effectiveCourseId}/announcements`;

  // After saving, return to the announcement's viewer (unless we came from
  // elsewhere, e.g. a module, in which case honor that origin).
  const afterSave = (id: string) =>
    navigate(fromState ?? `/courses/${effectiveCourseId}/announcements/${id}`);

  // Hard block: students cannot access editor routes
  useEffect(() => {
    if (studentView) navigate(backTo, { replace: true });
  }, [studentView, navigate, backTo]);

  const all = useMemo(
    () => loadAnnouncements(effectiveCourseId),
    [effectiveCourseId],
  );

  const isNew = announcementId === undefined || announcementId === "new";

  const existing = useMemo(() => {
    if (isNew) return undefined;
    return all.find((a) => a.id === announcementId);
  }, [all, announcementId, isNew]);

  // If someone tries to edit a non-existent id, bounce back
  useEffect(() => {
    if (!studentView && !isNew && !existing)
      navigate(backTo, { replace: true });
  }, [studentView, isNew, existing, navigate, backTo]);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.body ?? "");
  const [pinned, setPinned] = useState<boolean>(!!existing?.pinned);

  // Scheduling / availability UI state (epoch ms)
  const [publishAt, setPublishAt] = useState<number | undefined>(
    existing?.publishAt,
  );
  const [availableFrom, setAvailableFrom] = useState<number | undefined>(
    existing?.availableFrom,
  );
  const [availableUntil, setAvailableUntil] = useState<number | undefined>(
    existing?.availableUntil,
  );

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setContent(existing?.body ?? "");
    setPinned(!!existing?.pinned);
    setPublishAt(existing?.publishAt);
    setAvailableFrom(existing?.availableFrom);
    setAvailableUntil(existing?.availableUntil);
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = title.trim().length > 0;

  const publishAtMs = publishAt;
  const availableFromMs = availableFrom;
  const availableUntilMs = availableUntil;

  const hasWindowError =
    typeof availableFromMs === "number" &&
    typeof availableUntilMs === "number" &&
    Number.isFinite(availableFromMs) &&
    Number.isFinite(availableUntilMs) &&
    availableUntilMs < availableFromMs;

  const upsert = (patch: Partial<Announcement> & Pick<Announcement, "id">) => {
    const nextAll = [...all];
    const idx = nextAll.findIndex((x) => x.id === patch.id);

    if (idx >= 0) {
      nextAll[idx] = { ...nextAll[idx], ...patch };
    } else {
      const created: Announcement = {
        id: patch.id,
        title: patch.title ?? "",
        body: patch.body,
        postedAt: patch.postedAt ?? Date.now(),
        publishedAt: patch.publishedAt,
        status: (patch.status as AnnouncementStatus) ?? "draft",
        pinned: patch.pinned,
        publishAt: patch.publishAt,
        availableFrom: patch.availableFrom,
        availableUntil: patch.availableUntil,
      };
      nextAll.unshift(created);
    }

    saveAnnouncements(effectiveCourseId, nextAll);
  };

  const htmlBody = content.trim().length > 0 ? content : undefined;

  const onSaveDraft = () => {
    const t = title.trim();
    if (!t) return;

    // ✅ don’t allow invalid windows to be saved
    if (hasWindowError) return;

    if (isNew) {
      const id = safeUUID("n");
      upsert({
        id,
        title: t,
        body: htmlBody,
        postedAt: Date.now(),
        status: "draft",
        publishedAt: undefined,
        pinned,
        publishAt: publishAtMs,
        availableFrom: availableFromMs,
        availableUntil: availableUntilMs,
      });
      afterSave(id);
      return;
    }

    if (!existing) return navigate(backTo);

    upsert({
      id: existing.id,
      title: t,
      body: htmlBody,
      status: "draft",
      publishedAt: undefined,
      pinned,
      publishAt: publishAtMs,
      availableFrom: availableFromMs,
      availableUntil: availableUntilMs,
    });

    afterSave(existing.id);
  };

  const onPublish = () => {
    const t = title.trim();
    if (!t) return;
    if (hasWindowError) return;

    const now = Date.now();

    // If publishAt is in the future, we keep as draft + set publishAt
    const shouldSchedule =
      typeof publishAtMs === "number" &&
      Number.isFinite(publishAtMs) &&
      publishAtMs > now;

    if (isNew) {
      const id = safeUUID("n");

      if (shouldSchedule) {
        upsert({
          id,
          title: t,
          body: htmlBody,
          postedAt: now,
          status: "draft",
          publishedAt: undefined,
          pinned,
          publishAt: publishAtMs,
          availableFrom: availableFromMs,
          availableUntil: availableUntilMs,
        });
        afterSave(id);
        return;
      }

      upsert({
        id,
        title: t,
        body: htmlBody,
        postedAt: now,
        status: "published",
        publishedAt: now,
        pinned,
        publishAt: undefined,
        availableFrom: availableFromMs,
        availableUntil: availableUntilMs,
      });
      afterSave(id);
      return;
    }

    if (!existing) return navigate(backTo);

    if (shouldSchedule) {
      upsert({
        id: existing.id,
        title: t,
        body: htmlBody,
        status: "draft",
        publishedAt: undefined,
        pinned,
        publishAt: publishAtMs,
        availableFrom: availableFromMs,
        availableUntil: availableUntilMs,
      });
      afterSave(existing.id);
      return;
    }

    const publishTime = existing.publishedAt ?? now;

    upsert({
      id: existing.id,
      title: t,
      body: htmlBody,
      status: "published",
      publishedAt: publishTime,
      pinned,
      publishAt: undefined,
      availableFrom: availableFromMs,
      availableUntil: availableUntilMs,
    });

    afterSave(existing.id);
  };

  const currentStatus: AnnouncementStatus = existing?.status ?? "draft";
  const isPublished = currentStatus === "published";

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight h-full">
      <CourseHeader />

      <div className="flex-1 px-16 py-10 overflow-y-auto bg-white">
        <div className="w-full">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-gray-500" />
                <h1 className="text-2xl font-semibold text-canvas-grayDark">
                  {isNew ? "New Announcement" : "Edit Announcement"}
                </h1>

                <span
                  className={[
                    "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
                    isPublished
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-700 border-gray-200",
                  ].join(" ")}
                >
                  {isPublished ? "Published" : "Draft"}
                </span>
              </div>

              <p className="text-sm text-gray-600 mt-1">
                Save as draft, or publish when ready.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 space-y-4">
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">
                  Title
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcement title"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-canvas-grayDark focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {/* Pin toggle */}
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-sm text-gray-700">
                  Pin this announcement (stays on top + shows on Home)
                </div>
                <button
                  type="button"
                  onClick={() => setPinned((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700"
                >
                  {pinned ? (
                    <>
                      <PinOff className="h-4 w-4" />
                      Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="h-4 w-4" />
                      Pin
                    </>
                  )}
                </button>
              </div>

              {/* Scheduling / availability */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                <div className="text-sm font-semibold text-canvas-grayDark">
                  Publishing & availability
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <DateTimeField
                      label="Send later (optional)"
                      value={publishAt}
                      onChange={setPublishAt}
                      disabled={isPublished}
                      description={
                        isPublished
                          ? "Already published — scheduling is disabled."
                          : "If set in the future, clicking Publish will schedule instead."
                      }
                    />
                  </div>

                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DateTimeField
                      label="Available from (optional)"
                      value={availableFrom}
                      onChange={setAvailableFrom}
                    />

                    <DateTimeField
                      label="Available until (optional)"
                      value={availableUntil}
                      onChange={setAvailableUntil}
                    />
                  </div>
                </div>

                {hasWindowError && (
                  <div className="text-sm text-red-600">
                    “Available until” must be after “Available from”.
                  </div>
                )}

                <div className="text-[11px] text-gray-500">
                  All times use your local timezone.
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">
                  Body
                </div>

                <RichContentEditor
                  value={existing?.body ?? ""}
                  onChange={setContent}
                  height={360}
                  courseId={effectiveCourseId}
                  mountKey={existing?.id ?? "new-announcement"}
                />

                <p className="mt-2 text-xs text-gray-500">
                  Double-click an equation to edit it. Right-click also provides{" "}
                  <strong>Edit equation</strong>.
                </p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
              <button
                type="button"
                onClick={() => navigate(backTo)}
                className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!canSave}
                onClick={onSaveDraft}
                className={[
                  "px-3 py-2 text-sm font-medium rounded-md border",
                  canSave
                    ? "border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                    : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed",
                ].join(" ")}
              >
                Save Draft
              </button>

              <button
                type="button"
                disabled={!canSave}
                onClick={onPublish}
                className={[
                  "px-3 py-2 text-sm font-medium rounded-md text-white",
                  canSave
                    ? "bg-canvas-blue hover:bg-canvas-blueDark"
                    : "bg-gray-300 cursor-not-allowed",
                ].join(" ")}
              >
                {isPublished
                  ? "Update"
                  : typeof publishAtMs === "number" &&
                      Number.isFinite(publishAtMs) &&
                      publishAtMs > Date.now()
                    ? "Schedule"
                    : "Publish"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
