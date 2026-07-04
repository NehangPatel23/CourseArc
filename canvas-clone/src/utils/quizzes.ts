import {
  formatAssignmentDueDate,
  formatAvailabilityColumn,
  isAssignmentClosedToStudents,
  isAssignmentNotYetAvailable,
  isStudentViewableAssignment,
  type Assignment,
} from "./assignments";

export type QuizQuestionType =
  | "multiple_choice"
  | "multiple_answers"
  | "true_false"
  | "short_answer"
  | "fill_in_blank"
  | "numerical"
  | "matching"
  | "essay";

export type MatchingPair = { id: string; left: string; right: string };

/** How the "score that counts" is chosen across multiple attempts. */
export type QuizScoringPolicy =
  | "latest"
  | "highest"
  | "lowest"
  | "average"
  | "first";

export const QUIZ_SCORING_POLICY_LABELS: Record<QuizScoringPolicy, string> = {
  latest: "Latest attempt",
  highest: "Highest score",
  lowest: "Lowest score",
  average: "Average of all attempts",
  first: "First attempt",
};

export function getQuizScoringPolicy(
  quiz: Pick<Quiz, "scoringPolicy">,
): QuizScoringPolicy {
  return quiz.scoringPolicy ?? "highest";
}

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  points: number;
  /** multiple_choice + multiple_answers */
  choices?: string[];
  /** multiple_choice */
  correctChoiceIndex?: number;
  /** multiple_answers */
  correctChoiceIndices?: number[];
  /** true_false */
  correctTrueFalse?: boolean;
  /** short_answer */
  correctShortAnswer?: string;
  /** fill_in_blank — any accepted answer counts as correct */
  acceptedAnswers?: string[];
  /** numerical */
  correctNumber?: number;
  tolerance?: number;
  /** matching */
  matchingPairs?: MatchingPair[];
  /** Instructor note shown to students after the quiz is graded. */
  feedback?: string;
};

export type Quiz = {
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
  timeLimitMinutes?: number;
  questionCount?: number;
  questions?: QuizQuestion[];
  shuffleAnswers?: boolean;
  allowMultipleAttempts?: boolean;
  allowedAttempts?: number;
  /** Which attempt's score counts when multiple attempts are allowed. */
  scoringPolicy?: QuizScoringPolicy;
  /** Whether students may see their own responses after submitting (default true). */
  letStudentsSeeResponses?: boolean;
  /** When true, responses are only viewable once immediately after each attempt. */
  showResponsesOnlyOnce?: boolean;
  /** Whether students may see the correct answers (default true). */
  showCorrectAnswers?: boolean;
  /** Only reveal correct answers on/after this time. */
  showCorrectAnswersAt?: number;
  /** Stop revealing correct answers after this time. */
  hideCorrectAnswersAt?: number;
  createdAt?: number;
  updatedAt?: number;
};

/** Whether the student may see their own responses in the review. */
export function quizShowsResponses(quiz: Quiz): boolean {
  return quiz.letStudentsSeeResponses !== false;
}

/** Whether the correct-answer key may be revealed to students right now. */
export function quizShowsCorrectAnswers(quiz: Quiz, now = Date.now()): boolean {
  if (quiz.showCorrectAnswers === false) return false;
  if (typeof quiz.showCorrectAnswersAt === "number" && now < quiz.showCorrectAnswersAt) {
    return false;
  }
  if (typeof quiz.hideCorrectAnswersAt === "number" && now > quiz.hideCorrectAnswersAt) {
    return false;
  }
  return true;
}

export function createMatchingPair(): MatchingPair {
  return { id: uid("mp"), left: "", right: "" };
}

export function createQuizQuestion(type: QuizQuestionType): QuizQuestion {
  const base: QuizQuestion = { id: uid("qq"), type, prompt: "", points: 1 };
  switch (type) {
    case "multiple_choice":
      return { ...base, choices: ["", "", "", ""], correctChoiceIndex: 0 };
    case "multiple_answers":
      return { ...base, choices: ["", "", "", ""], correctChoiceIndices: [] };
    case "true_false":
      return { ...base, correctTrueFalse: true };
    case "short_answer":
      return { ...base, correctShortAnswer: "" };
    case "fill_in_blank":
      return { ...base, acceptedAnswers: [""] };
    case "numerical":
      return { ...base, correctNumber: 0, tolerance: 0 };
    case "matching":
      return { ...base, matchingPairs: [createMatchingPair(), createMatchingPair()] };
    case "essay":
      return { ...base };
    default:
      return base;
  }
}

