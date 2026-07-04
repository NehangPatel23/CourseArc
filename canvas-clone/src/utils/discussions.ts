export type DiscussionTopic = {
  id: string;
  title: string;
  author: string;
  body: string;
  createdAt: number;
  pinned?: boolean;
  locked?: boolean;
  published: boolean;
  status?: "draft" | "published";
  publishAt?: number;
  availableFrom?: number;
  availableUntil?: number;
  lastActivityAt?: number;
};

export type DiscussionAuthorRole = "instructor" | "ta";

export type DiscussionReply = {
  id: string;
  topicId: string;
  author: string;
  body: string;
  createdAt: number;
  updatedAt?: number;
  endorsed?: boolean;
  edited?: boolean;
  /** When set, this reply is nested under another reply. */
  parentReplyId?: string;
  authorRole?: DiscussionAuthorRole;
};

export type ReplyNode = DiscussionReply & { children: ReplyNode[] };

export function resolveReplyAuthorRole(
  author: string,
  authorRole?: DiscussionAuthorRole,
): DiscussionAuthorRole | null {
  if (authorRole) return authorRole;
  const normalized = author.trim().toLowerCase();
  if (normalized === "instructor") return "instructor";
  if (normalized === "teaching assistant" || normalized === "ta") return "ta";
  return null;
}

type DiscussionStore = {
  topics: DiscussionTopic[];
  replies: DiscussionReply[];
};

function discussionsKey(courseId: string) {
  return `canvasClone:discussions:${courseId}`;
}

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

function seedDiscussions(_courseId: string): DiscussionStore {
  const t1 = uid("topic");
  const t2 = uid("topic");
  const now = Date.now();
  return {
    topics: [
      {
        id: t1,
        title: "Welcome — introduce yourself",
        author: "Instructor",
        body: "<p>Share your background and what you hope to learn this term.</p>",
        createdAt: now - 86400000 * 5,
        pinned: true,
        published: true,
        status: "published",
        lastActivityAt: now - 86400000 * 4,
      },
      {
        id: t2,
        title: "Week 1 Q&A",
        author: "Teaching Assistant",
        body: "<p>Ask questions about the syllabus and first assignment here.</p>",
        createdAt: now - 86400000 * 2,
        published: true,
        status: "published",
        lastActivityAt: now - 86400000,
      },
      {
        id: uid("topic"),
        title: "Office hours poll (draft)",
        author: "Instructor",
        body: "<p>Draft topic for scheduling — not yet published.</p>",
        createdAt: now - 86400000,
        published: false,
        status: "draft",
      },
    ],
    replies: [
      {
        id: uid("reply"),
        topicId: t1,
        author: "Alex Chen",
        body: "<p>Hi everyone! Excited to be here.</p>",
        createdAt: now - 86400000 * 4,
      },
      (() => {
        const qId = uid("reply");
        return [
          {
            id: qId,
            topicId: t2,
            author: "Jordan Lee",
            body: "<p>Where can I find the rubric for Homework 1?</p>",
            createdAt: now - 86400000,
          },
          {
            id: uid("reply"),
            topicId: t2,
            parentReplyId: qId,
            author: "Teaching Assistant",
            authorRole: "ta" as const,
            body: "<p>Check the Assignments tab — the rubric is linked on Homework 1.</p>",
            createdAt: now - 86400000 + 3600000,
          },
        ];
      })(),
    ].flat(),
  };
}

