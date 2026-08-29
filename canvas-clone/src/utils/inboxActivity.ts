import { loadRoster } from "./courseRoster";
import {
  deliverAutomatedInbox,
  inboxPlainText,
  type InboxMessage,
  type InboxParticipant,
} from "./inbox";
import { loadSettings } from "./settingsStore";

function rosterMatch(courseId: string, name: string, id?: string): InboxParticipant | null {
  const roster = loadRoster(courseId);
  if (id) {
    const byId = roster.find((m) => m.id === id);
    if (byId) return { id: byId.id, name: byId.name, role: byId.role };
  }
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "instructor") {
    const instructor = roster.find((m) => m.role === "instructor");
    return instructor
      ? { id: instructor.id, name: instructor.name, role: instructor.role }
      : null;
  }
  if (normalized === "teaching assistant" || normalized === "ta") {
    const ta = roster.find((m) => m.role === "ta");
    return ta ? { id: ta.id, name: ta.name, role: ta.role } : null;
  }
  const byName = roster.find((m) => m.name.trim().toLowerCase() === normalized);
  return byName ? { id: byName.id, name: byName.name, role: byName.role } : null;
}

export function notifyDiscussionReplyInbox(input: {
  courseId: string;
  courseTitle: string;
  topicId: string;
  topicTitle: string;
  topicAuthor: string;
  replyAuthor: string;
  replyAuthorId?: string;
  replyBody: string;
  parentAuthor?: string;
  parentAuthorId?: string;
}): InboxMessage | null {
  if (loadSettings().notifyDiscussions === false) return null;
  const recipients = new Map<string, InboxParticipant>();
  const topic = rosterMatch(input.courseId, input.topicAuthor);
  if (topic && topic.id !== input.replyAuthorId && topic.name !== input.replyAuthor) {
    recipients.set(topic.id, topic);
  }
  if (input.parentAuthor) {
    const parent = rosterMatch(input.courseId, input.parentAuthor, input.parentAuthorId);
    if (parent && parent.id !== input.replyAuthorId && parent.name !== input.replyAuthor) {
      recipients.set(parent.id, parent);
    }
  }
  const to = [...recipients.values()];
  if (to.length === 0) return null;
  const plain = inboxPlainText(input.replyBody);
  return deliverAutomatedInbox({
    kind: "discussion",
    audience: to.every((p) => p.role === "student") ? "student" : "instructor",
    from: input.replyAuthor,
    fromUserId: input.replyAuthorId,
    to,
    subject: `Re: ${input.topicTitle}`,
    body: `${input.replyAuthor} replied in "${input.topicTitle}" (${input.courseTitle}):\n\n${plain}`,
    courseId: input.courseId,
    href: `/courses/${input.courseId}/discussions/${input.topicId}`,
  });
}
