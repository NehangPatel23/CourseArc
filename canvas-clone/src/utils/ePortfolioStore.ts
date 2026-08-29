import { loadAssignments } from "./assignments";
import { getStudentSubmission } from "./assignmentSubmissions";
import { loadCourses } from "./coursesStore";
import { getParticipationForStudent } from "./discussionParticipations";
import { loadTopics } from "./discussions";
import { isItemGradeVisible } from "./gradeVisibility";
import {
  getStudentAttemptsForQuiz,
  getStudentFinalScore,
  getScoringPolicyAttempt,
} from "./quizSubmissions";
import { getQuizById, loadQuizzes, quizShowsScoreToStudent } from "./quizzes";
import {
  deletePortfolioFile,
  getPortfolioFile,
  savePortfolioFileFromUpload,
  type StoredPortfolioFile,
} from "./portfolioFileStorage";
import { loadUser } from "./userStore";

export type PortfolioCourseWorkKind = "assignment" | "quiz" | "discussion";
export type PortfolioExternalType = "github" | "website" | "link" | "file";
export type PortfolioWorkKind = PortfolioCourseWorkKind | "external";

export type PortfolioEntry = {
  id: string;
  courseId: string;
  kind: PortfolioWorkKind;
  itemId: string;
  submissionId?: string;
  title: string;
  note?: string;
  featuredAt: number;
  /** Lower = earlier in showcase. */
  sortOrder: number;
  /** External project fields */
  externalType?: PortfolioExternalType;
  url?: string;
  fileName?: string;
  description?: string;
};

export type PortfolioDoc = {
  headline?: string;
  bio?: string;
  /** Optional skill / tech tags shown on the showcase. */
  skills?: string[];
  entries: PortfolioEntry[];
};

export type StudentWorkItem = {
  courseId: string;
  courseShortName: string;
  courseColor: string;
  kind: PortfolioCourseWorkKind;
  itemId: string;
  submissionId?: string;
  title: string;
  subtitle?: string;
  submittedAt: number;
  path: string;
  scoreLabel?: string;
};

export const EPORTFOLIO_CHANGED_EVENT = "canvasClone:ePortfolioChanged";
export const PERSONAL_PORTFOLIO_COURSE_ID = "_personal";

function key(userId: string) {
  return `canvasClone:ePortfolio:${userId}`;
}

