import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Circle,
  MessageSquare,
  Pencil,
  Trash2,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import BackToModulesButton from "../components/BackToModulesButton";
import RichContentEditor from "../components/RichContentEditor";
import RichContentViewer from "../components/RichContentViewer";
import { getCourseById } from "../utils/coursesStore";
import {
  getStudentNavListPath,
  isCourseNavItemVisibleToStudents,
} from "../utils/courseNavigation";
import { useStudentView } from "../utils/studentView";
import { loadUser } from "../utils/userStore";
import { markTopicRead } from "../utils/discussionReads";
import {
  DISCUSSION_PARTICIPATIONS_CHANGED_EVENT,
  getParticipationForStudent,
  recordDiscussionParticipation,
} from "../utils/discussionParticipations";
import DiscussionSidebar from "../components/DiscussionSidebar";
import {
  addReply,
  buildReplyTree,
  deleteReply,
  isGradedDiscussion,
  isStudentVisibleTopic,
  loadReplies,
  loadTopics,
  resolveReplyAuthorRole,
  saveTopics,
  toggleReplyEndorsed,
  updateReply,
  type DiscussionAuthorRole,
  type ReplyNode,
  type DiscussionTopic,
} from "../utils/discussions";
import { isFromModules } from "../components/BackToModulesButton";

