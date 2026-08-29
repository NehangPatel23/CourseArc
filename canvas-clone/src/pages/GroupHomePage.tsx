import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FileText,
  Home,
  Megaphone,
  MessageSquare,
  Paperclip,
  Trash2,
  Users,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import PageIdentityHeader from "../components/PageIdentityHeader";
import UserAvatar from "../components/UserAvatar";
import { useToast } from "../components/ui/Toast";
import { usePermissions } from "../utils/permissions";
import { getCourseById } from "../utils/coursesStore";
import { loadRoster } from "../utils/courseRoster";
import {
  canAccessGroupHomepage,
  findGroupInCourse,
  GROUP_SETS_CHANGED_EVENT,
  updateGroup,
} from "../utils/groupSets";
import {
  addGroupAnnouncement,
  addGroupFile,
  addGroupPost,
  deleteGroupAnnouncement,
  deleteGroupFile,
  fileToGroupFile,
  GROUP_SPACE_CHANGED_EVENT,
  loadGroupSpace,
  type GroupPost,
} from "../utils/groupSpaces";
import { loadUser } from "../utils/userStore";

type Tab = "home" | "discussions" | "files" | "people";

export default function GroupHomePage() {
  const { courseId, groupId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const gid = groupId ?? "";
  const course = courseId ? getCourseById(courseId) : null;
  const { canEditCourseContent: isStaff } = usePermissions();
  const { showToast } = useToast();
  const me = loadUser();

  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>("home");
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [postBody, setPostBody] = useState("");

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener(GROUP_SETS_CHANGED_EVENT, refresh);
    window.addEventListener(GROUP_SPACE_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(GROUP_SETS_CHANGED_EVENT, refresh);
      window.removeEventListener(GROUP_SPACE_CHANGED_EVENT, refresh);
    };
  }, []);

  const found = useMemo(
    () => (gid ? findGroupInCourse(effectiveCourseId, gid) : undefined),
    [effectiveCourseId, gid, tick],
  );
  const space = useMemo(
    () => (gid ? loadGroupSpace(effectiveCourseId, gid) : { announcements: [], posts: [], files: [] }),
    [effectiveCourseId, gid, tick],
  );
  const roster = useMemo(() => loadRoster(effectiveCourseId), [effectiveCourseId, tick]);
  const allowed = gid ? canAccessGroupHomepage(effectiveCourseId, gid, me.id, isStaff) : false;

  if (!course || !found) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Group not found.</p>
        <Link to={`/courses/${effectiveCourseId}/people/groups`} className="text-canvas-blue hover:underline">
          Back to groups
        </Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex h-full w-full flex-col bg-canvas-grayLight">
        <CourseHeader />
        <div className="flex-1 bg-white px-8 py-8">
          <p className="text-sm text-gray-600">You are not a member of this group.</p>
          <Link
            to={`/courses/${effectiveCourseId}/people/groups`}
            className="mt-3 inline-block text-sm text-canvas-blue hover:underline"
          >
            Back to groups
          </Link>
        </div>
      </div>
    );
  }

  const { set, group } = found;
  const members = roster.filter((m) => group.studentIds.includes(m.id));
  const leader = members.find((m) => m.id === group.leaderId);
  const canPost = isStaff || group.studentIds.includes(me.id);
  const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "discussions", label: "Discussions", icon: MessageSquare },
    { id: "files", label: "Files", icon: FileText },
    { id: "people", label: "People", icon: Users },
  ];

  const roots = space.posts.filter((p) => !p.parentId);
  const repliesFor = (id: string) => space.posts.filter((p) => p.parentId === id);

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <PageIdentityHeader
          size="md"
          icon={Users}
          label={set.name}
          title={group.name}
          description={
            leader
              ? `${members.length} members · Leader ${leader.name}`
              : `${members.length} members`
          }
          actions={
            <Link
              to={`/courses/${effectiveCourseId}/people/groups`}
              className="btn-canvas-secondary text-sm"
            >
              All groups
            </Link>
          }
        />

        <div className="mt-6 flex border-b border-gray-200 text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors ${
                tab === t.id
                  ? "border-canvas-blue font-medium text-canvas-blue"
                  : "border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "home" && (
          <div className="mt-6 max-w-2xl space-y-6">
            {canPost && (
              <form
                className="rounded-xl border border-gray-200 bg-canvas-grayLight/40 p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!annTitle.trim()) return;
                  addGroupAnnouncement(effectiveCourseId, gid, {
                    title: annTitle,
                    body: annBody,
                    authorId: me.id,
                    author: me.name,
                  });
                  setAnnTitle("");
                  setAnnBody("");
                  showToast("Announcement posted", "positive");
                }}
              >
                <p className="text-sm font-semibold text-canvas-grayDark">Group announcement</p>
                <input
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Title"
                  className="form-input mt-3 h-9"
                />
                <textarea
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  rows={3}
                  placeholder="Details for your group…"
                  className="form-input mt-2 resize-y"
                />
                <button type="submit" className="btn-canvas-primary mt-3 inline-flex items-center gap-1.5 text-sm">
                  <Megaphone className="h-4 w-4" />
                  Post
                </button>
              </form>
            )}
            {space.announcements.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
                No group announcements yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {space.announcements.map((a) => (
                  <li key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-canvas-grayDark">{a.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {a.author} · {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {(isStaff || a.authorId === me.id) && (
                        <button
                          type="button"
                          onClick={() => deleteGroupAnnouncement(effectiveCourseId, gid, a.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-canvas-red"
                          aria-label="Delete announcement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {a.body ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{a.body}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "discussions" && (
          <div className="mt-6 max-w-2xl space-y-4">
            {canPost && (
              <form
                className="rounded-xl border border-gray-200 p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const post = addGroupPost(effectiveCourseId, gid, {
                    body: postBody,
                    authorId: me.id,
                    author: me.name,
                  });
                  if (post) {
                    setPostBody("");
                    showToast("Posted", "positive");
                  }
                }}
              >
                <textarea
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  rows={3}
                  placeholder="Start a discussion with your group…"
                  className="form-input resize-y"
                />
                <button
                  type="submit"
                  disabled={!postBody.trim()}
                  className="btn-canvas-primary mt-2 text-sm disabled:opacity-50"
                >
                  Post
                </button>
              </form>
            )}
            {roots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
                No discussion posts yet.
              </p>
            ) : (
              roots
                .slice()
                .reverse()
                .map((post) => (
                  <DiscussionThread
                    key={post.id}
                    courseId={effectiveCourseId}
                    groupId={gid}
                    post={post}
                    replies={repliesFor(post.id)}
                    canReply={canPost}
                  />
                ))
            )}
          </div>
        )}

        {tab === "files" && (
          <div className="mt-6 max-w-2xl">
            {canPost && (
              <label className="btn-canvas-secondary mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm">
                <Paperclip className="h-4 w-4" />
                Upload file
                <input
                  type="file"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      const stored = await fileToGroupFile(file, { id: me.id, name: me.name });
                      addGroupFile(effectiveCourseId, gid, stored);
                      showToast("File uploaded", "positive");
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : "Upload failed", "negative");
                    }
                  }}
                />
              </label>
            )}
            {space.files.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
                No files shared with this group yet.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                {space.files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <a
                        href={f.dataUrl}
                        download={f.name}
                        className="truncate text-sm font-medium text-canvas-blue hover:underline"
                      >
                        {f.name}
                      </a>
                      <p className="text-xs text-gray-500">
                        {f.uploadedBy} · {Math.max(1, Math.round(f.size / 1024))} KB
                      </p>
                    </div>
                    {(isStaff || f.uploadedById === me.id) && (
                      <button
                        type="button"
                        onClick={() => deleteGroupFile(effectiveCourseId, gid, f.id)}
                        className="rounded p-1 text-gray-400 hover:text-canvas-red"
                        aria-label={`Delete ${f.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "people" && (
          <div className="mt-6 max-w-xl">
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-2.5">
                    <UserAvatar name={m.name} size="sm" />
                    <span>
                      <span className="block text-sm font-medium text-canvas-grayDark">{m.name}</span>
                      {m.id === group.leaderId ? (
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-canvas-blue">
                          Leader
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {isStaff && (
                    <button
                      type="button"
                      onClick={() =>
                        updateGroup(effectiveCourseId, set.id, group.id, {
                          leaderId: group.leaderId === m.id ? undefined : m.id,
                        })
                      }
                      className="text-xs text-canvas-blue hover:underline"
                    >
                      {group.leaderId === m.id ? "Remove leader" : "Make leader"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function DiscussionThread({
  courseId,
  groupId,
  post,
  replies,
  canReply,
}: {
  courseId: string;
  groupId: string;
  post: GroupPost;
  replies: GroupPost[];
  canReply: boolean;
}) {
  const me = loadUser();
  const [reply, setReply] = useState("");
  return (
    <article className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-start gap-2.5">
        <UserAvatar name={post.author} size="sm" />
        <div>
          <p className="text-sm font-semibold text-canvas-grayDark">{post.author}</p>
          <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleString()}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{post.body}</p>
        </div>
      </div>
      {replies.length > 0 && (
        <ul className="mt-3 space-y-3 border-l border-gray-200 pl-4">
          {replies.map((r) => (
            <li key={r.id} className="flex items-start gap-2.5">
              <UserAvatar name={r.author} size="sm" />
              <div>
                <p className="text-sm font-medium text-canvas-grayDark">{r.author}</p>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canReply && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addGroupPost(courseId, groupId, {
              body: reply,
              authorId: me.id,
              author: me.name,
              parentId: post.id,
            });
            setReply("");
          }}
        >
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply…"
            className="form-input h-9 flex-1"
          />
          <button type="submit" disabled={!reply.trim()} className="btn-canvas-secondary text-sm disabled:opacity-50">
            Reply
          </button>
        </form>
      )}
    </article>
  );
}
