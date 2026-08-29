// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  currentInboxViewer,
  deleteThread,
  deliverAutomatedInbox,
  exportInboxForCourse,
  isInboxUnreadFor,
  loadInboxConversations,
  markThreadRead,
  replyToThread,
  sendInboxMessage,
  setThreadStudentReplies,
  toggleThreadArchived,
  toggleThreadMuted,
  type InboxViewer,
} from "./inbox";
import { notifyDiscussionReplyInbox } from "./inboxActivity";
import { addRosterMember } from "./courseRoster";
import { saveSettings } from "./settingsStore";
import { saveUser } from "./userStore";

const instructor: InboxViewer = { id: "1", name: "Nehang Patel", role: "instructor" };
const alex: InboxViewer = { id: "demo_alex", name: "Alex Chen", role: "student" };

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("canvasClone:viewAs", "instructor");
  window.localStorage.setItem("canvasClone:studentView:global", "false");
  saveUser({
    id: "1",
    name: "Nehang Patel",
    email: "nehang@example.edu",
    avatarInitials: "NP",
    role: "instructor",
    enrolledCourseIds: ["1"],
  });
});

describe("inbox compose and threads", () => {
  it("marks a sent message unread for the recipient and read for the sender", () => {
    const msg = sendInboxMessage({
      from: instructor.name,
      fromUserId: instructor.id,
      to: [{ id: alex.id, name: alex.name, role: "student" }],
      subject: "Office hours",
      body: "Come by Thursday.",
      courseId: "1",
      kind: "direct",
    });
    expect(isInboxUnreadFor(msg, instructor)).toBe(false);
    expect(isInboxUnreadFor(msg, alex)).toBe(true);
    expect(loadInboxConversations("sent", { viewer: instructor }).some((c) => c.threadId === msg.threadId)).toBe(true);
    expect(loadInboxConversations("inbox", { viewer: alex }).some((c) => c.threadId === msg.threadId)).toBe(true);
    expect(loadInboxConversations("inbox", { viewer: instructor }).some((c) => c.threadId === msg.threadId)).toBe(false);
  });

  it("keeps replies on the same thread and flips unread to the other person", () => {
    const first = sendInboxMessage({
      from: alex.name,
      fromUserId: alex.id,
      to: [{ id: instructor.id, name: instructor.name, role: "instructor" }],
      subject: "Homework 1",
      body: "Can I use a matrix?",
      courseId: "1",
      kind: "direct",
    });
    const reply = replyToThread(first.threadId!, "Yes — either representation is fine.", instructor);
    expect(reply?.threadId).toBe(first.threadId);
    const thread = loadInboxConversations("inbox", { viewer: alex }).find((c) => c.threadId === first.threadId);
    expect(thread?.messages).toHaveLength(2);
    expect(thread?.unread).toBe(true);
    markThreadRead(first.threadId!, alex);
    const after = loadInboxConversations("inbox", { viewer: alex }).find((c) => c.threadId === first.threadId);
    expect(after?.unread).toBe(false);
  });

  it("hides a deleted thread from one viewer only", () => {
    const msg = sendInboxMessage({
      from: instructor.name,
      fromUserId: instructor.id,
      to: [{ id: alex.id, name: alex.name, role: "student" }],
      subject: "Ping",
      body: "Hello",
      kind: "direct",
    });
    deleteThread(msg.threadId!, alex);
    expect(loadInboxConversations("inbox", { viewer: alex }).some((c) => c.threadId === msg.threadId)).toBe(false);
    expect(loadInboxConversations("sent", { viewer: instructor }).some((c) => c.threadId === msg.threadId)).toBe(true);
  });

  it("blocks student replies when the instructor turns them off", () => {
    const msg = sendInboxMessage({
      from: instructor.name,
      fromUserId: instructor.id,
      to: [{ id: alex.id, name: alex.name, role: "student" }],
      subject: "Read-only notice",
      body: "No need to reply.",
      kind: "direct",
      studentRepliesEnabled: false,
    });
    expect(replyToThread(msg.threadId!, "Got it.", alex)).toBeNull();
    const staffReply = replyToThread(msg.threadId!, "Adding a follow-up.", instructor);
    expect(staffReply).not.toBeNull();
    const thread = loadInboxConversations("inbox", { viewer: alex }).find((c) => c.threadId === msg.threadId);
    expect(thread?.studentRepliesEnabled).toBe(false);
    expect(thread?.messages).toHaveLength(2);
  });

  it("delivers CC recipients and supports archive, mute, and reply lock after send", () => {
    const jordan: InboxViewer = { id: "demo_jordan", name: "Jordan Lee", role: "student" };
    const msg = sendInboxMessage({
      from: instructor.name,
      fromUserId: instructor.id,
      to: [{ id: alex.id, name: alex.name, role: "student" }],
      cc: [{ id: jordan.id, name: jordan.name, role: "student" }],
      subject: "Both of you",
      body: "See the prompt.",
      courseId: "1",
      kind: "direct",
    });
    expect(loadInboxConversations("inbox", { viewer: alex }).some((c) => c.threadId === msg.threadId)).toBe(true);
    expect(loadInboxConversations("inbox", { viewer: jordan }).some((c) => c.threadId === msg.threadId)).toBe(true);
    expect(exportInboxForCourse("1").some((m) => m.id === msg.id)).toBe(true);

    toggleThreadMuted(msg.threadId!, alex);
    expect(
      loadInboxConversations("unread", { viewer: alex }).some((c) => c.threadId === msg.threadId),
    ).toBe(false);

    toggleThreadArchived(msg.threadId!, alex);
    expect(loadInboxConversations("inbox", { viewer: alex }).some((c) => c.threadId === msg.threadId)).toBe(false);
    expect(loadInboxConversations("archived", { viewer: alex }).some((c) => c.threadId === msg.threadId)).toBe(true);

    setThreadStudentReplies(msg.threadId!, false);
    expect(replyToThread(msg.threadId!, "ok", alex)).toBeNull();
    expect(replyToThread(msg.threadId!, "noted", instructor)).not.toBeNull();
  });
});

