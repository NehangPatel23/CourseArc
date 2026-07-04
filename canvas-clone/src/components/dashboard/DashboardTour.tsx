import { useEffect, useState } from "react";
import { X } from "lucide-react";

const TOUR_KEY = "canvasClone:dashboardTourDone";

const STEPS = [
  {
    target: '[data-tour="dashboard"]',
    title: "Welcome to your dashboard",
    body: "This is your home base for courses, deadlines, and quick actions.",
  },
  {
    target: '[data-tour="course-grid"]',
    title: "Your courses",
    body: "Browse, pin, sort, and switch between grid and list views.",
  },
  {
    target: '[data-tour="role-toggle"]',
    title: "Student / Instructor",
    body: "Toggle roles in the sidebar to see different dashboards.",
  },
  {
    target: '[data-tour="nav-search"]',
    title: "Search",
    body: "Search courses here, or press ⌘K for global search across all content.",
  },
];

export default function DashboardTour() {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(TOUR_KEY)) return;
      const t = setTimeout(() => setStep(0), 800);
      return () => clearTimeout(t);
    } catch {}
  }, []);

  if (step < 0 || step >= STEPS.length) return null;

  const current = STEPS[step];

  const finish = () => {
    try {
      window.localStorage.setItem(TOUR_KEY, "1");
    } catch {}
    setStep(-1);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-2 flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-blue">
            Step {step + 1} of {STEPS.length}
          </p>
          <button type="button" onClick={finish} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h3 className="text-lg font-semibold text-canvas-grayDark">{current.title}</h3>
        <p className="mt-2 text-sm text-gray-600">{current.body}</p>
        <div className="mt-4 flex justify-between">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={() => (step >= STEPS.length - 1 ? finish() : setStep(step + 1))}
            className="rounded-lg bg-canvas-blue px-4 py-2 text-sm font-medium text-white"
          >
            {step >= STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
