export type AssignmentSubmissionType =
  | "none"
  | "online_text"
  | "online_upload"
  | "online_text_upload";

export type Assignment = {
  id: string;
  title: string;
  dueAt?: number;
  points?: number;
  published?: boolean;
  description?: string;
  status?: "draft" | "published";
  publishAt?: number;
  availableFrom?: number;
  availableUntil?: number;
  submissionType?: AssignmentSubmissionType;
  allowLateSubmissions?: boolean;
  allowResubmissions?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });
}

export function assignmentsKey(courseId: string) {
  return `canvasClone:assignments:${courseId}`;
}

export function formatAssignmentDueDate(ts: number): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;
  return `${date} by ${hour12}:${minutes}${ampm}`;
}

export function hasAvailabilityWindow(item: {
  availableFrom?: number;
  availableUntil?: number;
}): boolean {
  return typeof item.availableFrom === "number" || typeof item.availableUntil === "number";
}

export function formatAvailabilitySummary(item: {
  availableFrom?: number;
  availableUntil?: number;
}): string | null {
  const parts: string[] = [];
  if (typeof item.availableFrom === "number") {
    parts.push(`Available from ${formatAssignmentDueDate(item.availableFrom)}`);
  }
  if (typeof item.availableUntil === "number") {
    parts.push(`Available until ${formatAssignmentDueDate(item.availableUntil)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Compact availability lines for table columns. */
export function formatAvailabilityColumn(item: {
  availableFrom?: number;
  availableUntil?: number;
}): string[] {
  const lines: string[] = [];
  if (typeof item.availableFrom === "number") {
    lines.push(`From ${formatAssignmentDueDate(item.availableFrom)}`);
  }
  if (typeof item.availableUntil === "number") {
    lines.push(`Until ${formatAssignmentDueDate(item.availableUntil)}`);
  }
  return lines;
}

export function formatSubmissionTypeLabel(type?: AssignmentSubmissionType): string {
  switch (type) {
    case "online_upload":
      return "a file upload";
    case "online_text":
      return "an online text entry";
    case "online_text_upload":
      return "an online text entry or a file upload";
    case "none":
      return "nothing (on paper)";
    default:
      return "online";
  }
}

function majorAssignmentDescription(): string {
  return `
<p>Begin by reviewing course materials related to your chosen topic. You will write a set of instructions that explains how to complete a task for a specific audience.</p>
<h3><strong>Content</strong></h3>
<p>Pick something that you can realistically explain in a few pages. Your instructions should be clear enough that someone unfamiliar with the task could follow them.</p>
<h3><strong>Required Elements</strong></h3>
<ul>
<li>A precise title that reflects the task and audience</li>
<li>An introduction and conclusion</li>
<li>Numbered steps with enough detail for a novice reader</li>
<li>Visual aids or diagrams where they improve clarity</li>
<li>A troubleshooting or FAQ section for common mistakes</li>
</ul>
<h3><strong>Source Use</strong></h3>
<p>If you reference outside sources, cite them in <a href="#">IEEE style</a>. Reach out to me if you need help choosing a topic.</p>
<h3><strong>Sample Instructions</strong></h3>
<p>See the course modules for examples of effective technical instructions from prior terms.</p>
`.trim();
}

function seedAssignments(courseId: string): Assignment[] {
  const now = Date.now();
  const majorDue = new Date("2023-09-24T23:59:00").getTime();
  return [
    {
      id: `seed_major1_${courseId}`,
      title: "Major Assignment #1: Instructions",
      dueAt: majorDue,
      points: 150,
      published: true,
      status: "published",
      description: majorAssignmentDescription(),
      submissionType: "online_upload",
      allowLateSubmissions: true,
      allowResubmissions: true,
      createdAt: now - 86400000 * 30,
    },
    {
      id: `seed_lab_${courseId}`,
      title: "Lab Exercise",
      dueAt: now + 14 * 86400000,
      points: 50,
      published: true,
      status: "published",
      description: "<p>Hands-on lab applying course concepts.</p>",
      submissionType: "online_text_upload",
      allowLateSubmissions: false,
      createdAt: now - 86400000 * 2,
    },
    {
      id: `seed_draft_${courseId}`,
      title: "Midterm (draft)",
      dueAt: now + 30 * 86400000,
      points: 200,
      published: false,
      status: "draft",
      description: "<p>Draft midterm — not yet visible to students.</p>",
      submissionType: "online_text",
      createdAt: now - 86400000,
    },
  ];
}

function ensureDemoAssignments(courseId: string, items: Assignment[]): Assignment[] {
  const publishedSeeds = seedAssignments(courseId).filter(
    (a) => a.status === "published" || a.published,
  );
  const ids = new Set(items.map((a) => a.id));
  const missing = publishedSeeds.filter((a) => !ids.has(a.id));
  if (missing.length === 0) return items;
  return dedupeById([...missing, ...items]);
}

export function loadAssignments(courseId: string): Assignment[] {
  try {
    const raw = window.localStorage.getItem(assignmentsKey(courseId));
    if (!raw) {
      const seed = seedAssignments(courseId);
      saveAssignments(courseId, seed);
      return seed;
    }
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    const deduped = dedupeById(arr);
    const merged = ensureDemoAssignments(courseId, deduped);
    if (merged.length !== deduped.length) {
      saveAssignments(courseId, merged);
    }
    return merged;
  } catch {
    return seedAssignments(courseId);
  }
}

export function saveAssignments(courseId: string, items: Assignment[]) {
  try {
    window.localStorage.setItem(assignmentsKey(courseId), JSON.stringify(dedupeById(items)));
    window.dispatchEvent(new Event("canvasClone:assignmentsChanged"));
  } catch {}
}

export function getAssignmentById(courseId: string, assignmentId: string): Assignment | undefined {
  return loadAssignments(courseId).find((a) => a.id === assignmentId);
}

export function autoPublishAssignment(a: Assignment, now = Date.now()): Assignment {
  if (a.status !== "draft" || !a.publishAt || a.publishAt > now) return a;
  return {
    ...a,
    status: "published",
    published: true,
    publishAt: undefined,
    updatedAt: now,
  };
}

export function isStudentPublishedAssignment(a: Assignment): boolean {
  if (a.status === "draft") return false;
  return a.status === "published" || a.published === true;
}

/** Students can open any published assignment in the list (including upcoming or past). */
export function isStudentViewableAssignment(a: Assignment, now = Date.now()): boolean {
  if (!isStudentPublishedAssignment(a)) return false;
  if (typeof a.publishAt === "number" && a.publishAt > now) return false;
  return true;
}

export function isAssignmentNotYetAvailable(a: Assignment, now = Date.now()): boolean {
  return typeof a.availableFrom === "number" && a.availableFrom > now;
}

export function isAssignmentClosedToStudents(a: Assignment, now = Date.now()): boolean {
  // An assignment is only "closed" once its availability window ends. A past due
  // date alone does not lock it (late submissions stay allowed).
  return typeof a.availableUntil === "number" && a.availableUntil < now;
}

/** Assignment is within its active availability window (excludes past availability end). */
export function isStudentVisibleAssignment(a: Assignment, now = Date.now()): boolean {
  if (!isStudentViewableAssignment(a, now)) return false;
  if (isAssignmentNotYetAvailable(a, now)) return false;
  if (typeof a.availableUntil === "number" && a.availableUntil < now) return false;
  return true;
}

export function isAssignmentPastDue(a: Assignment, now = Date.now()): boolean {
  return typeof a.dueAt === "number" && a.dueAt < now;
}

export function canStudentSubmit(a: Assignment, now = Date.now()): boolean {
  if (!isStudentViewableAssignment(a, now)) return false;
  if (isAssignmentNotYetAvailable(a, now)) return false;
  // Only an elapsed "available until" date locks submissions. A past due date
  // does not lock; when no availability window is set, late submissions are
  // always allowed.
  if (typeof a.availableUntil === "number" && a.availableUntil < now) return false;
  if (a.submissionType === "none") return false;
  return true;
}

export function duplicateAssignment(a: Assignment): Assignment {
  const now = Date.now();
  return {
    ...a,
    id: uid("asg"),
    title: `${a.title} (copy)`,
    status: "draft",
    published: false,
    publishAt: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}
