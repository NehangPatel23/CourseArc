import { useEffect, useState } from "react";
import { loadSettings } from "./settingsStore";

export type QuizLocale = "en" | "es";

export const QUIZ_LOCALE_LABELS: Record<QuizLocale, string> = {
  en: "English",
  es: "Español (demo)",
};

const STORAGE_KEY = "canvasClone:quizLocale";

const STRINGS: Record<QuizLocale, Record<string, string>> = {
  en: {
    "take.submit": "Submit Quiz",
    "take.submitSurvey": "Submit Survey",
    "take.submitting": "Submitting…",
    "take.saveExit": "Save & exit",
    "take.timeLeft": "Time left",
    "take.returnToQuiz": "Return to quiz",
    "take.youLeftTab": "You left this tab",
    "take.runTests": "Run tests",
    "take.running": "Running…",
    "take.unanswered": "Unanswered",
    "take.markedForReview": "Marked for review",
    "take.confirmSubmit": "Submit quiz?",
    "take.quizNotFound": "Quiz not found.",
    "take.lastQuestion": "Last question — submit when ready",
    "take.nextQuestion": "Next question",
    "take.previous": "Previous",
    "take.checkAnswers": "Check answers",
    "take.previewResponses": "Preview responses",
    "onboarding.title": "First quiz checklist",
    "onboarding.dismiss": "Dismiss checklist",
  },
  es: {
    "take.submit": "Entregar examen",
    "take.submitSurvey": "Entregar encuesta",
    "take.submitting": "Entregando…",
    "take.saveExit": "Guardar y salir",
    "take.timeLeft": "Tiempo restante",
    "take.returnToQuiz": "Volver al examen",
    "take.youLeftTab": "Saliste de esta pestaña",
    "take.runTests": "Ejecutar pruebas",
    "take.running": "Ejecutando…",
    "take.unanswered": "Sin responder",
    "take.markedForReview": "Marcada para revisar",
    "take.confirmSubmit": "¿Entregar examen?",
    "take.quizNotFound": "Examen no encontrado.",
    "take.lastQuestion": "Última pregunta — entrega cuando estés listo",
    "take.nextQuestion": "Siguiente pregunta",
    "take.previous": "Anterior",
    "take.checkAnswers": "Comprobar respuestas",
    "take.previewResponses": "Vista previa de respuestas",
    "onboarding.title": "Lista del primer examen",
    "onboarding.dismiss": "Ocultar lista",
  },
};

export function readQuizLocale(): QuizLocale {
  try {
    const fromSettings = loadSettings().quizLocale;
    if (fromSettings === "en" || fromSettings === "es") return fromSettings;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "es") return "es";
  } catch {}
  return "en";
}

export function writeQuizLocale(locale: QuizLocale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
    window.dispatchEvent(new Event("canvasClone:quizLocaleChanged"));
  } catch {}
}

export function quizT(key: string, locale?: QuizLocale): string {
  const loc = locale ?? readQuizLocale();
  return STRINGS[loc][key] ?? STRINGS.en[key] ?? key;
}

/** Quiz UI strings — switches when Settings locale changes (#156). */
export function useQuizT(): (key: string) => string {
  const [locale, setLocale] = useState<QuizLocale>(() => readQuizLocale());

  useEffect(() => {
    const sync = () => setLocale(readQuizLocale());
    window.addEventListener("canvasClone:settingsChanged", sync);
    window.addEventListener("canvasClone:quizLocaleChanged", sync);
    return () => {
      window.removeEventListener("canvasClone:settingsChanged", sync);
      window.removeEventListener("canvasClone:quizLocaleChanged", sync);
    };
  }, []);

  return (key: string) => quizT(key, locale);
}
