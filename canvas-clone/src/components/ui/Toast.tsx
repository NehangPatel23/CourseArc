import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "positive" | "negative" | "neutral";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_MS = 3600;
const MAX_TOASTS = 3;

const toneStyles: Record<
  ToastTone,
  { card: string; iconWrap: string; bar: string; Icon: typeof CheckCircle2 }
> = {
  positive: {
    card: "border-emerald-100",
    iconWrap: "bg-emerald-50 text-emerald-600",
    bar: "bg-emerald-500",
    Icon: CheckCircle2,
  },
  negative: {
    card: "border-red-100",
    iconWrap: "bg-red-50 text-red-600",
    bar: "bg-red-500",
    Icon: AlertCircle,
  },
  neutral: {
    card: "border-canvas-border",
    iconWrap: "bg-canvas-blueTint text-canvas-blue",
    bar: "bg-canvas-blue",
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, number>());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "neutral") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, message, tone }]);
      const timer = window.setTimeout(() => dismiss(id), TOAST_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(100%-2.5rem,22rem)] flex-col gap-2.5"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((t) => {
          const { card, iconWrap, bar, Icon } = toneStyles[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto animate-toastIn overflow-hidden rounded-2xl border bg-white shadow-canvas-hover ${card}`}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconWrap}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </span>
                <p className="min-w-0 flex-1 pt-1 text-sm font-medium leading-5 text-canvas-grayDark">
                  {t.message}
                </p>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </div>
              <div className="h-0.5 w-full bg-gray-100">
                <div
                  className={`h-full origin-left ${bar} animate-toastProgress`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
