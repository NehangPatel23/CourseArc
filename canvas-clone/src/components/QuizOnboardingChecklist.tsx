import { useEffect, useState } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";
import {
  buildQuizOnboardingSteps,
  dismissQuizOnboarding,
  type QuizOnboardingStep,
} from "../utils/quizOnboarding";
import { useQuizT } from "../utils/quizI18n";
import type { Quiz } from "../utils/quizzes";

type Props = {
  courseId: string;
  quiz: Quiz;
};

export default function QuizOnboardingChecklist({ courseId, quiz }: Props) {
  const t = useQuizT();
  const [steps, setSteps] = useState<QuizOnboardingStep[]>(() =>
    buildQuizOnboardingSteps(courseId, quiz),
  );

  useEffect(() => {
    const refresh = () => setSteps(buildQuizOnboardingSteps(courseId, quiz));
    refresh();
    window.addEventListener("canvasClone:quizOnboardingChanged", refresh);
    window.addEventListener("canvasClone:quizzesChanged", refresh);
    return () => {
      window.removeEventListener("canvasClone:quizOnboardingChanged", refresh);
      window.removeEventListener("canvasClone:quizzesChanged", refresh);
    };
  }, [courseId, quiz]);

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  return (
    <div className="mb-6 rounded-xl border border-canvas-blue/25 bg-canvas-blueTint/40 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-canvas-blue">{t("onboarding.title")}</h2>
          <p className="mt-1 text-xs text-gray-600">
            Complete these steps before your first publish.
          </p>
        </div>
        <button
          type="button"
          onClick={() => dismissQuizOnboarding(courseId)}
          className="rounded-md p-1 text-gray-500 hover:bg-white/60 hover:text-gray-700"
          aria-label={t("onboarding.dismiss")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-canvas-green" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            )}
            <span className={step.done ? "text-gray-600" : "text-canvas-grayDark"}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