function readStore(courseId: string): DiscussionStore {
  try {
    const raw = window.localStorage.getItem(discussionsKey(courseId));
    if (!raw) {
      const seed = seedDiscussions(courseId);
      saveStore(courseId, seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as DiscussionStore;
    if (!parsed?.topics) return seedDiscussions(courseId);
    return parsed;
  } catch {
    return seedDiscussions(courseId);
  }
}

function saveStore(courseId: string, store: DiscussionStore) {
  try {
    window.localStorage.setItem(discussionsKey(courseId), JSON.stringify(store));
    window.dispatchEvent(new Event("canvasClone:discussionsChanged"));
  } catch {}
}

export function loadTopics(courseId: string): DiscussionTopic[] {
  return readStore(courseId).topics;
}

export function getTopicById(courseId: string, topicId: string): DiscussionTopic | undefined {
  return readStore(courseId).topics.find((t) => t.id === topicId);
}

export function loadReplies(courseId: string, topicId: string): DiscussionReply[] {
  return readStore(courseId)
    .replies.filter((r) => r.topicId === topicId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function buildReplyTree(replies: DiscussionReply[]): ReplyNode[] {
  const byParent = new Map<string | undefined, DiscussionReply[]>();
  for (const r of replies) {
    const key = r.parentReplyId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(r);
  }

  const build = (parentId: string | undefined): ReplyNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({ ...r, children: build(r.id) }));

  return build(undefined);
}

export function loadReplyCount(courseId: string, topicId: string): number {
  return readStore(courseId).replies.filter((r) => r.topicId === topicId).length;
}

export function autoPublishTopic(t: DiscussionTopic, now = Date.now()): DiscussionTopic {
  if (t.status !== "draft" || !t.publishAt || t.publishAt > now) return t;
  return {
    ...t,
    status: "published",
    published: true,
    publishAt: undefined,
  };
}

export function isStudentVisibleTopic(t: DiscussionTopic, now = Date.now()): boolean {
  const published = t.published || t.status === "published";
  if (!published) return false;
  if (typeof t.publishAt === "number" && t.publishAt > now) return false;
  if (typeof t.availableFrom === "number" && t.availableFrom > now) return false;
  if (typeof t.availableUntil === "number" && t.availableUntil < now) return false;
  return true;
}

export function saveTopics(courseId: string, topics: DiscussionTopic[]) {
  const store = readStore(courseId);
  saveStore(courseId, { ...store, topics });
}

export function saveReplies(courseId: string, replies: DiscussionReply[]) {
  const store = readStore(courseId);
  saveStore(courseId, { ...store, replies });
}

export function addTopic(courseId: string, topic: Omit<DiscussionTopic, "id" | "createdAt">) {
  const store = readStore(courseId);
  const now = Date.now();
  const newTopic: DiscussionTopic = {
    ...topic,
    id: uid("topic"),
    createdAt: now,
    lastActivityAt: now,
  };
  saveStore(courseId, { ...store, topics: [newTopic, ...store.topics] });
  return newTopic;
}

export function updateTopic(courseId: string, topicId: string, patch: Partial<DiscussionTopic>) {
  const store = readStore(courseId);
  saveStore(courseId, {
    ...store,
    topics: store.topics.map((t) => (t.id === topicId ? { ...t, ...patch } : t)),
  });
}

export function deleteTopic(courseId: string, topicId: string) {
  const store = readStore(courseId);
  saveStore(courseId, {
    topics: store.topics.filter((t) => t.id !== topicId),
    replies: store.replies.filter((r) => r.topicId !== topicId),
  });
}

export function addReply(
  courseId: string,
  topicId: string,
  author: string,
  body: string,
  parentReplyId?: string,
  authorRole?: DiscussionAuthorRole,
) {
  const store = readStore(courseId);
  const now = Date.now();
  const reply: DiscussionReply = {
    id: uid("reply"),
    topicId,
    author,
    body,
    createdAt: now,
    ...(parentReplyId ? { parentReplyId } : {}),
    ...(authorRole ? { authorRole } : {}),
  };
  saveStore(courseId, {
    topics: store.topics.map((t) =>
      t.id === topicId ? { ...t, lastActivityAt: now } : t,
    ),
    replies: [...store.replies, reply],
  });
  return reply;
}

export function updateReply(
  courseId: string,
  replyId: string,
  patch: Partial<DiscussionReply>,
) {
  const store = readStore(courseId);
  saveStore(courseId, {
    ...store,
    replies: store.replies.map((r) =>
      r.id === replyId ? { ...r, ...patch, edited: true, updatedAt: Date.now() } : r,
    ),
  });
}

export function toggleReplyEndorsed(courseId: string, replyId: string) {
  const store = readStore(courseId);
  saveStore(courseId, {
    ...store,
    replies: store.replies.map((r) =>
      r.id === replyId ? { ...r, endorsed: !r.endorsed } : r,
    ),
  });
}

export function deleteReply(courseId: string, replyId: string) {
  const store = readStore(courseId);
  const toDelete = new Set<string>();
  const collect = (id: string) => {
    toDelete.add(id);
    for (const r of store.replies) {
      if (r.parentReplyId === id) collect(r.id);
    }
  };
  collect(replyId);
  saveStore(courseId, {
    ...store,
    replies: store.replies.filter((r) => !toDelete.has(r.id)),
  });
}

export { discussionsKey, uid };
