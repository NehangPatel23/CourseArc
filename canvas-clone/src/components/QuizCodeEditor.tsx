import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { editor as MonacoEditorNs } from "monaco-editor";
import type { CodeLanguage } from "../utils/quizzes";

const MonacoEditor = lazy(() => import("./MonacoQuizEditor"));

type Props = {
  value: string;
  onChange: (value: string) => void;
  language?: CodeLanguage | string;
  disabled?: boolean;
  minHeight?: number;
  className?: string;
  placeholder?: string;
  useMonaco: boolean;
  /** Optional header actions (e.g. snippet chips) rendered in the chrome bar. */
  headerActions?: ReactNode;
  /** Hide the built-in language label when the parent already shows one. */
  hideLanguageLabel?: boolean;
};

function monacoLanguage(language?: string): string {
  switch (language) {
    case "cpp":
      return "cpp";
    case "c":
      return "c";
    case "html":
      return "html";
    case "css":
      return "css";
    case "sql":
      return "sql";
    case "python":
      return "python";
    case "java":
      return "java";
    case "typescript":
      return "typescript";
    case "javascript":
      return "javascript";
    default:
      return "plaintext";
  }
}

function languageLabel(language?: string): string | null {
  if (!language || language === "other") return null;
  const map: Record<string, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    python: "Python",
    java: "Java",
    c: "C",
    cpp: "C++",
    html: "HTML",
    css: "CSS",
    sql: "SQL",
  };
  return map[language] ?? language;
}

const MONO_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

const HEIGHT_MIN = 120;
const HEIGHT_MAX = 720;

export default function QuizCodeEditor({
  value,
  onChange,
  language,
  disabled,
  minHeight = 200,
  className = "",
  placeholder,
  useMonaco,
  headerActions,
  hideLanguageLabel = false,
}: Props) {
  const lang = useMemo(() => monacoLanguage(language), [language]);
  const label = hideLanguageLabel ? null : languageLabel(language);
  const [focused, setFocused] = useState(false);
  const showPlaceholder = Boolean(placeholder && !value.trim());
  const editorRef = useRef<MonacoEditorNs.IStandaloneCodeEditor | null>(null);
  const pathId = useId().replace(/:/g, "");
  const [editorHeight, setEditorHeight] = useState(() =>
    Math.max(HEIGHT_MIN, minHeight - 40),
  );
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    setEditorHeight((h) => Math.max(h, Math.max(HEIGHT_MIN, minHeight - 40)));
  }, [minHeight]);

  // Keep Monaco model in sync when parent value changes (starter seed, template insert, etc.).
  useEffect(() => {
    if (!useMonaco) return;
    const ed = editorRef.current;
    if (!ed) return;
    if (ed.getValue() === value) return;
    const pos = ed.getPosition();
    ed.setValue(value);
    if (pos) ed.setPosition(pos);
  }, [value, useMonaco]);

  useEffect(() => {
    editorRef.current?.layout();
  }, [editorHeight]);

  const onResizePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: editorHeight };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const delta = e.clientY - dragRef.current.startY;
    const next = Math.min(
      HEIGHT_MAX,
      Math.max(HEIGHT_MIN, dragRef.current.startH + delta),
    );
    setEditorHeight(next);
  };

  const onResizePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const chrome = (label || headerActions || useMonaco) && (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-arc-ink/10 bg-arc-paper px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {label ? (
          <span className="rounded bg-arc-copper/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-arc-copper">
            {label}
          </span>
        ) : null}
        {useMonaco ? (
          <span className="text-[10px] font-medium uppercase tracking-wider text-arc-mute">
            Monaco
          </span>
        ) : (
          <span className="text-[10px] font-medium uppercase tracking-wider text-arc-mute">
            Plain text
          </span>
        )}
      </div>
      {headerActions ? (
        <div className="flex flex-wrap items-center gap-1.5">{headerActions}</div>
      ) : null}
    </div>
  );

  const resizeHandle = (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize code editor"
      tabIndex={0}
      onPointerDown={onResizePointerDown}
      onPointerMove={onResizePointerMove}
      onPointerUp={onResizePointerUp}
      onPointerCancel={onResizePointerUp}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setEditorHeight((h) => Math.max(HEIGHT_MIN, h - 24));
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setEditorHeight((h) => Math.min(HEIGHT_MAX, h + 24));
        }
      }}
      className="flex h-3 cursor-ns-resize items-center justify-center border-t border-arc-ink/10 bg-arc-paper hover:bg-arc-ivory"
    >
      <span className="h-1 w-8 rounded-full bg-arc-ink/20" aria-hidden />
    </div>
  );

  const panelClass = `overflow-hidden border bg-arc-ivory transition-[box-shadow,border-color] ${
    focused
      ? "border-arc-copper ring-2 ring-arc-copper/20"
      : "border-arc-ink/15"
  } ${disabled ? "opacity-70" : ""} ${className}`;

  if (!useMonaco) {
    return (
      <div className={panelClass}>
        {chrome}
        <textarea
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          spellCheck={false}
          className="block w-full resize-none border-0 bg-arc-ivory px-3 py-3 font-mono text-[13px] leading-relaxed text-arc-ink outline-none placeholder:text-arc-mute disabled:bg-arc-paper"
          style={{ fontFamily: MONO_FONT, height: editorHeight }}
        />
        {resizeHandle}
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className={panelClass}>
          {chrome}
          <div
            className="flex items-center justify-center bg-arc-ivory text-xs text-arc-mute"
            style={{ height: editorHeight }}
          >
            Loading code editor…
          </div>
          {resizeHandle}
        </div>
      }
    >
      <div
        className={panelClass}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
        }}
      >
        {chrome}
        <div className="relative bg-arc-ivory" style={{ height: editorHeight }}>
          {showPlaceholder && (
            <div
              className="pointer-events-none absolute left-[58px] top-[14px] z-10 text-[13px] text-gray-400"
              style={{ fontFamily: MONO_FONT }}
            >
              {placeholder}
            </div>
          )}
          <MonacoEditor
            height={editorHeight}
            language={lang}
            path={`inmemory://quiz-code/${pathId}/${lang}`}
            value={value}
            theme="vs"
            loading={
              <div
                className="flex items-center justify-center text-xs text-gray-500"
                style={{ height: editorHeight }}
              >
                Loading code editor…
              </div>
            }
            options={{
              readOnly: Boolean(disabled),
              minimap: { enabled: false },
              fontSize: 13,
              lineHeight: 21,
              fontFamily: MONO_FONT,
              lineNumbers: "on",
              lineNumbersMinChars: 3,
              glyphMargin: false,
              folding: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
              tabSize: 2,
              renderLineHighlight: "line",
              matchBrackets: "near",
              bracketPairColorization: { enabled: true },
              padding: { top: 12, bottom: 12 },
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
                useShadows: false,
              },
              fixedOverflowWidgets: true,
            }}
            onMount={(ed) => {
              editorRef.current = ed;
              if (ed.getValue() !== value) ed.setValue(value);
            }}
            onChange={(v) => {
              if (!disabled) onChange(v ?? "");
            }}
          />
        </div>
        {resizeHandle}
      </div>
    </Suspense>
  );
}