function AuthorRoleBadge({ role }: { role: DiscussionAuthorRole }) {
  const isInstructor = role === "instructor";
  return (
    <span
      className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isInstructor
          ? "bg-canvas-blueTint text-canvas-blue"
          : "bg-violet-100 text-violet-800"
      }`}
    >
      {isInstructor ? "Instructor" : "TA"}
    </span>
  );
}

type ReplyItemProps = {
  node: ReplyNode;
  depth: number;
  courseId: string;
  topicId: string;
  locked: boolean;
  studentView: boolean;
  parentAuthor?: string;
  editingReplyId: string | null;
  editBody: string;
  onEditStart: (replyId: string, body: string) => void;
  onEditCancel: () => void;
  onEditSave: (replyId: string) => void;
  onEditBodyChange: (body: string) => void;
  replyingToId: string | null;
  inlineBody: string;
  onReplyStart: (replyId: string) => void;
  onReplyCancel: () => void;
  onReplyBodyChange: (body: string) => void;
  onReplySubmit: (parentReplyId: string) => void;
  onDelete: (replyId: string) => void;
  onEndorse: (replyId: string) => void;
};

function ReplyItem({
  node,
  depth,
  courseId,
  topicId,
  locked,
  studentView,
  parentAuthor,
  editingReplyId,
  editBody,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditBodyChange,
  replyingToId,
  inlineBody,
  onReplyStart,
  onReplyCancel,
  onReplyBodyChange,
  onReplySubmit,
  onDelete,
  onEndorse,
}: ReplyItemProps) {
  const isEditing = editingReplyId === node.id;
  const isReplying = replyingToId === node.id;
  const authorRole = resolveReplyAuthorRole(node.author, node.authorRole);

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-canvas-border pl-4" : ""}>
      <div
        className={`rounded-lg border p-4 ${node.endorsed ? "border-canvas-blue bg-canvas-blueTint/30" : "border-canvas-border"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-canvas-grayDark">{node.author}</p>
              {authorRole && <AuthorRoleBadge role={authorRole} />}
            </div>
            <p className="text-xs text-gray-500">
              {new Date(node.createdAt).toLocaleString()}
              {node.edited ? " · edited" : ""}
              {node.endorsed ? " · endorsed" : ""}
            </p>
            {parentAuthor && (
              <p className="mt-0.5 text-xs text-gray-500">
                In reply to <span className="font-medium text-canvas-grayDark">{parentAuthor}</span>
              </p>
            )}
          </div>
          <div className="flex gap-1">
            {!locked && (
              <button
                type="button"
                onClick={() => onReplyStart(node.id)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-canvas-blue hover:bg-blue-50"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Reply
              </button>
            )}
            {!studentView && (
              <>
                <button
                  type="button"
                  onClick={() => onEndorse(node.id)}
                  className="rounded p-1 text-canvas-blue hover:bg-blue-50"
                  title="Endorse"
                >
                  <Award className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onEditStart(node.id, node.body)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(node.id)}
                  className="rounded p-1 text-canvas-red hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
        {isEditing ? (
          <div className="mt-2">
            <RichContentEditor
              value={editBody}
              onChange={onEditBodyChange}
              height={140}
              courseId={courseId}
            />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => onEditSave(node.id)} className="btn-canvas-primary text-sm">
                Save
              </button>
              <button type="button" onClick={onEditCancel} className="btn-canvas-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <RichContentViewer html={node.body} courseId={courseId} />
          </div>
        )}
        {isReplying && (
          <div className="mt-3 rounded-lg border border-canvas-border bg-canvas-grayLight/50 p-3">
            <p className="mb-2 text-xs text-gray-600">
              Replying to <span className="font-medium">{node.author}</span>
            </p>
            <RichContentEditor
              value={inlineBody}
              onChange={onReplyBodyChange}
              height={120}
              courseId={courseId}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onReplySubmit(node.id)}
                disabled={!inlineBody.trim()}
                className="btn-canvas-primary text-sm disabled:opacity-50"
              >
                Post reply
              </button>
              <button type="button" onClick={onReplyCancel} className="btn-canvas-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="mt-3 space-y-3">
          {node.children.map((child) => (
            <ReplyItem
              key={child.id}
              node={child}
              depth={depth + 1}
              courseId={courseId}
              topicId={topicId}
              locked={locked}
              studentView={studentView}
              parentAuthor={node.author}
              editingReplyId={editingReplyId}
              editBody={editBody}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onEditBodyChange={onEditBodyChange}
              replyingToId={replyingToId}
              inlineBody={inlineBody}
              onReplyStart={onReplyStart}
              onReplyCancel={onReplyCancel}
              onReplyBodyChange={onReplyBodyChange}
              onReplySubmit={onReplySubmit}
              onDelete={onDelete}
              onEndorse={onEndorse}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DiscussionTopicPage() {
  const { courseId, topicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const effectiveCourseId = courseId ?? "default";
  const { studentView } = useStudentView(effectiveCourseId);
  const user = loadUser();

  const [topic, setTopic] = useState<DiscussionTopic | null>(null);
  const [replies, setReplies] = useState<ReturnType<typeof loadReplies>>([]);
  const [body, setBody] = useState("");
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [inlineBody, setInlineBody] = useState("");
  const [participation, setParticipation] = useState<ReturnType<typeof getParticipationForStudent>>();

  const replyTree = useMemo(() => buildReplyTree(replies), [replies]);

  const course = getCourseById(effectiveCourseId);
  const discussionsBackPath = getStudentNavListPath(
    effectiveCourseId,
    "discussions",
    course,
  );
  const fromModules = isFromModules(
    (location.state as { from?: string } | null)?.from,
  );
  const showDiscussionsListLink =
    !fromModules &&
    (!studentView || isCourseNavItemVisibleToStudents("discussions", course));

  useEffect(() => {
    const topics = loadTopics(effectiveCourseId);
    const t = topics.find((x) => x.id === topicId) ?? null;
    setTopic(t);
    if (t && topicId) {
      setReplies(loadReplies(effectiveCourseId, topicId));
      markTopicRead(effectiveCourseId, topicId, t.lastActivityAt ?? t.createdAt);
    }
  }, [effectiveCourseId, topicId]);

  useEffect(() => {
    const refresh = () => {
      if (!topicId) return;
      setReplies(loadReplies(effectiveCourseId, topicId));
      const t = loadTopics(effectiveCourseId).find((x) => x.id === topicId) ?? null;
      setTopic(t);
      if (studentView) {
        setParticipation(getParticipationForStudent(effectiveCourseId, topicId, user.id));
      }
    };
    window.addEventListener("canvasClone:discussionsChanged", refresh);
    window.addEventListener(DISCUSSION_PARTICIPATIONS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("canvasClone:discussionsChanged", refresh);
      window.removeEventListener(DISCUSSION_PARTICIPATIONS_CHANGED_EVENT, refresh);
    };
  }, [effectiveCourseId, topicId, studentView, user.id]);

  if (!topic) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Discussion not found.</p>
        {showDiscussionsListLink && (
          <Link to={discussionsBackPath} className="text-canvas-blue hover:underline">
            Back to discussions
          </Link>
        )}
      </div>
    );
  }

  if (studentView && !isStudentVisibleTopic(topic)) {
    navigate(discussionsBackPath, { replace: true });
    return null;
  }

  const refreshReplies = () => {
    if (topicId) setReplies(loadReplies(effectiveCourseId, topicId));
  };

  const isPublished = topic.status === "published" || topic.published === true;
  const togglePublish = () => {
    const next = loadTopics(effectiveCourseId).map((t) =>
      t.id === topic.id
        ? {
            ...t,
            status: (isPublished ? "draft" : "published") as "draft" | "published",
            published: !isPublished,
            publishAt: undefined,
          }
        : t,
    );
    saveTopics(effectiveCourseId, next);
  };

  const recordParticipationIfGraded = () => {
    if (!studentView || !topicId || !topic || !isGradedDiscussion(topic)) return;
    recordDiscussionParticipation(effectiveCourseId, topicId, user.id, user.name);
    setParticipation(getParticipationForStudent(effectiveCourseId, topicId, user.id));
  };

  const handleTopLevelReply = () => {
    if (!body.trim() || topic.locked || !topicId) return;
    const authorRole = !studentView ? ("instructor" as const) : undefined;
    addReply(effectiveCourseId, topicId, user.name, body.trim(), undefined, authorRole);
    setBody("");
    refreshReplies();
    markTopicRead(effectiveCourseId, topicId);
    recordParticipationIfGraded();
  };

  const handleInlineReply = (parentReplyId: string) => {
    if (!inlineBody.trim() || topic.locked || !topicId) return;
    const authorRole = !studentView ? ("instructor" as const) : undefined;
    addReply(
      effectiveCourseId,
      topicId,
      user.name,
      inlineBody.trim(),
      parentReplyId,
      authorRole,
    );
    setInlineBody("");
    setReplyingToId(null);
    refreshReplies();
    markTopicRead(effectiveCourseId, topicId);
    recordParticipationIfGraded();
  };

  const saveEdit = (replyId: string) => {
    if (!editBody.trim()) return;
    updateReply(effectiveCourseId, replyId, { body: editBody.trim() });
    setEditingReplyId(null);
    refreshReplies();
  };

  const startReply = (replyId: string) => {
    setReplyingToId(replyId);
    setInlineBody("");
    setEditingReplyId(null);
  };

  const cancelReply = () => {
    setReplyingToId(null);
    setInlineBody("");
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-10 lg:px-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
          <BackToModulesButton courseId={effectiveCourseId} />
          {showDiscussionsListLink && (
            <Link
              to={discussionsBackPath}
              className="mb-4 inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              All discussions
            </Link>
          )}

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-canvas-grayDark">{topic.title}</h1>
                {!studentView && !isPublished && (
                  <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Unpublished
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {topic.author} · {new Date(topic.createdAt).toLocaleString()}
                {topic.locked ? " · Locked" : ""}
              </p>
            </div>
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
                  to={`/courses/${effectiveCourseId}/discussions/${topicId}/edit`}
                  className="btn-canvas-secondary inline-flex items-center gap-1 text-sm"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-canvas-border bg-white p-5 shadow-sm">
            <RichContentViewer html={topic.body} courseId={effectiveCourseId} />
          </div>

          <h2 className="mb-3 mt-8 text-lg font-semibold text-canvas-grayDark">Replies</h2>
          <div className="space-y-3">
            {replyTree.length === 0 ? (
              <p className="text-sm text-gray-500">No replies yet.</p>
            ) : (
              replyTree.map((node) => (
                <ReplyItem
                  key={node.id}
                  node={node}
                  depth={0}
                  courseId={effectiveCourseId}
                  topicId={topicId!}
                  locked={!!topic.locked}
                  studentView={studentView}
                  editingReplyId={editingReplyId}
                  editBody={editBody}
                  onEditStart={(id, b) => {
                    setEditingReplyId(id);
                    setEditBody(b);
                    cancelReply();
                  }}
                  onEditCancel={() => setEditingReplyId(null)}
                  onEditSave={saveEdit}
                  onEditBodyChange={setEditBody}
                  replyingToId={replyingToId}
                  inlineBody={inlineBody}
                  onReplyStart={startReply}
                  onReplyCancel={cancelReply}
                  onReplyBodyChange={setInlineBody}
                  onReplySubmit={handleInlineReply}
                  onDelete={(id) => {
                    deleteReply(effectiveCourseId, id);
                    refreshReplies();
                  }}
                  onEndorse={(id) => toggleReplyEndorsed(effectiveCourseId, id)}
                />
              ))
            )}
          </div>

          {!topic.locked && (
            <div className="mt-6">
              <RichContentEditor
                value={body}
                onChange={setBody}
                height={140}
                label="Write a reply"
                courseId={effectiveCourseId}
              />
              <button
                type="button"
                onClick={handleTopLevelReply}
                disabled={!body.trim()}
                className="btn-canvas-primary mt-2 disabled:opacity-50"
              >
                Post reply
              </button>
            </div>
          )}
          </div>

          <DiscussionSidebar
            courseId={effectiveCourseId}
            topicId={topicId!}
            topic={topic}
            studentView={studentView}
            participation={participation}
          />
        </div>
      </div>
    </div>
  );
}
