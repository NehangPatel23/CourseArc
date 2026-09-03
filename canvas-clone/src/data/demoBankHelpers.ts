import type { QuizQuestion } from "../utils/quizzes";
import { applyAssignedQuestionPoints } from "../utils/questionPointsAgent";
import { demoFeedbackForSuffix, demoIncorrectFeedbackForSuffix } from "./demoQuestionFeedback";

export function mc(
  id: string,
  prompt: string,
  choices: string[],
  correctChoiceIndex: number,
  points = 1,
): QuizQuestion {
  return {
    id,
    type: "multiple_choice",
    prompt,
    points,
    choices,
    correctChoiceIndex,
  };
}

export function ma(
  id: string,
  prompt: string,
  choices: string[],
  correctChoiceIndices: number[],
  points = 2,
): QuizQuestion {
  return {
    id,
    type: "multiple_answers",
    prompt,
    points,
    choices,
    correctChoiceIndices,
  };
}

export function tf(id: string, prompt: string, correctTrueFalse: boolean, points = 1): QuizQuestion {
  return { id, type: "true_false", prompt, points, correctTrueFalse };
}

export function sa(id: string, prompt: string, correctShortAnswer: string, points = 1): QuizQuestion {
  return { id, type: "short_answer", prompt, points, correctShortAnswer };
}

export function fib(id: string, prompt: string, acceptedAnswers: string[], points = 1): QuizQuestion {
  return { id, type: "fill_in_blank", prompt, points, acceptedAnswers };
}

export function num(
  id: string,
  prompt: string,
  correctNumber: number,
  tolerance = 0,
  points = 1,
): QuizQuestion {
  return { id, type: "numerical", prompt, points, correctNumber, tolerance };
}

export function inline(
  id: string,
  prompt: string,
  acceptedAnswers: string[],
  language: QuizQuestion["language"] = "python",
  starterCode = "",
  points = 2,
): QuizQuestion {
  return {
    id,
    type: "inline_code",
    prompt,
    points,
    language,
    acceptedAnswers,
    starterCode,
    codeMaxLines: 8,
  };
}

export function coding(
  id: string,
  prompt: string,
  language: QuizQuestion["language"],
  starterCode: string,
  correctCode: string,
  points = 5,
): QuizQuestion {
  return {
    id,
    type: "coding",
    prompt,
    points,
    language,
    starterCode,
    correctCode,
    autoGradeCode: true,
  };
}

export function essay(id: string, prompt: string, points = 5): QuizQuestion {
  return { id, type: "essay", prompt, points };
}

export function autoFeedback(q: QuizQuestion): string {
  switch (q.type) {
    case "multiple_choice":
      return `Correct choice: “${q.choices?.[q.correctChoiceIndex ?? 0] ?? "—"}”.`;
    case "multiple_answers":
      return `Correct options: ${(q.correctChoiceIndices ?? [])
        .map((i) => q.choices?.[i])
        .filter(Boolean)
        .join("; ")}.`;
    case "true_false":
      return `This statement is ${q.correctTrueFalse ? "true" : "false"}.`;
    case "short_answer":
      return `Expected answer: ${q.correctShortAnswer ?? "—"}.`;
    case "fill_in_blank":
      return `Accepted answers include: ${(q.acceptedAnswers ?? []).join(", ") || "—"}.`;
    case "fill_in_multiple_blanks":
      return `Fill each blank: ${(q.fillBlanks ?? []).map((b) => b.label || b.id).join(", ") || "—"}.`;
    case "ordering":
      return `Correct order: ${(q.correctOrder ?? [])
        .map((i) => q.orderingItems?.[i])
        .filter(Boolean)
        .join(" → ") || (q.orderingItems ?? []).join(" → ") || "—"}.`;
    case "calculated":
      return `Evaluate “${q.calculatedFormula ?? "formula"}” with the generated variables.`;
    case "likert":
      return typeof q.correctLikertValue === "number"
        ? `Target rating: ${q.correctLikertValue}.`
        : "Survey item — responses are aggregated, not graded.";
    case "hotspot":
      return `Select region(s): ${(q.correctHotspotIds ?? []).join(", ") || "see key"}.`;
    case "numerical":
      return `Correct value: ${q.correctNumber}${
        q.tolerance ? ` (±${q.tolerance})` : ""
      }.`;
    case "matching":
      return `Correct pairs: ${(q.matchingPairs ?? [])
        .map((p) => `${p.left} → ${p.right}`)
        .join("; ") || "—"}.`;
    case "essay":
      return "Score for correctness, clarity, and precise use of CS terminology. See the model answer in the feedback below.";
    case "file_upload":
      return "Upload the requested file. Graded manually in GradePro. Compare your file to the model answer in the feedback below.";
    case "inline_code":
      return `Accepted solutions include: ${(q.acceptedAnswers ?? []).slice(0, 2).join(" | ") || "see key"}.`;
    case "coding":
      return "Compare your approach to the reference solution, including edge cases.";
    default:
      return "Review the related course material for this topic.";
  }
}

function defaultPointsForType(type: QuizQuestion["type"]): number {
  switch (type) {
    case "essay":
    case "file_upload":
      return 5;
    case "coding":
      return 5;
    case "matching":
      return 3;
    case "ordering":
    case "fill_in_multiple_blanks":
    case "calculated":
    case "hotspot":
      return 2;
    case "inline_code":
    case "multiple_answers":
      return 2;
    default:
      return 1;
  }
}

function extractDemoSuffix(id: string, courseId: string): string {
  const prefix = "seed_qq_";
  const tail = `_${courseId}`;
  if (!id.startsWith(prefix) || !id.endsWith(tail)) return "";
  return id.slice(prefix.length, id.length - tail.length);
}

/** Ensure every demo question has content-aware points + detailed feedback. */
export function enrichDemoQuestions(
  questions: QuizQuestion[],
  courseId: string,
): QuizQuestion[] {
  const withFeedback = questions.map((q) => {
    const suffix = extractDemoSuffix(q.id, courseId);
    const detailed = suffix ? demoFeedbackForSuffix(suffix) : undefined;
    const incorrect = suffix ? demoIncorrectFeedbackForSuffix(suffix) : undefined;
    return {
      ...q,
      points: q.points > 0 ? q.points : defaultPointsForType(q.type),
      correctFeedback: detailed || q.correctFeedback?.trim() || undefined,
      incorrectFeedback: incorrect || q.incorrectFeedback?.trim() || undefined,
      feedback: detailed || q.feedback?.trim() || autoFeedback(q),
    };
  });
  return applyAssignedQuestionPoints(withFeedback, { overwrite: true });
}
