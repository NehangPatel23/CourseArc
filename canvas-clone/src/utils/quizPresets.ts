import type { Quiz, QuizType } from "./quizzes";

export type QuizPresetId = "exam" | "practice" | "survey";

export const QUIZ_PRESET_LABELS: Record<QuizPresetId, string> = {
  exam: "Exam",
  practice: "Practice",
  survey: "Survey",
};

/** One-click settings bundles for common quiz modes (#59). */
export function applyQuizPreset(base: Partial<Quiz>, preset: QuizPresetId): Partial<Quiz> {
  switch (preset) {
    case "exam":
      return {
        ...base,
        quizType: "graded" satisfies QuizType,
        timeLimitMinutes: base.timeLimitMinutes ?? 60,
        shuffleQuestions: true,
        shuffleAnswers: true,
        allowMultipleAttempts: false,
        lockOnLeave: true,
        maxLeaveCount: 3,
        warnOnLeave: true,
        requireFullscreen: false,
        showCorrectAnswers: false,
        letStudentsSeeResponses: true,
        partialCredit: true,
        collectSeatNumber: false,
      };
    case "practice":
      return {
        ...base,
        quizType: "practice" satisfies QuizType,
        timeLimitMinutes: undefined,
        shuffleQuestions: false,
        shuffleAnswers: false,
        allowMultipleAttempts: true,
        allowedAttempts: undefined,
        scoringPolicy: "highest",
        lockOnLeave: false,
        maxLeaveCount: undefined,
        warnOnLeave: false,
        requireFullscreen: false,
        showCorrectAnswers: true,
        letStudentsSeeResponses: true,
        practiceInstantFeedback: true,
        practiceRetakeWrongOnly: false,
        practiceScorePreview: true,
      };
    case "survey":
      return {
        ...base,
        quizType: "survey" satisfies QuizType,
        timeLimitMinutes: undefined,
        shuffleQuestions: false,
        shuffleAnswers: false,
        allowMultipleAttempts: false,
        lockOnLeave: false,
        showCorrectAnswers: false,
        letStudentsSeeResponses: true,
        anonymousGrading: false,
        partialCredit: false,
        points: undefined,
      };
    default:
      return base;
  }
}