export function normalizeQuizQuestions(questions?: QuizQuestion[]): QuizQuestion[] {
  return Array.isArray(questions) ? questions : [];
}

export function getQuizQuestionCount(quiz: Pick<Quiz, "questions" | "questionCount">): number {
  const fromQuestions = quiz.questions?.length ?? 0;
  return fromQuestions > 0 ? fromQuestions : quiz.questionCount ?? 0;
}

export function totalQuizQuestionPoints(questions: QuizQuestion[] = []): number {
  return questions.reduce((sum, q) => sum + (q.points > 0 ? q.points : 0), 0);
}

export const QUIZ_QUESTION_TYPE_LABELS: Record<QuizQuestionType, string> = {
  multiple_choice: "Multiple choice",
  multiple_answers: "Multiple answers",
  true_false: "True / False",
  short_answer: "Short answer",
  fill_in_blank: "Fill in the blank",
  numerical: "Numerical",
  matching: "Matching",
  essay: "Essay",
};

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });
}

export function quizzesKey(courseId: string) {
  return `canvasClone:quizzes:${courseId}`;
}

export { formatAssignmentDueDate as formatQuizDueDate, formatAvailabilityColumn };

export function formatTimeLimit(minutes?: number): string | null {
  if (minutes == null || minutes <= 0) return null;
  return `${minutes} min`;
}

/** Canvas-style time limit label, e.g. "10 Minutes". */
export function formatTimeLimitDisplay(minutes?: number): string | null {
  if (minutes == null || minutes <= 0) return null;
  return `${minutes} Minute${minutes === 1 ? "" : "s"}`;
}

/** Canvas-style datetime, e.g. "Jan 13, 2022 at 12:20pm". */
export function formatQuizDateTime(ts: number): string {
  return formatAssignmentDueDate(ts).replace(" by ", " at ");
}

export function formatQuizAvailabilityRange(
  quiz: Pick<Quiz, "availableFrom" | "availableUntil">,
): string | null {
  const { availableFrom, availableUntil } = quiz;
  if (typeof availableFrom === "number" && typeof availableUntil === "number") {
    return `${formatQuizDateTime(availableFrom)} - ${formatQuizDateTime(availableUntil)}`;
  }
  if (typeof availableFrom === "number") {
    return `from ${formatQuizDateTime(availableFrom)}`;
  }
  if (typeof availableUntil === "number") {
    return `until ${formatQuizDateTime(availableUntil)}`;
  }
  return null;
}

export function getQuizAllowedAttemptsLabel(quiz: Pick<Quiz, "allowMultipleAttempts" | "allowedAttempts">): string {
  if (quiz.allowMultipleAttempts) {
    const n = quiz.allowedAttempts;
    if (typeof n === "number" && n > 0) return String(n);
    return "Unlimited";
  }
  return "1";
}

export function getQuizLockedAt(quiz: Quiz, now = Date.now()): number | null {
  // Only an elapsed "available until" date locks a quiz. A past due date alone
  // does not lock it (late attempts stay allowed when no window is set).
  if (typeof quiz.availableUntil === "number" && quiz.availableUntil < now) {
    return quiz.availableUntil;
  }
  return null;
}

export function canStudentTakeQuiz(quiz: Quiz, now = Date.now()): boolean {
  if (!isStudentViewableQuiz(quiz, now)) return false;
  if (isQuizNotYetAvailable(quiz, now)) return false;
  if (typeof quiz.availableUntil === "number" && quiz.availableUntil < now) return false;
  return getQuizQuestionCount(quiz) > 0;
}

function asAssignmentLike(q: Quiz): Assignment {
  return q as unknown as Assignment;
}

export function isStudentViewableQuiz(q: Quiz, now = Date.now()) {
  return isStudentViewableAssignment(asAssignmentLike(q), now);
}

export function isQuizNotYetAvailable(q: Quiz, now = Date.now()) {
  return isAssignmentNotYetAvailable(asAssignmentLike(q), now);
}

export function isQuizClosedToStudents(q: Quiz, now = Date.now()) {
  return isAssignmentClosedToStudents(asAssignmentLike(q), now);
}

