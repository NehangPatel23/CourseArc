import { loadSettings } from "./settingsStore";

export type InboxMessage = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  body: string;
  unread: boolean;
  courseId?: string;
  timestamp: number;
};

const INBOX_KEY = "canvasClone:inbox";

const SEED: InboxMessage[] = [
  {
    id: "1",
    from: "Dr. Smith",
    subject: "Office hours moved",
    preview: "This week's office hours will be held in room 302…",
    body: "This week's office hours will be held in room 302 instead of the usual location. Please bring your problem set questions.",
    unread: true,
    courseId: "1",
    timestamp: Date.now() - 3600000,
  },
  {
    id: "2",
    from: "Teaching Assistant",
    subject: "Lab review feedback",
    preview: "Great work on the NLP lab submission…",
    body: "Great work on the NLP lab submission. I've left detailed comments in the gradebook.",
    unread: true,
    courseId: "2",
    timestamp: Date.now() - 86400000,
  },
  {
    id: "3",
    from: "CourseArc System",
    subject: "Welcome to CourseArc",
    preview: "Your dashboard is ready. Explore your courses…",
    body: "Your dashboard is ready. Explore your courses and check the calendar for upcoming deadlines.",
    unread: false,
    timestamp: Date.now() - 172800000,
  },
];

function readMessages(): InboxMessage[] {
  try {
    const raw = window.localStorage.getItem(INBOX_KEY);
    if (!raw) return SEED.map((m) => ({ ...m }));
    const parsed = JSON.parse(raw) as InboxMessage[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED.map((m) => ({ ...m }));
  } catch {
    return SEED.map((m) => ({ ...m }));
  }
}

function saveMessages(messages: InboxMessage[]) {
  try {
    window.localStorage.setItem(INBOX_KEY, JSON.stringify(messages));
    window.dispatchEvent(new Event("canvasClone:inboxChanged"));
  } catch {}
}

export function loadInboxMessages(): InboxMessage[] {
  return readMessages().sort((a, b) => b.timestamp - a.timestamp);
}

export function getUnreadInboxCount(): number {
  return readMessages().filter((m) => m.unread).length;
}

export function getEffectiveUnreadInboxCount(): number {
  if (!loadSettings().notifyInbox) return 0;
  return getUnreadInboxCount();
}

export function markMessageRead(messageId: string) {
  const messages = readMessages().map((m) =>
    m.id === messageId ? { ...m, unread: false } : m,
  );
  saveMessages(messages);
}

export function markAllRead() {
  saveMessages(readMessages().map((m) => ({ ...m, unread: false })));
}
