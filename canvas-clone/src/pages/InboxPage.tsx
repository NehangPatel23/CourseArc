import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon, { type IconName } from "../icons/Icon";
import AppEmptyState from "../components/AppEmptyState";
import CalendarCoursePip from "../components/CalendarCoursePip";
import ConfirmActionModal from "../components/ConfirmActionModal";
import InboxComposeModal from "../components/InboxComposeModal";
import PageIdentityHeader from "../components/PageIdentityHeader";
import UserAvatar from "../components/UserAvatar";
import { useToast } from "../components/ui/Toast";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { getCourseById, loadCourses } from "../utils/coursesStore";
import { avatarColorForId, initialsFromName } from "../utils/avatar";
import {
  INBOX_CHANGED_EVENT,
  canViewerReplyToThread,
  currentInboxViewer,
  deleteReadMessages,
  deleteThread,
  displayInboxMessage,
  formatInboxTime,
  loadInboxConversation,
  fileToInboxAttachment,
  loadInboxConversations,
  markAllRead,
  markThreadRead,
  replyToThread,
  setThreadStudentReplies,
  toggleThreadArchived,
  toggleThreadMuted,
  toggleThreadStarred,
  type InboxAttachment,
  type InboxConversation,
  type InboxFolder,
  type InboxMessageKind,
} from "../utils/inbox";

const FOLDERS: { id: InboxFolder; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "unread", label: "Unread" },
  { id: "starred", label: "Starred" },
  { id: "sent", label: "Sent" },
  { id: "archived", label: "Archived" },
];

function inboxLinkLabel(href: string) {
  if (href.includes("appointment=")) return "View appointment →";
  if (href.startsWith("/calendar")) return "Open calendar →";
  if (href.includes("/announcements/")) return "Open announcement →";
  if (href.includes("/discussions/")) return "Open discussion →";
  if (href.includes("/grades")) return "Open grades →";
  return "Open →";
}

function kindMeta(kind: InboxMessageKind): { label: string; icon: IconName } | null {
  switch (kind) {
    case "announcement":
      return { label: "Announcement", icon: "megaphone" };
    case "discussion":
      return { label: "Discussion", icon: "chat" };
    case "grade":
      return { label: "Grades", icon: "cap" };
    case "appointment":
      return { label: "Appointment", icon: "calendar" };
    case "system":
      return { label: "System", icon: "inbox" };
    default:
      return null;
  }
}

