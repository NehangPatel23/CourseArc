import { loadQuizzes } from "./quizzes";

const KEY = (courseId: string) => `canvasClone:quizOnboarding:${courseId}`;

export type QuizOnboardingStepId =
  | "title"
  | "questions"
  | "availability"
  | "preview"
  | "publish";

export type QuizOnboardingStep = {
  id: QuizOnboardingStepId;
  label: string;
  done: boolean;
};

export function isQuizOnboardingDismissed(courseId: string): boolean {
  try {
    return window.localStorage.getItem(KEY(courseId)) === "dismissed";
  } catch {
    return false;
  }
}

export function dismissQuizOnboarding(courseId: string) {
  try {
    window.localStorage.setItem(KEY(courseId), "dismissed");
    window.dispatchEvent(new Event("canvasClone:quizOnboardingChanged"));
  } catch {}
}

export function buildQuizOnboardingSteps(
  courseId: string,
  quiz: {
    title?: string;
    questions?: { type: string }[];
    dueAt?: number;
    availableFrom?: number;
    availableUntil?: number;
    published?: boolean;
    status?: string;
  },
): QuizOnboardingStep[] {
  const questions = quiz.questions ?? [];
  const scored = questions.filter((q) => q.type !== "note" && q.type !== "group");
  const hasTitle = Boolean((quiz.title ?? "").trim() && quiz.title!.trim() !== "Untitled quiz");
  const hasAvailability =
    typeof quiz.dueAt === "number" ||
    typeof quiz.availableFrom === "number" ||
    typeof quiz.availableUntil === "number";
  const published = quiz.published || quiz.status === "published";

  return [
    { id: "title", label: "Give the quiz a descriptive title", done: hasTitle },
    { id: "questions", label: "Add at least one scored question", done: scored.length > 0 },
    { id: "availability", label: "Set a due date or availability window", done: hasAvailability },
    {
      id: "preview",
      label: "Preview as a student before publishing",
      done: isQuizOnboardingDismissed(courseId) || published,
    },
    { id: "publish", label: "Publish when you are ready", done: published },
  ];
}

export function shouldShowQuizOnboarding(courseId: string, quizId?: string): boolean {
  if (isQuizOnboardingDismissed(courseId)) return false;
  const quizzes = loadQuizzes(courseId).filter((q) => !q.deletedAt);
  if (quizzes.length === 0) return true;
  if (quizId && quizzes.length === 1 && quizzes[0]?.id === quizId) return true;
  return false;
}