function seedQuizQuestions(): QuizQuestion[] {
  return [
    {
      id: "seed_qq_1",
      type: "multiple_choice",
      prompt: "What is the time complexity of binary search on a sorted array?",
      points: 2,
      choices: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
      correctChoiceIndex: 1,
    },
    {
      id: "seed_qq_2",
      type: "true_false",
      prompt: "Merge sort is a stable sorting algorithm.",
      points: 1,
      correctTrueFalse: true,
    },
    {
      id: "seed_qq_3",
      type: "short_answer",
      prompt: "Name one advantage of using a hash table.",
      points: 2,
      correctShortAnswer: "O(1) average lookup",
    },
  ];
}

function seedQuizzes(courseId: string): Quiz[] {
  const now = Date.now();
  const week1Questions = seedQuizQuestions();
  return [
    {
      id: `seed_quiz1_${courseId}`,
      title: "Week 1 Knowledge Check",
      dueAt: now + 7 * 86400000,
      points: totalQuizQuestionPoints(week1Questions),
      timeLimitMinutes: 30,
      questionCount: week1Questions.length,
      questions: week1Questions,
      published: true,
      status: "published",
      description: "<p>Covers material from the first week of lectures.</p>",
      shuffleAnswers: true,
      allowMultipleAttempts: true,
      allowedAttempts: 2,
      createdAt: now - 86400000 * 3,
    },
    {
      id: `seed_quiz_past_${courseId}`,
      title: "Midterm Review Quiz",
      dueAt: now - 30 * 86400000,
      points: 20,
      timeLimitMinutes: 45,
      questionCount: 10,
      published: true,
      status: "published",
      description: "<p>Practice quiz for the midterm exam.</p>",
      createdAt: now - 86400000 * 45,
    },
    {
      id: `seed_quiz_draft_${courseId}`,
      title: "Final Exam (draft)",
      dueAt: now + 60 * 86400000,
      points: 100,
      timeLimitMinutes: 120,
      questionCount: 25,
      published: false,
      status: "draft",
      description: "<p>Comprehensive final — not yet visible to students.</p>",
      createdAt: now - 86400000,
    },
  ];
}

function ensureDemoQuizzes(courseId: string, items: Quiz[]): Quiz[] {
  const publishedSeeds = seedQuizzes(courseId).filter((q) => q.status === "published" || q.published);
  const ids = new Set(items.map((q) => q.id));
  const missing = publishedSeeds.filter((q) => !ids.has(q.id));
  if (missing.length === 0) return items;
  return dedupeById([...missing, ...items]);
}

export function loadQuizzes(courseId: string): Quiz[] {
  try {
    const raw = window.localStorage.getItem(quizzesKey(courseId));
    if (!raw) {
      const seed = seedQuizzes(courseId);
      saveQuizzes(courseId, seed);
      return seed;
    }
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    const deduped = dedupeById(arr);
    const merged = ensureDemoQuizzes(courseId, deduped);
    if (merged.length !== deduped.length) {
      saveQuizzes(courseId, merged);
    }
    return merged;
  } catch {
    return seedQuizzes(courseId);
  }
}

export function saveQuizzes(courseId: string, items: Quiz[]) {
  try {
    window.localStorage.setItem(quizzesKey(courseId), JSON.stringify(dedupeById(items)));
    window.dispatchEvent(new Event("canvasClone:quizzesChanged"));
  } catch {}
}

export function getQuizById(courseId: string, quizId: string): Quiz | undefined {
  return loadQuizzes(courseId).find((q) => q.id === quizId);
}

export function autoPublishQuiz(q: Quiz, now = Date.now()): Quiz {
  if (q.status !== "draft" || !q.publishAt || q.publishAt > now) return q;
  return {
    ...q,
    status: "published",
    published: true,
    publishAt: undefined,
    updatedAt: now,
  };
}

export function duplicateQuiz(q: Quiz): Quiz {
  const now = Date.now();
  const questions = normalizeQuizQuestions(q.questions).map((question) => ({
    ...question,
    id: uid("qq"),
  }));
  return {
    ...q,
    id: uid("quiz"),
    title: `${q.title} (copy)`,
    status: "draft",
    published: false,
    publishAt: undefined,
    questions,
    questionCount: questions.length,
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