export default function InboxPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [folder, setFolder] = useState<InboxFolder>("inbox");
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("thread"));
  const [composeOpen, setComposeOpen] = useState(searchParams.get("compose") === "1");
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<InboxAttachment[]>([]);
  const [confirm, setConfirm] = useState<"read" | "thread" | null>(null);
  const [conversations, setConversations] = useState<InboxConversation[]>(() =>
    loadInboxConversations("inbox"),
  );

  const composeCourse = searchParams.get("course") ?? undefined;
  const composeToIds = (searchParams.get("to") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const refresh = () => setConversations(loadInboxConversations(folder, { courseId: courseFilter || undefined, query }));

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(INBOX_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(INBOX_CHANGED_EVENT, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, courseFilter, query]);

  useEffect(() => {
    const thread = searchParams.get("thread");
    if (!thread) return;
    setSelectedId(thread);
    const inInbox = loadInboxConversations("inbox").some((c) => c.threadId === thread);
    if (!inInbox) setFolder("sent");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected =
    conversations.find((c) => c.threadId === selectedId) ??
    (selectedId ? loadInboxConversation(selectedId) : null);
  const viewer = currentInboxViewer();
  const canReply = selected ? canViewerReplyToThread(selected.messages, viewer) : false;
  const unreadCount = loadInboxConversations("unread").length;
  const readCount = conversations.filter((c) => !c.unread).length;
  const courses = loadCourses(false);

  const openThread = (threadId: string) => {
    markThreadRead(threadId);
    setSelectedId(threadId);
    setReply("");
    setReplyFiles([]);
  };

  const closeComposeParams = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("compose");
    next.delete("to");
    next.delete("course");
    setSearchParams(next, { replace: true });
  };

  useKeyboardShortcuts([
    { key: "c", handler: () => setComposeOpen(true) },
  ]);

  const sendReply = () => {
    if (!selected || (!reply.trim() && replyFiles.length === 0)) return;
    if (!canViewerReplyToThread(selected.messages, viewer)) return;
    const sent = replyToThread(selected.threadId, reply, viewer, replyFiles);
    if (sent) {
      setReply("");
      setReplyFiles([]);
      showToast("Reply sent", "positive");
      setConversations(loadInboxConversations(folder, { courseId: courseFilter || undefined, query }));
    }
  };

  const emptyCopy =
    folder === "unread"
      ? { title: "You're all caught up", subtitle: "No unread conversations." }
      : folder === "starred"
        ? { title: "No starred messages", subtitle: "Star a conversation to find it later." }
        : folder === "sent"
          ? { title: "Nothing sent yet", subtitle: "Compose a message to start a conversation." }
          : folder === "archived"
            ? { title: "Nothing archived", subtitle: "Archive a conversation to tuck it away without deleting it." }
            : { title: "Inbox is empty", subtitle: "Messages from your courses will appear here." };

  return (
    <div className="inbox-page flex h-full min-h-[calc(100vh-0px)] bg-arc-paper">
      <div
        className={`flex w-full shrink-0 flex-col overflow-hidden border-r border-arc-line bg-arc-ivory md:max-w-md ${
          selected ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="border-b border-arc-line px-4 py-4">
          <PageIdentityHeader
            size="sm"
            icon="inbox"
            label="Inbox"
            title="Inbox"
            actions={
              <button
                type="button"
                data-tour="inbox-compose"
                onClick={() => setComposeOpen(true)}
                className="btn-canvas-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Icon name="compose" size={14} />
                Compose
              </button>
            }
          />
          <div className="mt-4 flex rounded-lg bg-arc-paper p-1">
            {FOLDERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFolder(f.id);
                  setSelectedId(null);
                }}
                className={`flex-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium transition sm:text-xs ${
                  folder === f.id
                    ? "bg-arc-ivory text-arc-ink shadow-sm"
                    : "text-arc-mute hover:text-arc-ink"
                }`}
              >
                {f.label}
                {f.id === "unread" && unreadCount > 0 ? ` ${unreadCount}` : ""}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-arc-mute" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages…"
                className="form-input h-9 pl-8 text-sm"
              />
            </div>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="form-input h-9 w-[8.5rem] shrink-0 text-xs"
              aria-label="Filter by course"
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex justify-end gap-3">
            {readCount > 0 && folder !== "unread" && (
              <button
                type="button"
                onClick={() => setConfirm("read")}
                className="text-xs text-red-600 hover:underline"
              >
                Delete read
              </button>
            )}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  markAllRead();
                  refresh();
                }}
                className="text-xs text-arc-copper hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>
        {conversations.length === 0 ? (
          <div className="flex-1 overflow-y-auto p-4 pb-16">
            <AppEmptyState
              variant="inbox"
              studio={viewer.role === "student" ? "student" : "instructor"}
              title={emptyCopy.title}
              subtitle={emptyCopy.subtitle}
              compact
            />
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto pb-16">
            {conversations.map((c) => {
              const course = c.courseId ? getCourseById(c.courseId) : undefined;
              const who = c.participants[0]?.name ?? c.latest.from;
              const meta = kindMeta(c.kind);
              return (
                <li key={c.threadId}>
                  <button
                    type="button"
                    onClick={() => openThread(c.threadId)}
                    className={`relative flex w-full gap-3 border-b border-arc-line/60 px-4 py-3.5 text-left transition hover:bg-arc-paper ${
                      selectedId === c.threadId ? "bg-arc-copper/15" : ""
                    }`}
                  >
                    {c.unread && (
                      <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-arc-copper" />
                    )}
                    <UserAvatar
                      name={who}
                      initials={initialsFromName(who)}
                      color={avatarColorForId(c.participants[0]?.id ?? who)}
                      size="xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`truncate text-sm ${
                            c.unread ? "font-semibold text-arc-ink" : "font-medium text-arc-ink/80"
                          }`}
                        >
                          {who}
                          {c.participants.length > 1 ? ` +${c.participants.length - 1}` : ""}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] text-arc-mute">
                          {formatInboxTime(c.latest.timestamp)}
                        </span>
                      </div>
                      <p
                        className={`truncate text-sm ${
                          c.unread ? "text-arc-ink" : "text-arc-mute"
                        }`}
                      >
                        {c.subject}
                      </p>
                      <p className="truncate text-xs text-arc-mute">{c.preview}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {course && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-arc-mute">
                            <CalendarCoursePip color={course.color} className="h-1.5 w-1.5" />
                            {course.code}
                          </span>
                        )}
                        {meta && (
                          <span className="text-[11px] text-arc-mute">{meta.label}</span>
                        )}
                        {c.starred && <Icon name="star" size={12} className="text-arc-gold" />}
                        {c.muted && <Icon name="mute" size={12} className="text-arc-mute" />}
                        {!c.studentRepliesEnabled && (
                          <span className="text-[11px] text-arc-mute">Replies off</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={`min-h-0 flex-1 ${selected ? "flex" : "hidden md:flex"} flex-col bg-arc-paper`}>
        {selected ? (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-arc-line bg-arc-ivory px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-md p-1 text-arc-mute hover:bg-arc-paper md:hidden"
                    aria-label="Back to inbox"
                  >
                    <Icon name="chevronLeft" size={16} />
                  </button>
                  <h2 className="truncate text-lg font-semibold text-arc-ink">
                    {selected.subject}
                  </h2>
                  {!selected.studentRepliesEnabled && (
                    <span className="shrink-0 rounded-full bg-arc-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-arc-mute">
                      Replies off
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-arc-mute">
                  {selected.participants.length
                    ? selected.participants.map((p) => p.name).join(", ")
                    : selected.latest.from}
                </p>
                {selected.courseId && getCourseById(selected.courseId) && (
                  <Link
                    to={`/courses/${selected.courseId}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-xs text-arc-copper hover:underline"
                  >
                    <CalendarCoursePip
                      color={getCourseById(selected.courseId)!.color}
                      className="h-1.5 w-1.5"
                    />
                    {getCourseById(selected.courseId)!.title}
                  </Link>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {viewer.role !== "student" && (
                  <button
                    type="button"
                    onClick={() => {
                      setThreadStudentReplies(selected.threadId, !selected.studentRepliesEnabled);
                      refresh();
                    }}
                    className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-arc-mute hover:bg-arc-paper"
                    title={
                      selected.studentRepliesEnabled
                        ? "Turn off student replies"
                        : "Allow student replies"
                    }
                  >
                    {selected.studentRepliesEnabled ? "Lock replies" : "Allow replies"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    toggleThreadMuted(selected.threadId);
                    refresh();
                  }}
                  className="rounded-lg p-2 text-arc-mute hover:bg-arc-paper hover:text-arc-ink/80"
                  aria-label={selected.muted ? "Unmute conversation" : "Mute conversation"}
                  title={selected.muted ? "Unmute" : "Mute"}
                >
                  <Icon name="mute" size={16} className={selected.muted ? "text-arc-ink" : ""} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const archived = toggleThreadArchived(selected.threadId);
                    if (archived) setSelectedId(null);
                    refresh();
                  }}
                  className="rounded-lg p-2 text-arc-mute hover:bg-arc-paper hover:text-arc-ink/80"
                  aria-label={selected.archived ? "Move to inbox" : "Archive conversation"}
                  title={selected.archived ? "Move to inbox" : "Archive"}
                >
                  <Icon name="archive" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleThreadStarred(selected.threadId);
                    refresh();
                  }}
                  className="rounded-lg p-2 text-arc-mute hover:bg-amber-50 hover:text-amber-500"
                  aria-label={selected.starred ? "Unstar conversation" : "Star conversation"}
                  title={selected.starred ? "Unstar" : "Star"}
                >
                  <Icon name="star" size={16} className={selected.starred ? "text-arc-gold" : ""} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm("thread")}
                  className="rounded-lg p-2 text-arc-mute hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete conversation"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6 pb-8">
              {selected.messages.map((m) => {
                const shown = displayInboxMessage(m);
                const meta = kindMeta(m.kind ?? "direct");
                return (
                  <article
                    key={m.id}
                    className="rounded-2xl bg-arc-ivory p-5 shadow-sm ring-1 ring-arc-line/80"
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        name={m.from}
                        initials={initialsFromName(m.from)}
                        color={avatarColorForId(m.fromUserId ?? m.from)}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-arc-ink">{m.from}</span>
                          {meta && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-arc-paper px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-arc-mute">
                              <Icon name={meta.icon} size={12} />
                              {meta.label}
                            </span>
                          )}
                          <span className="ml-auto text-xs text-arc-mute">
                            {formatInboxTime(m.timestamp)}
                          </span>
                        </div>
                        {shown.href && (
                          <Link
                            to={shown.href}
                            className="mt-1 inline-block text-sm text-arc-copper hover:underline"
                          >
                            {inboxLinkLabel(shown.href)}
                          </Link>
                        )}
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-arc-ink/80">
                          {shown.body}
                        </p>
                        {(m.attachments?.length ?? 0) > 0 && (
                          <ul className="mt-3 space-y-1">
                            {m.attachments!.map((a) => (
                              <li key={a.name + a.size}>
                                <a
                                  href={a.dataUrl}
                                  download={a.name}
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-arc-copper hover:underline"
                                >
                                  <Icon name="paperclip" size={14} />
                                  {a.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {canReply ? (
            <div className="border-t border-arc-line bg-arc-ivory px-5 py-4">
              <label className="block">
                <span className="sr-only">Reply</span>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder="Write a reply…"
                  className="form-input resize-none"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                />
              </label>
              {replyFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {replyFiles.map((a) => (
                    <li key={a.name + a.size} className="text-xs text-arc-mute">
                      {a.name}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-[11px] text-arc-mute">⌘ / Ctrl + Enter to send</p>
                  <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-arc-copper">
                    <Icon name="paperclip" size={14} />
                    Attach
                    <input
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={async (e) => {
                        const files = e.target.files;
                        e.target.value = "";
                        if (!files) return;
                        try {
                          const next = await Promise.all([...files].map(fileToInboxAttachment));
                          setReplyFiles((prev) => [...prev, ...next].slice(0, 3));
                        } catch (err) {
                          showToast(err instanceof Error ? err.message : "Could not attach", "negative");
                        }
                      }}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={!reply.trim() && replyFiles.length === 0}
                  onClick={sendReply}
                  className="btn-canvas-primary px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reply
                </button>
              </div>
            </div>
            ) : (
            <div className="border-t border-arc-line bg-arc-paper px-5 py-4">
              <p className="text-sm text-arc-mute">
                {viewer.role === "student"
                  ? "Your instructor turned off replies for this conversation."
                  : "Student replies are turned off for this conversation."}
              </p>
            </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <AppEmptyState
              variant="inbox"
              studio={viewer.role === "student" ? "student" : "instructor"}
              title="Select a conversation"
              subtitle="Choose a thread from the list, or compose a new message."
            />
          </div>
        )}
      </div>

      {composeOpen && (
        <InboxComposeModal
          initialCourseId={composeCourse}
          initialToIds={composeToIds}
          onClose={() => {
            setComposeOpen(false);
            closeComposeParams();
          }}
          onSent={(threadId) => {
            setComposeOpen(false);
            closeComposeParams();
            setFolder("sent");
            setSelectedId(threadId);
          }}
        />
      )}

      <ConfirmActionModal
        isOpen={confirm === "read"}
        title="Delete read messages?"
        description="Unread conversations will be kept. This only hides messages for you."
        confirmText="Delete read"
        tone="danger"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          deleteReadMessages();
          setSelectedId(null);
          refresh();
        }}
      />
      <ConfirmActionModal
        isOpen={confirm === "thread"}
        title="Delete this conversation?"
        description="It will be removed from your inbox. Other people keep their copy."
        confirmText="Delete"
        tone="danger"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!selected) return;
          deleteThread(selected.threadId);
          setSelectedId(null);
          refresh();
        }}
      />
    </div>
  );
}