describe("automated inbox", () => {
  it("delivers announcement broadcasts to students", () => {
    deliverAutomatedInbox({
      kind: "announcement",
      audience: "student",
      from: "CourseArc System",
      subject: "New announcement: Lab closed",
      body: "A new announcement was published.",
      courseId: "1",
    });
    expect(loadInboxConversations("inbox", { viewer: alex }).some((c) => c.kind === "announcement")).toBe(true);
    expect(loadInboxConversations("inbox", { viewer: instructor }).some((c) => c.kind === "announcement")).toBe(false);
  });

  it("skips discussion inbox when the preference is off", () => {
    saveSettings({ notifyDiscussions: false });
    const result = notifyDiscussionReplyInbox({
      courseId: "1",
      courseTitle: "CS 101",
      topicId: "t1",
      topicTitle: "Welcome",
      topicAuthor: "Instructor",
      replyAuthor: "Alex Chen",
      replyAuthorId: "demo_alex",
      replyBody: "Hi everyone",
    });
    expect(result).toBeNull();
  });

  it("sends a discussion reply to the topic author on the roster", () => {
    addRosterMember("1", { id: "1", name: "Nehang Patel", role: "instructor" });
    addRosterMember("1", { id: "demo_alex", name: "Alex Chen", role: "student" });
    const result = notifyDiscussionReplyInbox({
      courseId: "1",
      courseTitle: "CS 101",
      topicId: "t1",
      topicTitle: "Welcome",
      topicAuthor: "Instructor",
      replyAuthor: "Alex Chen",
      replyAuthorId: "demo_alex",
      replyBody: "<p>Hi everyone</p>",
    });
    expect(result).not.toBeNull();
    expect(result?.to?.some((p) => p.id === "1")).toBe(true);
    expect(loadInboxConversations("inbox", { viewer: instructor }).some((c) => c.kind === "discussion")).toBe(true);
  });
});

describe("current viewer", () => {
  it("reads the signed-in instructor by default", () => {
    expect(currentInboxViewer().id).toBe("1");
    expect(currentInboxViewer().role).toBe("instructor");
  });
});
