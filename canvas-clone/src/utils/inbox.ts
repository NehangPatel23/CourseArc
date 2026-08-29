import { loadSettings } from "./settingsStore";
import { loadUser } from "./userStore";

export const INBOX_CHANGED_EVENT = "canvasClone:inboxChanged";

export type InboxAudience = "student" | "instructor" | "all";

export type InboxMessageKind =
  | "direct"
  | "announcement"
  | "discussion"
  | "grade"
  | "appointment"
  | "system";

export type InboxFolder = "inbox" | "unread" | "starred" | "sent" | "archived";

export type InboxParticipant = {
  id: string;
  name: string;
  role?: "instructor" | "ta" | "student" | "system";
};

export type InboxAttachment = {
  name: string;
  mime: string;
  size: number;
  dataUrl: string;
};

export const MAX_INBOX_ATTACHMENT_BYTES = 400_000;
export const MAX_INBOX_ATTACHMENTS = 3;

export type InboxMessage = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  body: string;
  unread: boolean;
  courseId?: string;
  /** In-app destination shown as a link instead of being dumped into the body. */
  href?: string;
  timestamp: number;
  threadId?: string;
  fromUserId?: string;
  to?: InboxParticipant[];
  cc?: InboxParticipant[];
  attachments?: InboxAttachment[];
  kind?: InboxMessageKind;
  audience?: InboxAudience;
  /** Viewer ids (or `"*"`) who have read this message. */
  readBy?: string[];
  starredBy?: string[];
  deletedBy?: string[];
  archivedBy?: string[];
  mutedBy?: string[];
  /** When false, students cannot reply. Staff can always reply. Omitted = allowed. */
  studentRepliesEnabled?: boolean;
};

export type InboxConversation = {
  threadId: string;
  subject: string;
  courseId?: string;
  kind: InboxMessageKind;
  latest: InboxMessage;
  messages: InboxMessage[];
  unread: boolean;
  starred: boolean;
  archived: boolean;
  muted: boolean;
  participants: InboxParticipant[];
  preview: string;
  studentRepliesEnabled: boolean;
};

export type InboxViewer = {
  id: string;
  name: string;
  role: "student" | "instructor" | "ta";
};

const TRAILING_PATH = /(?:\n\n|\n)(\/[^\s]+)\s*$/;
const READ_ALL = "*";
const INBOX_KEY = "canvasClone:inbox";

/** Pull a trailing `/path` out of older messages that inlined the href. */
export function displayInboxMessage(message: InboxMessage): {
  body: string;
  href?: string;
  preview: string;
} {
  const href = message.href;
  const body = message.body.replace(TRAILING_PATH, "").trim();
  const preview = (message.preview.replace(TRAILING_PATH, "").trim() || body).slice(0, 80);
  if (href) return { body, href, preview };
  const match = message.body.match(TRAILING_PATH);
  if (!match) return { body: message.body, preview: message.preview };
  return { body, href: match[1], preview };
}

