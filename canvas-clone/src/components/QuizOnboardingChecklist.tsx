import { useEffect, useState } from "react";
import Icon from "../icons/Icon";
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
    <div className="mb-6 border border-arc-copper/25 bg-arc-copper/5 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-arc-copper">{t("onboarding.title")}</h2>
          <p className="mt-1 text-xs text-arc-mute">
            Complete these steps before your first publish.
          </p>
        </div>
        <button
          type="button"
          onClick={() => dismissQuizOnboarding(courseId)}
          className="rounded-md p-1 text-arc-mute hover:bg-arc-ivory hover:text-arc-ink"
          aria-label={t("onboarding.dismiss")}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            {step.done ? (
              <Icon name="checkCircle" size={16} className="text-canvas-green" />
            ) : (
              <Icon name="circle" size={16} className="text-gray-400" />
            )}
            <span className={step.done ? "text-arc-mute" : "text-arc-ink"}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
