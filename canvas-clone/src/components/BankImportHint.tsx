import { useId, useState } from "react";
import { Info } from "lucide-react";

/**
 * Compact import-format help behind an info control (avoids a long gray wall of text).
 */
export default function BankImportHint({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`relative inline-flex items-start gap-1.5 ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-canvas-blue hover:bg-canvas-blueTint"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        Import formats
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          className="absolute left-0 top-full z-20 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-canvas-border bg-white p-3 text-left shadow-lg"
        >
          <p className="text-xs font-semibold text-canvas-grayDark">Supported imports</p>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-gray-600">
            <li>
              <span className="font-medium text-canvas-grayDark">JSON</span>
              {" — "}
              <code className="rounded bg-gray-100 px-1">{`{ title, questions }`}</code> or a
              question array
            </li>
            <li>
              <span className="font-medium text-canvas-grayDark">CSV</span>
              {" — "}
              columns{" "}
              <code className="rounded bg-gray-100 px-1">
                type, prompt, points, answer, choices, language, starterCode, feedback,
                correct_feedback, incorrect_feedback
              </code>
              ; use <code className="rounded bg-gray-100 px-1">|</code> to separate choices
            </li>
            <li>
              <span className="font-medium text-canvas-grayDark">Markdown</span>
              {" — "}
              <code className="rounded bg-gray-100 px-1">## prompt</code> plus{" "}
              <code className="rounded bg-gray-100 px-1">type:</code> /{" "}
              <code className="rounded bg-gray-100 px-1">answer:</code> /{" "}
              <code className="rounded bg-gray-100 px-1">points:</code> /{" "}
              <code className="rounded bg-gray-100 px-1">correct_feedback:</code> /{" "}
              <code className="rounded bg-gray-100 px-1">incorrect_feedback:</code> /{" "}
              <code className="rounded bg-gray-100 px-1">feedback:</code> lines
            </li>
            <li>
              <span className="font-medium text-canvas-grayDark">QTI 1.2 / Moodle XML</span>
              {" — "}
              <code className="rounded bg-gray-100 px-1">.xml</code> exports (multiple choice,
              multi-answer, true/false, short answer, essay)
            </li>
            <li>
              <span className="font-medium text-canvas-grayDark">Aiken</span>
              {" — "}
              <code className="rounded bg-gray-100 px-1">.txt</code> with prompt lines,{" "}
              <code className="rounded bg-gray-100 px-1">A.</code> choices, and{" "}
              <code className="rounded bg-gray-100 px-1">ANSWER: B</code>
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">
            Types include multiple choice, short answer, essay, inline code, coding, and more.
            Feedback can use sections: Answer / Why / Common mistake / Takeaway. Prefer
            correct/incorrect feedback; general feedback is the fallback.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 text-[11px] font-medium text-canvas-blue hover:underline"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