export function inboxPlainText(htmlOrText: string): string {
  return htmlOrText
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function currentInboxViewer(): InboxViewer {
  const user = loadUser();
  const role = user.role === "ta" || user.role === "instructor" || user.role === "student"
    ? user.role
    : "student";
  return { id: user.id, name: user.name, role };
}

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

function seedMessages(): InboxMessage[] {
  const now = Date.now();
  return [
    {
      id: "seed_alex_hw",
      threadId: "thread_alex_hw",
      from: "Alex Chen",
      fromUserId: "demo_alex",
      to: [{ id: "1", name: "Nehang Patel", role: "instructor" }],
      subject: "Question about Homework 1",
      preview: "Should we use adjacency lists or matrices…",
      body: "Hi — I wanted to check whether we should use adjacency lists or matrices for the graph write-up.\n\nThanks,\nAlex",
      unread: true,
      kind: "direct",
      courseId: "1",
      timestamp: now - 7200000,
      readBy: ["demo_alex"],
    },
    {
      id: "1",
      threadId: "1",
      from: "Dr. Smith",
      subject: "Office hours moved",
      preview: "This week's office hours will be held in room 302…",
      body: "This week's office hours will be held in room 302 instead of the usual location. Please bring your problem set questions.",
      unread: true,
      kind: "direct",
      audience: "all",
      courseId: "1",
      timestamp: now - 3600000,
    },
    {
      id: "2",
      threadId: "2",
      from: "Teaching Assistant",
      fromUserId: "demo_ta",
      to: [{ id: "1", name: "Nehang Patel", role: "instructor" }],
      subject: "Lab review feedback",
      preview: "Great work on the NLP lab submission…",
      body: "Great work on the NLP lab submission. I've left detailed comments in the gradebook.",
      unread: true,
      kind: "direct",
      courseId: "2",
      timestamp: now - 86400000,
      readBy: ["demo_ta"],
    },
    {
      id: "3",
      threadId: "3",
      from: "CourseArc System",
      fromUserId: "system",
      subject: "Welcome to CourseArc",
      preview: "Your dashboard is ready. Explore your courses…",
      body: "Your dashboard is ready. Explore your courses and check the calendar for upcoming deadlines.",
      unread: false,
      kind: "system",
      audience: "all",
      timestamp: now - 172800000,
      readBy: [READ_ALL],
    },
  ];
}

function normalizeMessage(raw: InboxMessage): InboxMessage {
  const threadId = raw.threadId || raw.id;
  const kind = raw.kind ?? (raw.from === "CourseArc System" ? "system" : "direct");
  const readBy = raw.readBy
    ? [...raw.readBy]
    : raw.unread === false
      ? [READ_ALL]
      : raw.fromUserId
        ? [raw.fromUserId]
        : [];
  return {
    ...raw,
    threadId,
    kind,
    to: raw.to ?? [],
    cc: raw.cc ?? [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    audience: raw.audience,
    readBy,
    starredBy: raw.starredBy ?? [],
    deletedBy: raw.deletedBy ?? [],
    archivedBy: raw.archivedBy ?? [],
    mutedBy: raw.mutedBy ?? [],
  };
}

function readMessages(): InboxMessage[] {
  try {
    const raw = window.localStorage.getItem(INBOX_KEY);
    if (!raw) return seedMessages().map(normalizeMessage);
    const parsed = JSON.parse(raw) as InboxMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seedMessages().map(normalizeMessage);
    return parsed.map(normalizeMessage);
  } catch {
    return seedMessages().map(normalizeMessage);
  }
}

function saveMessages(messages: InboxMessage[]) {
  try {
    window.localStorage.setItem(INBOX_KEY, JSON.stringify(messages));
    window.dispatchEvent(new Event(INBOX_CHANGED_EVENT));
  } catch {
    // Ignore quota / private-mode write failures.
  }
}

function viewerIsStaff(viewer: InboxViewer) {
  return viewer.role !== "student";
}

export function isInboxVisibleTo(message: InboxMessage, viewer: InboxViewer): boolean {
  if (message.deletedBy?.includes(viewer.id)) return false;
  if (message.fromUserId && message.fromUserId === viewer.id) return true;
  if (message.to?.some((p) => p.id === viewer.id)) return true;
  if (message.cc?.some((p) => p.id === viewer.id)) return true;
  if (message.audience === "all") return true;
  if (message.audience === "student" && viewer.role === "student") return true;
  if (message.audience === "instructor" && viewerIsStaff(viewer)) return true;
  if (!message.fromUserId && !message.audience && (!message.to || message.to.length === 0)) {
    return true;
  }
  return false;
}

export function isInboxUnreadFor(message: InboxMessage, viewer: InboxViewer): boolean {
  if (!isInboxVisibleTo(message, viewer)) return false;
  if (message.readBy?.includes(READ_ALL) || message.readBy?.includes(viewer.id)) return false;
  if (message.fromUserId && message.fromUserId === viewer.id) return false;
  return true;
}

export function isInboxStarredFor(message: InboxMessage, viewer: InboxViewer): boolean {
  return Boolean(message.starredBy?.includes(viewer.id));
}

export function isInboxArchivedFor(message: InboxMessage, viewer: InboxViewer): boolean {
  return Boolean(message.archivedBy?.includes(viewer.id));
}

export function isInboxMutedFor(message: InboxMessage, viewer: InboxViewer): boolean {
  return Boolean(message.mutedBy?.includes(viewer.id));
}

function otherParticipants(messages: InboxMessage[], viewer: InboxViewer): InboxParticipant[] {
  const byId = new Map<string, InboxParticipant>();
  for (const m of messages) {
    if (m.fromUserId && m.fromUserId !== viewer.id) {
      byId.set(m.fromUserId, { id: m.fromUserId, name: m.from });
    } else if (!m.fromUserId && m.from && m.from !== viewer.name) {
      byId.set(m.from, { id: m.from, name: m.from });
    }
    for (const p of [...(m.to ?? []), ...(m.cc ?? [])]) {
      if (p.id !== viewer.id) byId.set(p.id, p);
    }
  }
  return [...byId.values()];
}

function conversationFromMessages(
  threadId: string,
  messages: InboxMessage[],
  viewer: InboxViewer,
): InboxConversation {
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted[sorted.length - 1]!;
  const shown = displayInboxMessage(latest);
  return {
    threadId,
    subject: latest.subject,
    courseId: latest.courseId ?? sorted.find((m) => m.courseId)?.courseId,
    kind: latest.kind ?? "direct",
    latest,
    messages: sorted,
    unread: sorted.some((m) => isInboxUnreadFor(m, viewer)),
    starred: sorted.some((m) => isInboxStarredFor(m, viewer)),
    archived: sorted.some((m) => isInboxArchivedFor(m, viewer)),
    muted: sorted.some((m) => isInboxMutedFor(m, viewer)),
    participants: otherParticipants(sorted, viewer),
    preview: shown.preview,
    studentRepliesEnabled: threadAllowsStudentReplies(sorted),
  };
}

function visibleMessagesFor(viewer: InboxViewer): InboxMessage[] {
  return readMessages().filter((m) => isInboxVisibleTo(m, viewer));
}

export function loadInboxMessages(viewer = currentInboxViewer()): InboxMessage[] {
  return visibleMessagesFor(viewer).sort((a, b) => b.timestamp - a.timestamp);
}

export function loadInboxConversations(
  folder: InboxFolder = "inbox",
  opts: { courseId?: string; query?: string; viewer?: InboxViewer } = {},
): InboxConversation[] {
  const viewer = opts.viewer ?? currentInboxViewer();
  const groups = new Map<string, InboxMessage[]>();
  for (const m of visibleMessagesFor(viewer)) {
    const id = m.threadId || m.id;
    const list = groups.get(id) ?? [];
    list.push(m);
    groups.set(id, list);
  }

  let conversations = [...groups.entries()].map(([threadId, messages]) =>
    conversationFromMessages(threadId, messages, viewer),
  );

  conversations = conversations.filter((c) => {
    const sentByMe = c.messages.some((m) => m.fromUserId === viewer.id);
    const received = c.messages.some((m) => m.fromUserId !== viewer.id);
    if (folder === "archived") return c.archived;
    if (folder === "starred") return c.starred;
    if (c.archived) return false;
    if (folder === "sent") return sentByMe;
    if (folder === "unread") return c.unread && received && !c.muted;
    return received;
  });

  if (opts.courseId) {
    conversations = conversations.filter((c) => c.courseId === opts.courseId);
  }
  const q = opts.query?.trim().toLowerCase();
  if (q) {
    conversations = conversations.filter((c) => {
      const hay = [
        c.subject,
        c.preview,
        c.latest.from,
        ...c.participants.map((p) => p.name),
        ...c.messages.map((m) => m.body),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return conversations.sort((a, b) => b.latest.timestamp - a.latest.timestamp);
}

export function loadInboxConversation(
  threadId: string,
  viewer = currentInboxViewer(),
): InboxConversation | null {
  const messages = visibleMessagesFor(viewer).filter(
    (m) => (m.threadId || m.id) === threadId,
  );
  if (messages.length === 0) return null;
  return conversationFromMessages(threadId, messages, viewer);
}

export function getUnreadInboxCount(viewer = currentInboxViewer()): number {
  return loadInboxConversations("unread", { viewer }).filter((c) => !c.muted).length;
}

export function getEffectiveUnreadInboxCount(): number {
  if (!loadSettings().notifyInbox) return 0;
  return getUnreadInboxCount();
}

export function markMessageRead(messageId: string, viewer = currentInboxViewer()) {
  const messages = readMessages().map((m) => {
    if (m.id !== messageId) return m;
    const readBy = new Set(m.readBy ?? []);
    readBy.delete(READ_ALL);
    readBy.add(viewer.id);
    return { ...m, unread: false, readBy: [...readBy] };
  });
  saveMessages(messages);
}

export function markThreadRead(threadId: string, viewer = currentInboxViewer()) {
  const messages = readMessages().map((m) => {
    if ((m.threadId || m.id) !== threadId) return m;
    if (!isInboxVisibleTo(m, viewer)) return m;
    const readBy = new Set(m.readBy ?? []);
    readBy.delete(READ_ALL);
    readBy.add(viewer.id);
    return { ...m, unread: false, readBy: [...readBy] };
  });
  saveMessages(messages);
}

export function markAllRead(viewer = currentInboxViewer()) {
  const messages = readMessages().map((m) => {
    if (!isInboxVisibleTo(m, viewer)) return m;
    const readBy = new Set(m.readBy ?? []);
    readBy.delete(READ_ALL);
    readBy.add(viewer.id);
    return { ...m, unread: false, readBy: [...readBy] };
  });
  saveMessages(messages);
}

export function toggleThreadStarred(threadId: string, viewer = currentInboxViewer()) {
  const visible = readMessages().filter(
    (m) => (m.threadId || m.id) === threadId && isInboxVisibleTo(m, viewer),
  );
  const starred = visible.some((m) => m.starredBy?.includes(viewer.id));
  const messages = readMessages().map((m) => {
    if ((m.threadId || m.id) !== threadId) return m;
    const starredBy = new Set(m.starredBy ?? []);
    if (starred) starredBy.delete(viewer.id);
    else starredBy.add(viewer.id);
    return { ...m, starredBy: [...starredBy] };
  });
  saveMessages(messages);
}

export function deleteMessage(messageId: string, viewer = currentInboxViewer()) {
  const next = readMessages()
    .map((m) => {
      if (m.id !== messageId) return m;
      const deletedBy = new Set(m.deletedBy ?? []);
      deletedBy.add(viewer.id);
      return { ...m, deletedBy: [...deletedBy] };
    })
    .filter((m) => (m.deletedBy?.length ?? 0) < 8);
  saveMessages(next);
  return loadInboxMessages(viewer);
}

export function deleteThread(threadId: string, viewer = currentInboxViewer()) {
  const next = readMessages().map((m) => {
    if ((m.threadId || m.id) !== threadId) return m;
    const deletedBy = new Set(m.deletedBy ?? []);
    deletedBy.add(viewer.id);
    return { ...m, deletedBy: [...deletedBy] };
  });
  saveMessages(next);
  return loadInboxConversations("inbox", { viewer });
}

function toggleViewerFlag(
  threadId: string,
  field: "archivedBy" | "mutedBy",
  viewer: InboxViewer,
) {
  const visible = readMessages().filter(
    (m) => (m.threadId || m.id) === threadId && isInboxVisibleTo(m, viewer),
  );
  const currentlyOn = visible.some((m) => m[field]?.includes(viewer.id));
  const messages = readMessages().map((m) => {
    if ((m.threadId || m.id) !== threadId) return m;
    const next = new Set(m[field] ?? []);
    if (currentlyOn) next.delete(viewer.id);
    else next.add(viewer.id);
    return { ...m, [field]: [...next] };
  });
  saveMessages(messages);
  return !currentlyOn;
}

export function toggleThreadArchived(threadId: string, viewer = currentInboxViewer()) {
  return toggleViewerFlag(threadId, "archivedBy", viewer);
}

export function toggleThreadMuted(threadId: string, viewer = currentInboxViewer()) {
  return toggleViewerFlag(threadId, "mutedBy", viewer);
}

export function setThreadStudentReplies(threadId: string, enabled: boolean) {
  const messages = readMessages().map((m) => {
    if ((m.threadId || m.id) !== threadId) return m;
    return { ...m, studentRepliesEnabled: enabled };
  });
  saveMessages(messages);
}

/** Remove all messages that have already been read. Unread messages are kept. */
export function deleteReadMessages(viewer = currentInboxViewer()) {
  const next = readMessages().map((m) => {
    if (!isInboxVisibleTo(m, viewer) || isInboxUnreadFor(m, viewer)) return m;
    const deletedBy = new Set(m.deletedBy ?? []);
    deletedBy.add(viewer.id);
    return { ...m, deletedBy: [...deletedBy] };
  });
  saveMessages(next);
  return loadInboxMessages(viewer);
}

export function threadAllowsStudentReplies(messages: InboxMessage[]): boolean {
  const chronological = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  for (const m of chronological) {
    if (typeof m.studentRepliesEnabled === "boolean") return m.studentRepliesEnabled;
  }
  return true;
}

export function canViewerReplyToThread(
  messages: InboxMessage[],
  viewer: InboxViewer,
): boolean {
  if (viewer.role !== "student") return true;
  return threadAllowsStudentReplies(messages);
}

export function sendInboxMessage(input: {
  from: string;
  subject: string;
  body: string;
  courseId?: string;
  preview?: string;
  href?: string;
  fromUserId?: string;
  to?: InboxParticipant[];
  cc?: InboxParticipant[];
  attachments?: InboxAttachment[];
  threadId?: string;
  kind?: InboxMessageKind;
  audience?: InboxAudience;
  studentRepliesEnabled?: boolean;
}): InboxMessage {
  const threadId = input.threadId || uid("thread");
  const fromUserId = input.fromUserId;
  const to = input.to ?? [];
  const cc = (input.cc ?? []).filter((p) => !to.some((t) => t.id === p.id) && p.id !== fromUserId);
  const kind = input.kind ?? (to.length || cc.length ? "direct" : input.audience ? "system" : "direct");
  const audience = input.audience ?? (to.length || cc.length ? undefined : "all");
  const readBy = fromUserId ? [fromUserId] : [];
  const message: InboxMessage = {
    id: uid("msg"),
    threadId,
    from: input.from,
    fromUserId,
    to,
    cc,
    attachments: (input.attachments ?? []).slice(0, MAX_INBOX_ATTACHMENTS),
    subject: input.subject,
    preview: input.preview ?? inboxPlainText(input.body).slice(0, 80),
    body: input.body,
    unread: true,
    courseId: input.courseId,
    href: input.href,
    timestamp: Date.now(),
    kind,
    audience,
    readBy,
    starredBy: [],
    deletedBy: [],
    archivedBy: [],
    mutedBy: [],
    studentRepliesEnabled: input.studentRepliesEnabled,
  };
  saveMessages([message, ...readMessages()]);
  return message;
}

export function replyToThread(
  threadId: string,
  body: string,
  viewer = currentInboxViewer(),
  attachments?: InboxAttachment[],
): InboxMessage | null {
  const trimmed = body.trim();
  if (!trimmed && !(attachments && attachments.length > 0)) return null;
  const existing = readMessages().filter(
    (m) => (m.threadId || m.id) === threadId && isInboxVisibleTo(m, viewer),
  );
  if (existing.length === 0) return null;
  if (!canViewerReplyToThread(existing, viewer)) return null;
  const latest = [...existing].sort((a, b) => b.timestamp - a.timestamp)[0]!;
  const participants = otherParticipants(existing, viewer);
  const to =
    participants.length > 0
      ? participants
      : latest.to?.filter((p) => p.id !== viewer.id) ?? [];
  return sendInboxMessage({
    from: viewer.name,
    fromUserId: viewer.id,
    to,
    attachments,
    subject: latest.subject.startsWith("Re:") ? latest.subject : `Re: ${latest.subject}`,
    body: trimmed || "(attachment)",
    courseId: latest.courseId,
    threadId,
    kind: "direct",
    studentRepliesEnabled: threadAllowsStudentReplies(existing),
  });
}

export function fileToInboxAttachment(file: File): Promise<InboxAttachment> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_INBOX_ATTACHMENT_BYTES) {
      reject(new Error(`“${file.name}” is too large (max 400 KB).`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: String(reader.result ?? ""),
      });
    };
    reader.onerror = () => reject(new Error(`Could not read “${file.name}”.`));
    reader.readAsDataURL(file);
  });
}

export function exportInboxForCourse(courseId: string): InboxMessage[] {
  return readMessages().filter((m) => m.courseId === courseId);
}

export function importInboxForCourse(courseId: string, incoming: InboxMessage[]) {
  if (!Array.isArray(incoming) || incoming.length === 0) return;
  const existing = readMessages();
  const ids = new Set(existing.map((m) => m.id));
  const extra = incoming
    .map(normalizeMessage)
    .filter((m) => m.id && !ids.has(m.id))
    .map((m) => ({ ...m, courseId }));
  if (extra.length === 0) return;
  saveMessages([...extra, ...existing]);
}

export function formatInboxTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Course activity → Inbox (announcements, grades, discussion replies, appointments). */
export function deliverAutomatedInbox(input: {
  kind: InboxMessageKind;
  audience: InboxAudience;
  from: string;
  subject: string;
  body: string;
  courseId?: string;
  href?: string;
  to?: InboxParticipant[];
  fromUserId?: string;
}): InboxMessage {
  return sendInboxMessage({
    from: input.from,
    subject: input.subject,
    body: input.body,
    courseId: input.courseId,
    href: input.href,
    kind: input.kind,
    audience: input.to?.length ? undefined : input.audience,
    to: input.to,
    fromUserId: input.fromUserId ?? "system",
    studentRepliesEnabled: false,
  });
}
