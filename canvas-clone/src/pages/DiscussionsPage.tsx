import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  EyeOff,
  Lock,
  LockOpen,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import GradeIconLink from "../components/GradeIconLink";
import PageIdentityHeader from "../components/PageIdentityHeader";
import Tooltip from "../components/ui/Tooltip";
import { useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";
import { htmlPreview } from "../utils/htmlPreview";
import { countUnreadTopics, isTopicUnread } from "../utils/discussionReads";
import {
  autoPublishTopic,
  deleteTopic,
  isStudentVisibleTopic,
  isGradedDiscussion,
  loadReplyCount,
  loadTopics,
  saveTopics,
  type DiscussionTopic,
} from "../utils/discussions";
import { getPendingDiscussionCount } from "../utils/gradingCounts";
import { DISCUSSION_PARTICIPATIONS_CHANGED_EVENT } from "../utils/discussionParticipations";
import { getStudentSubmissionStatus } from "../utils/studentSubmissionStatus";
import SubmissionStatusBadge from "../components/SubmissionStatusBadge";
import { loadUser } from "../utils/userStore";
import {
  applyEffectiveDates,
  DUE_DATE_OVERRIDES_CHANGED_EVENT,
  hasDueDateOverrides,
} from "../utils/dueDateOverrides";
import { formatAssignmentDueDate } from "../utils/assignments";

export default function DiscussionsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const { studentView } = useStudentView(effectiveCourseId);
  const { canEditCourseContent: canEdit } = usePermissions();

  const [topics, setTopics] = useState<DiscussionTopic[]>(() =>
    loadTopics(effectiveCourseId).map(autoPublishTopic),
  );
  const [search, setSearch] = useState("");
  const [, setGradeRefresh] = useState(0);

  useEffect(() => {
    const bump = () => setGradeRefresh((n) => n + 1);
    window.addEventListener(DISCUSSION_PARTICIPATIONS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(DISCUSSION_PARTICIPATIONS_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    const refresh = () => {
      const all = loadTopics(effectiveCourseId).map(autoPublishTopic);
      const raw = loadTopics(effectiveCourseId);
      if (all.some((t, i) => t.published !== raw[i]?.published)) {
        saveTopics(effectiveCourseId, all);
      }
      setTopics(all);
    };
    refresh();
    window.addEventListener("canvasClone:discussionsChanged", refresh);
    window.addEventListener("canvasClone:discussionReadsChanged", refresh);
    window.addEventListener(DUE_DATE_OVERRIDES_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("canvasClone:discussionsChanged", refresh);
      window.removeEventListener("canvasClone:discussionReadsChanged", refresh);
      window.removeEventListener(DUE_DATE_OVERRIDES_CHANGED_EVENT, refresh);
    };
  }, [effectiveCourseId]);

  const visible = useMemo(() => {
    let list = studentView ? topics.filter(isStudentVisibleTopic) : topics;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          htmlPreview(t.body).text.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.lastActivityAt ?? b.createdAt) - (a.lastActivityAt ?? a.createdAt);
    });
  }, [topics, studentView, search]);

  const published = visible.filter((t) => t.published || t.status === "published");
  const drafts = studentView ? [] : visible.filter((t) => !t.published && t.status !== "published");
  const unreadCount = studentView ? countUnreadTopics(effectiveCourseId, published) : 0;

  const togglePin = (id: string) => {
    const next = topics.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t));
    saveTopics(effectiveCourseId, next);
    setTopics(next);
  };

  const toggleLock = (id: string) => {
    const next = topics.map((t) => (t.id === id ? { ...t, locked: !t.locked } : t));
    saveTopics(effectiveCourseId, next);
    setTopics(next);
  };

  const publishTopic = (id: string) => {
    const next = topics.map((t) =>
      t.id === id
        ? { ...t, status: "published" as const, published: true, publishAt: undefined }
        : t,
    );
    saveTopics(effectiveCourseId, next);
    setTopics(next);
  };

  const unpublishTopic = (id: string) => {
    const next = topics.map((t) =>
      t.id === id
        ? { ...t, status: "draft" as const, published: false, publishAt: undefined }
        : t,
    );
    saveTopics(effectiveCourseId, next);
    setTopics(next);
  };

  const TopicRow = ({ t }: { t: DiscussionTopic }) => {
    const studentId = loadUser().id;
    const dated = studentView
      ? applyEffectiveDates(effectiveCourseId, "discussion", t, studentId)
      : t;
    const preview = htmlPreview(t.body);
    const unread = studentView && isTopicUnread(effectiveCourseId, t.id, t.lastActivityAt);
    const isDraft = !t.published && t.status !== "published";
    const dueAt = dated.dueAt;
    const multipleDates =
      !studentView && isGradedDiscussion(t) && hasDueDateOverrides(effectiveCourseId, "discussion", t.id);
    return (
      <div className="flex items-start justify-between gap-4 border-b border-canvas-border px-5 py-4 last:border-0">
        <Link
          to={`/courses/${effectiveCourseId}/discussions/${t.id}`}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            {t.pinned && <Pin className="h-3.5 w-3.5 text-canvas-blue" />}
            {t.locked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
            <span className={`text-sm font-semibold ${unread ? "text-canvas-blue" : "text-canvas-grayDark"}`}>
              {t.title}
              {unread && <span className="ml-2 text-xs font-normal">(unread)</span>}
            </span>
            {studentView && isGradedDiscussion(t) && (
              <SubmissionStatusBadge
                status={getStudentSubmissionStatus(
                  effectiveCourseId,
                  {
                    id: `discussion:${t.id}`,
                    title: t.title,
                    kind: "discussion",
                    points: t.points ?? 0,
                    gradePath: "",
                    viewerPath: "",
                  },
                  loadUser().id,
                )}
              />
            )}
            {isGradedDiscussion(t) && typeof t.points === "number" && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                {t.points} pts
              </span>
            )}
          </div>
          {preview.text && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{preview.text}</p>}
          <p className="mt-1 text-xs text-gray-500">
            {t.author} · {new Date(t.createdAt).toLocaleDateString()} ·{" "}
            {loadReplyCount(effectiveCourseId, t.id)} replies
            {isGradedDiscussion(t) && dueAt
              ? ` · Due ${formatAssignmentDueDate(dueAt).replace(" by ", " at ")}`
              : isGradedDiscussion(t)
                ? " · No due date"
                : ""}
            {multipleDates ? " · Multiple dates" : ""}
          </p>
        </Link>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            {isDraft ? (
              <Tooltip label="Publish">
                <button
                  type="button"
                  onClick={() => publishTopic(t.id)}
                  aria-label="Publish discussion"
                  className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </Tooltip>
            ) : (
              <Tooltip label="Unpublish">
                <button
                  type="button"
                  onClick={() => unpublishTopic(t.id)}
                  aria-label="Unpublish discussion"
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip label="Edit">
              <Link
                to={`/courses/${effectiveCourseId}/discussions/${t.id}/edit`}
                aria-label="Edit discussion"
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </Tooltip>
            {isGradedDiscussion(t) && (
              <Tooltip label="Grade">
                <GradeIconLink
                  to={`/courses/${effectiveCourseId}/discussions/${t.id}/grade`}
                  pendingCount={getPendingDiscussionCount(effectiveCourseId, t.id)}
                  label="Grade discussion"
                />
              </Tooltip>
            )}
            <Tooltip label={t.pinned ? "Unpin" : "Pin"}>
              <button
                type="button"
                onClick={() => togglePin(t.id)}
                aria-label={t.pinned ? "Unpin discussion" : "Pin discussion"}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
              >
                {t.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
            </Tooltip>
            <Tooltip label={t.locked ? "Unlock" : "Lock"}>
              <button
                type="button"
                onClick={() => toggleLock(t.id)}
                aria-label={t.locked ? "Unlock discussion" : "Lock discussion"}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
              >
                {t.locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </button>
            </Tooltip>
            <Tooltip label="Delete">
              <button
                type="button"
                onClick={() => {
                  deleteTopic(effectiveCourseId, t.id);
                  setTopics(loadTopics(effectiveCourseId));
                }}
                aria-label="Delete discussion"
                className="rounded p-1.5 text-canvas-red hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="w-full">
          <PageIdentityHeader
            size="md"
            icon={MessageSquare}
            label="Discussions"
            title="Discussions"
            badge={
              unreadCount > 0 ? (
                <span className="rounded-full bg-canvas-blue px-2 py-0.5 text-xs text-white">
                  {unreadCount} unread
                </span>
              ) : undefined
            }
            description={
              studentView ? "Participate in course discussions." : "Manage discussion topics."
            }
            actions={
              canEdit ? (
                <button
                  type="button"
                  onClick={() => navigate(`/courses/${effectiveCourseId}/discussions/new`)}
                  className="btn-canvas-primary inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Discussion
                </button>
              ) : undefined
            }
          />

          <div className="relative mt-6 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search discussions…"
              className="w-full rounded-lg border border-canvas-border py-2 pl-9 pr-3 text-sm"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-canvas-border bg-white shadow-sm">
            <div className="border-b border-canvas-border px-5 py-3 text-sm font-semibold text-canvas-grayDark">
              Topics
            </div>
            {published.length === 0 ? (
              <div className="px-5 py-8 text-sm text-gray-600">No discussions yet.</div>
            ) : (
              published.map((t) => <TopicRow key={t.id} t={t} />)
            )}
          </div>

          {drafts.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-xl border border-canvas-border bg-white shadow-sm">
              <div className="border-b border-canvas-border px-5 py-3 text-sm font-semibold text-canvas-grayMuted">
                Drafts
              </div>
              {drafts.map((t) => (
                <TopicRow key={t.id} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
