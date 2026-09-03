import { loadSettings, type ActionAlertKind } from "./settingsStore";

export type ToastTone = "positive" | "negative" | "neutral";

export const ACTION_ALERT_KIND_META: {
  id: ActionAlertKind;
  title: string;
  description: string;
}[] = [
  {
    id: "saved",
    title: "Saves & updates",
    description: "Saved, renamed, updated, and similar confirmations.",
  },
  {
    id: "created",
    title: "Creates & adds",
    description: "New items, duplicates, restores, and things added to a list.",
  },
  {
    id: "deleted",
    title: "Deletes & removals",
    description: "Deleted, removed, cleared, and discarded items.",
  },
  {
    id: "published",
    title: "Publish & availability",
    description: "Published, unpublished, scheduled, posted, or hidden.",
  },
  {
    id: "files",
    title: "Uploads & exports",
    description: "Uploads, imports, downloads, attachments, and exports.",
  },
  {
    id: "grading",
    title: "Grading & completion",
    description: "Grades, comments, feedback, attendance, and mark-as-done.",
  },
  {
    id: "messages",
    title: "Messages & replies",
    description: "Inbox, discussion replies, stars, archive, and notification list actions.",
  },
  {
    id: "layout",
    title: "Layout & pins",
    description: "Dashboard/home layout, course pins, nicknames, and navigation tweaks.",
  },
  {
    id: "errors",
    title: "Errors & warnings",
    description: "Failed actions and validation. These always show, even if action alerts are off.",
  },
];

/** Parse (tone, kind) or a bare kind with default positive tone. Negative toasts are always `errors`. */
export function resolveActionAlert(
  toneOrKind?: ToastTone | ActionAlertKind,
  kind?: ActionAlertKind,
): { tone: ToastTone; kind: ActionAlertKind } {
  if (toneOrKind === "negative") {
    return { tone: "negative", kind: kind ?? "errors" };
  }
  if (toneOrKind === "positive" || toneOrKind === "neutral") {
    return { tone: toneOrKind, kind: kind ?? "saved" };
  }
  if (toneOrKind) {
    return { tone: "positive", kind: toneOrKind };
  }
  return { tone: "positive", kind: kind ?? "saved" };
}

export function shouldShowActionAlert(
  kind: ActionAlertKind,
  settings = loadSettings(),
): boolean {
  if (kind === "errors") return settings.actionAlerts.errors !== false;
  if (!settings.actionAlertsEnabled) return false;
  return settings.actionAlerts[kind] !== false;
}
