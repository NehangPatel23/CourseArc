import type { ComponentType } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  GraduationCap,
  LayoutGrid,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { useToast } from "./ui/Toast";
import { useSettings } from "../hooks/useSettings";
import { ACTION_ALERT_KIND_META } from "../utils/actionAlerts";
import {
  ACTION_ALERT_DEFAULTS,
  saveSettings,
  type ActionAlertKind,
  type AppSettings,
} from "../utils/settingsStore";

const KIND_ICONS: {
  id: ActionAlertKind;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "saved", Icon: CheckCircle2 },
  { id: "created", Icon: Plus },
  { id: "deleted", Icon: Trash2 },
  { id: "published", Icon: Send },
  { id: "files", Icon: Upload },
  { id: "grading", Icon: GraduationCap },
  { id: "messages", Icon: MessageSquare },
  { id: "layout", Icon: LayoutGrid },
  { id: "errors", Icon: AlertCircle },
];

export default function ActionAlertsSettings() {
  const settings = useSettings();
  const { showToast } = useToast();

  const patch = (p: Partial<AppSettings>) => {
    saveSettings(p);
    showToast("Settings saved", "positive", "saved");
  };

  const card = "rounded-2xl bg-arc-paper p-6 ring-1 ring-canvas-border/80";

  return (
    <section id="action-alerts" className={card}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-canvas-grayDark">Action alerts</h2>
          <p className="mt-1 text-sm text-gray-600">
            Flash messages after you save, delete, publish, and other actions. Everything is on by default.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="text-xs font-medium text-canvas-blue hover:underline"
            onClick={() => {
              const enabledKind = ACTION_ALERT_KIND_META.find(
                (m) => m.id !== "errors" && settings.actionAlertsEnabled && settings.actionAlerts[m.id] !== false,
              )?.id;
              if (enabledKind) {
                showToast(`Preview: ${ACTION_ALERT_KIND_META.find((m) => m.id === enabledKind)?.title}`, "positive", enabledKind);
                return;
              }
              showToast("Preview: Errors & warnings", "negative");
            }}
          >
            Preview alert
          </button>
          <button
            type="button"
            className="text-xs font-medium text-canvas-blue hover:underline"
            onClick={() =>
              patch({
                actionAlertsEnabled: true,
                actionAlerts: { ...ACTION_ALERT_DEFAULTS },
              })
            }
          >
            Enable all
          </button>
          <button
            type="button"
            className="text-xs font-medium text-gray-500 hover:underline"
            onClick={() =>
              patch({
                actionAlertsEnabled: false,
                actionAlerts: {
                  ...Object.fromEntries(
                    (Object.keys(ACTION_ALERT_DEFAULTS) as ActionAlertKind[]).map((k) => [
                      k,
                      k === "errors",
                    ]),
                  ),
                } as Record<ActionAlertKind, boolean>,
              })
            }
          >
            Disable all
          </button>
        </div>
      </div>
      <div className="mb-4 flex items-start gap-3 rounded-xl bg-canvas-grayLight/60 px-3 py-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas-blueTint text-canvas-blue">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-canvas-grayDark">Show action alerts</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Master switch. Turn off to hide action confirmations. Errors still show.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.actionAlertsEnabled}
          aria-label="Show action alerts"
          onClick={() => patch({ actionAlertsEnabled: !settings.actionAlertsEnabled })}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            settings.actionAlertsEnabled ? "bg-canvas-blue" : "bg-gray-200"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-arc-paper shadow-sm transition-[left] ${
              settings.actionAlertsEnabled ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      </div>
      <div>
        {KIND_ICONS.map((row) => {
          const meta = ACTION_ALERT_KIND_META.find((m) => m.id === row.id)!;
          const on = settings.actionAlerts[row.id] !== false;
          const lockedOff = !settings.actionAlertsEnabled && row.id !== "errors";
          return (
            <div
              key={row.id}
              className={`flex items-start gap-3 py-3 first:pt-0 last:pb-0 ${
                lockedOff ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas-blueTint text-canvas-blue">
                <row.Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-canvas-grayDark">{meta.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{meta.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={meta.title}
                onClick={() =>
                  patch({
                    actionAlerts: { ...settings.actionAlerts, [row.id]: !on },
                  })
                }
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  on ? "bg-canvas-blue" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-arc-paper shadow-sm transition-[left] ${
                    on ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