function uid() {
  return `pf_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function emptyDoc(): PortfolioDoc {
  return { entries: [] };
}

function normalizeEntry(
  raw: Partial<PortfolioEntry> & {
    id: string;
    courseId: string;
    kind: PortfolioWorkKind;
    itemId: string;
    title: string;
    featuredAt: number;
  },
  index: number,
): PortfolioEntry {
  return {
    id: raw.id,
    courseId: raw.courseId || PERSONAL_PORTFOLIO_COURSE_ID,
    kind: raw.kind,
    itemId: raw.itemId,
    submissionId: raw.submissionId,
    title: raw.title,
    note: raw.note,
    featuredAt: raw.featuredAt,
    sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : index,
    externalType: raw.externalType,
    url: raw.url,
    fileName: raw.fileName,
    description: raw.description,
  };
}

function readDoc(userId: string): PortfolioDoc {
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return emptyDoc();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        entries: parsed.map((item, i) => normalizeEntry(item, i)),
      };
    }
    if (parsed && typeof parsed === "object") {
      const entries = Array.isArray(parsed.entries)
        ? parsed.entries.map((item: Partial<PortfolioEntry>, i: number) =>
            normalizeEntry(
              item as Partial<PortfolioEntry> & {
                id: string;
                courseId: string;
                kind: PortfolioWorkKind;
                itemId: string;
                title: string;
                featuredAt: number;
              },
              i,
            ),
          )
        : [];
      const skills = Array.isArray(parsed.skills)
        ? parsed.skills.filter((s: unknown): s is string => typeof s === "string" && s.trim() !== "")
        : undefined;
      return {
        headline: typeof parsed.headline === "string" ? parsed.headline : undefined,
        bio: typeof parsed.bio === "string" ? parsed.bio : undefined,
        skills: skills?.length ? skills : undefined,
        entries,
      };
    }
    return emptyDoc();
  } catch {
    return emptyDoc();
  }
}

function saveDoc(userId: string, doc: PortfolioDoc) {
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(doc));
    window.dispatchEvent(new Event(EPORTFOLIO_CHANGED_EVENT));
  } catch {}
}

function sortedEntries(entries: PortfolioEntry[]): PortfolioEntry[] {
  return [...entries].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return b.featuredAt - a.featuredAt;
  });
}

export function loadPortfolioDoc(userId = loadUser().id): PortfolioDoc {
  const doc = readDoc(userId);
  return { ...doc, entries: sortedEntries(doc.entries) };
}

export function loadPortfolio(userId = loadUser().id): PortfolioEntry[] {
  return loadPortfolioDoc(userId).entries;
}

export function updatePortfolioProfile(
  patch: Partial<Pick<PortfolioDoc, "headline" | "bio" | "skills">>,
  userId = loadUser().id,
): PortfolioDoc {
  const doc = readDoc(userId);
  const next: PortfolioDoc = {
    ...doc,
    headline:
      patch.headline !== undefined
        ? patch.headline.trim() || undefined
        : doc.headline,
    bio: patch.bio !== undefined ? patch.bio.trim() || undefined : doc.bio,
    skills:
      patch.skills !== undefined
        ? patch.skills.map((s) => s.trim()).filter(Boolean).slice(0, 20)
        : doc.skills,
  };
  if (next.skills && next.skills.length === 0) delete next.skills;
  saveDoc(userId, next);
  return { ...next, entries: sortedEntries(next.entries) };
}

export function addPortfolioEntry(
  input: {
    courseId: string;
    kind: PortfolioWorkKind;
    itemId: string;
    submissionId?: string;
    title: string;
    note?: string;
    externalType?: PortfolioExternalType;
    url?: string;
    fileName?: string;
    description?: string;
  },
  userId = loadUser().id,
): PortfolioEntry {
  const doc = readDoc(userId);
  const existing = doc.entries;

  if (input.kind !== "external") {
    const duplicate = existing.find(
      (e) =>
        e.courseId === input.courseId &&
        e.kind === input.kind &&
        e.itemId === input.itemId &&
        (e.submissionId ?? "") === (input.submissionId ?? ""),
    );
    if (duplicate) {
      if (input.note != null) {
        const updated = { ...duplicate, note: input.note.trim() || undefined };
        saveDoc(userId, {
          ...doc,
          entries: existing.map((e) => (e.id === duplicate.id ? updated : e)),
        });
        return updated;
      }
      return duplicate;
    }
  }

  const maxOrder = existing.reduce((m, e) => Math.max(m, e.sortOrder), -1);
  const id = uid();
  const entry: PortfolioEntry = {
    id,
    courseId: input.courseId || PERSONAL_PORTFOLIO_COURSE_ID,
    kind: input.kind,
    itemId: input.kind === "external" ? id : input.itemId,
    submissionId: input.submissionId,
    title: input.title.trim(),
    note: input.note?.trim() || undefined,
    featuredAt: Date.now(),
    sortOrder: maxOrder + 1,
    externalType: input.externalType,
    url: input.url?.trim() || undefined,
    fileName: input.fileName,
    description: input.description?.trim() || undefined,
  };
  saveDoc(userId, { ...doc, entries: [...existing, entry] });
  return entry;
}

export async function addExternalPortfolioProject(
  input: {
    title: string;
    externalType: PortfolioExternalType;
    url?: string;
    note?: string;
    description?: string;
    courseId?: string;
    file?: File;
  },
  userId = loadUser().id,
): Promise<{ ok: true; entry: PortfolioEntry } | { ok: false; error: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required" };

  if (input.externalType === "file") {
    if (!input.file) {
      return { ok: false, error: "Choose a file to upload" };
    }
    const entry = addPortfolioEntry(
      {
        courseId: input.courseId || PERSONAL_PORTFOLIO_COURSE_ID,
        kind: "external",
        itemId: "pending",
        title,
        note: input.note,
        description: input.description,
        externalType: "file",
        fileName: input.file.name,
      },
      userId,
    );
    const result = await savePortfolioFileFromUpload(entry.id, input.file);
    if (!result.saved) {
      removePortfolioEntry(entry.id, userId);
      return {
        ok: false,
        error: result.tooLarge ? "File must be under 4MB" : "Could not save file",
      };
    }
    return { ok: true, entry };
  }

  const url = (input.url ?? "").trim();
  if (!url) {
    return { ok: false, error: "URL is required" };
  }
  let normalized = url;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  const entry = addPortfolioEntry(
    {
      courseId: input.courseId || PERSONAL_PORTFOLIO_COURSE_ID,
      kind: "external",
      itemId: "pending",
      title,
      note: input.note,
      description: input.description,
      externalType: input.externalType,
      url: normalized,
    },
    userId,
  );
  return { ok: true, entry };
}

export function updatePortfolioEntry(
  entryId: string,
  patch: Partial<
    Pick<PortfolioEntry, "note" | "title" | "url" | "description" | "externalType" | "courseId">
  >,
  userId = loadUser().id,
): void {
  const doc = readDoc(userId);
  saveDoc(userId, {
    ...doc,
    entries: doc.entries.map((e) => {
      if (e.id !== entryId) return e;
      return {
        ...e,
        ...patch,
        note: patch.note !== undefined ? patch.note.trim() || undefined : e.note,
        title: patch.title !== undefined ? patch.title.trim() || e.title : e.title,
        url: patch.url !== undefined ? patch.url.trim() || undefined : e.url,
        description:
          patch.description !== undefined
            ? patch.description.trim() || undefined
            : e.description,
        courseId: patch.courseId !== undefined ? patch.courseId : e.courseId,
      };
    }),
  });
}

export function removePortfolioEntry(entryId: string, userId = loadUser().id): void {
  const doc = readDoc(userId);
  const entry = doc.entries.find((e) => e.id === entryId);
  if (entry?.kind === "external" && entry.externalType === "file") {
    deletePortfolioFile(entryId);
  }
  saveDoc(userId, {
    ...doc,
    entries: doc.entries.filter((e) => e.id !== entryId),
  });
}

export function movePortfolioEntry(
  entryId: string,
  delta: -1 | 1,
  userId = loadUser().id,
): void {
  const doc = readDoc(userId);
  const ordered = sortedEntries(doc.entries);
  const index = ordered.findIndex((e) => e.id === entryId);
  if (index < 0) return;
  const swapWith = index + delta;
  if (swapWith < 0 || swapWith >= ordered.length) return;

  const a = ordered[index];
  const b = ordered[swapWith];
  const next = doc.entries.map((e) => {
    if (e.id === a.id) return { ...e, sortOrder: b.sortOrder };
    if (e.id === b.id) return { ...e, sortOrder: a.sortOrder };
    return e;
  });
  const reindexed = sortedEntries(next).map((e, i) => ({ ...e, sortOrder: i }));
  saveDoc(userId, { ...doc, entries: reindexed });
}

export function exportPortfolioJson(
  userId = loadUser().id,
  studentMeta?: { id: string; name: string; email?: string },
): string {
  const doc = loadPortfolioDoc(userId);
  const user = loadUser();
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      student: studentMeta ?? { id: user.id, name: user.name, email: user.email },
      headline: doc.headline ?? null,
      bio: doc.bio ?? null,
      skills: doc.skills ?? [],
      entries: doc.entries,
    },
    null,
    2,
  );
}

function assignmentScoreLabel(
  courseId: string,
  assignmentId: string,
  studentId: string,
): string | undefined {
  const sub = getStudentSubmission(courseId, assignmentId, studentId);
  const a = loadAssignments(courseId).find((x) => x.id === assignmentId);
  if (
    !sub ||
    sub.status !== "graded" ||
    typeof sub.score !== "number" ||
    typeof a?.points !== "number"
  ) {
    return undefined;
  }
  if (!isItemGradeVisible(courseId, `assignment:${assignmentId}`, studentId)) {
    return undefined;
  }
  return `${sub.score}/${a.points}`;
}

function quizScoreLabel(
  courseId: string,
  quizId: string,
  studentId: string,
): string | undefined {
  const quiz = getQuizById(courseId, quizId);
  if (!quiz) return undefined;
  const final = getStudentFinalScore(courseId, quiz, studentId);
  if (!final) return undefined;
  const policyAttempt = getScoringPolicyAttempt(courseId, quiz, studentId);
  if (
    !quizShowsScoreToStudent(quiz, {
      courseId,
      studentId,
      attempt: policyAttempt ?? null,
    })
  ) {
    return undefined;
  }
  const score = Math.round(final.score * 10) / 10;
  return `${score}/${final.maxScore}`;
}

export function listStudentWork(userId = loadUser().id): StudentWorkItem[] {
  const items: StudentWorkItem[] = [];

  for (const course of loadCourses()) {
    if (course.archived) continue;

    for (const a of loadAssignments(course.id)) {
      const sub = getStudentSubmission(course.id, a.id, userId);
      if (!sub || sub.status === "missing") continue;
      items.push({
        courseId: course.id,
        courseShortName: course.short_name,
        courseColor: course.color,
        kind: "assignment",
        itemId: a.id,
        submissionId: sub.id,
        title: a.title,
        subtitle: sub.fileName || (sub.body ? "Text submission" : undefined),
        submittedAt: sub.submittedAt,
        path: `/courses/${course.id}/assignments/${a.id}/submission`,
        scoreLabel: assignmentScoreLabel(course.id, a.id, userId),
      });
    }

    for (const q of loadQuizzes(course.id)) {
      const attempts = getStudentAttemptsForQuiz(course.id, q.id, userId);
      if (attempts.length === 0) continue;
      const latest = [...attempts].sort((a, b) => b.submittedAt - a.submittedAt)[0];
      items.push({
        courseId: course.id,
        courseShortName: course.short_name,
        courseColor: course.color,
        kind: "quiz",
        itemId: q.id,
        submissionId: latest.id,
        title: q.title,
        subtitle: `Attempt ${latest.attemptNumber}`,
        submittedAt: latest.submittedAt,
        path: `/courses/${course.id}/quizzes/${q.id}/submission?attempt=${latest.id}`,
        scoreLabel: quizScoreLabel(course.id, q.id, userId),
      });
    }

    for (const t of loadTopics(course.id)) {
      const part = getParticipationForStudent(course.id, t.id, userId);
      if (!part || (part.replyCount <= 0 && part.status !== "graded" && part.status !== "submitted")) {
        continue;
      }
      const scoreLabel =
        part.status === "graded" &&
        typeof part.score === "number" &&
        typeof t.points === "number" &&
        isItemGradeVisible(course.id, `discussion:${t.id}`, userId)
          ? `${part.score}/${t.points}`
          : undefined;
      items.push({
        courseId: course.id,
        courseShortName: course.short_name,
        courseColor: course.color,
        kind: "discussion",
        itemId: t.id,
        submissionId: part.id,
        title: t.title,
        subtitle: part.replyCount > 0 ? `${part.replyCount} replies` : "Participation",
        submittedAt: part.firstPostedAt ?? part.gradedAt ?? Date.now(),
        path: `/courses/${course.id}/discussions/${t.id}`,
        scoreLabel,
      });
    }
  }

  return items.sort((a, b) => b.submittedAt - a.submittedAt);
}

export function portfolioEntryHref(entry: PortfolioEntry): string | null {
  if (entry.kind === "external") {
    if (entry.externalType === "file") return null;
    return entry.url ?? null;
  }
  if (entry.kind === "assignment") {
    return `/courses/${entry.courseId}/assignments/${entry.itemId}/submission`;
  }
  if (entry.kind === "quiz") {
    const q = entry.submissionId ? `?attempt=${entry.submissionId}` : "";
    return `/courses/${entry.courseId}/quizzes/${entry.itemId}/submission${q}`;
  }
  return `/courses/${entry.courseId}/discussions/${entry.itemId}`;
}

/** @deprecated Use portfolioEntryHref */
export function portfolioEntryPath(entry: PortfolioEntry): string {
  return portfolioEntryHref(entry) ?? "#";
}

export function getPortfolioEntryFile(entry: PortfolioEntry): StoredPortfolioFile | null {
  if (entry.kind !== "external" || entry.externalType !== "file") return null;
  return getPortfolioFile(entry.id);
}

export function resolveEntryMeta(
  entry: PortfolioEntry,
  catalog: StudentWorkItem[],
  studentId = loadUser().id,
): { submittedAt?: number; scoreLabel?: string; subtitle?: string } {
  if (entry.kind === "external") {
    return {
      submittedAt: entry.featuredAt,
      subtitle:
        entry.description ||
        entry.fileName ||
        (entry.externalType === "github"
          ? "GitHub"
          : entry.externalType === "website"
            ? "Website"
            : entry.externalType === "file"
              ? "File"
              : "External link"),
    };
  }

  const match = catalog.find(
    (w) =>
      w.courseId === entry.courseId &&
      w.kind === entry.kind &&
      w.itemId === entry.itemId &&
      (entry.submissionId == null || w.submissionId === entry.submissionId),
  );
  if (match) {
    return {
      submittedAt: match.submittedAt,
      scoreLabel: match.scoreLabel,
      subtitle: match.subtitle,
    };
  }
  if (entry.kind === "assignment") {
    return { scoreLabel: assignmentScoreLabel(entry.courseId, entry.itemId, studentId) };
  }
  if (entry.kind === "quiz") {
    return { scoreLabel: quizScoreLabel(entry.courseId, entry.itemId, studentId) };
  }
  return {};
}

export function portfolioStudentHasContent(userId: string): boolean {
  const doc = loadPortfolioDoc(userId);
  return (
    !!doc.headline ||
    !!doc.bio ||
    (doc.skills?.length ?? 0) > 0 ||
    doc.entries.length > 0
  );
}
