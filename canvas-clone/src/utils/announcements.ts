// src/utils/announcements.ts
export type AnnouncementStatus = "draft" | "published";

export type Announcement = {
  id: string;
  title: string;
  body?: string; // HTML
  postedAt: number;
  publishedAt?: number;
  status: AnnouncementStatus;
  pinned?: boolean;

  // scheduling / availability
  publishAt?: number; // scheduled publish time (epoch ms)
  availableFrom?: number; // availability window start (epoch ms)
  availableUntil?: number; // availability window end (epoch ms)
};

export type AnnouncementPreview = {
  text: string;
  truncated: boolean;
  containsCode: boolean;
};

/**
 * Returns a text-like preview of HTML, plus flags used by your UI:
 * - truncated: whether we truncated
 * - containsCode: whether <pre> or <code> existed
 */
export function announcementPreview(
  html: string | undefined,
  maxLen = 220,
): AnnouncementPreview {
  if (!html) return { text: "", truncated: false, containsCode: false };

  // ✅ SSR / non-DOM environments (tests) guard
  if (typeof document === "undefined") {
    const containsCode = /<(pre|code)\b/i.test(html);
    const plain = html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (plain.length <= maxLen) {
      return { text: plain, truncated: false, containsCode };
    }
    return {
      text: plain.slice(0, maxLen).trimEnd() + "…",
      truncated: true,
      containsCode,
    };
  }

  let text = "";
  let containsCode = false;

  try {
    const div = document.createElement("div");
    div.innerHTML = html;

    containsCode = !!div.querySelector("pre, code");

    // Keep some structure
    div
      .querySelectorAll("br")
      .forEach((el) => el.insertAdjacentText("afterend", "\n"));
    div
      .querySelectorAll("p, div, li")
      .forEach((el) => el.insertAdjacentText("afterend", "\n"));

    div.querySelectorAll("pre").forEach((el) => {
      el.insertAdjacentText("beforebegin", "\n");
      el.insertAdjacentText("afterend", "\n");
    });

    text = (div.textContent || (div as any).innerText || "").replace(
      /\u00a0/g,
      " ",
    );
  } catch {
    text = html;
  }

  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/^\n+/, "");

  if (text.length <= maxLen) return { text, truncated: false, containsCode };

  const truncatedText = text.slice(0, maxLen).trimEnd().replace(/\n+$/, "");
  return { text: truncatedText + "…", truncated: true, containsCode };
}

/**
 * Parse <input type="datetime-local"> value into epoch ms in LOCAL timezone.
 * Example input: "2026-03-02T14:30"
 *
 * ✅ Hardened: rejects impossible dates (no silent normalization)
 */
export function parseDatetimeLocalToMs(v: string) {
  const s = v.trim();
  if (!s) return undefined;

  const [datePart, timePart] = s.split("T");
  if (!datePart || !timePart) return undefined;

  const [yStr, mStr, dStr] = datePart.split("-");
  const [hhStr, mmStr] = timePart.split(":");

  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const hh = Number(hhStr);
  const mm = Number(mmStr);

  if (![y, m, d, hh, mm].every(Number.isFinite)) return undefined;
  if (m < 1 || m > 12) return undefined;
  if (d < 1 || d > 31) return undefined;
  if (hh < 0 || hh > 23) return undefined;
  if (mm < 0 || mm > 59) return undefined;

  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);

  // round-trip check to catch normalization
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d ||
    dt.getHours() !== hh ||
    dt.getMinutes() !== mm
  ) {
    return undefined;
  }

  const ms = dt.getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * Convert epoch ms to datetime-local string (LOCAL time),
 * e.g. "2026-03-02T14:30"
 */
export function msToDatetimeLocal(ms: number | undefined) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "";
  const d = new Date(ms);

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function isWithinAvailabilityWindow(a: Announcement, now = Date.now()) {
  if (typeof a.availableFrom === "number" && Number.isFinite(a.availableFrom)) {
    if (now < a.availableFrom) return false;
  }
  if (
    typeof a.availableUntil === "number" &&
    Number.isFinite(a.availableUntil)
  ) {
    if (now > a.availableUntil) return false;
  }
  return true;
}

/**
 * Student-visible means:
 * - published
 * - publishedAt (or postedAt) <= now
 * - within availability window
 */
export function isStudentVisibleAnnouncement(
  a: Announcement,
  now = Date.now(),
) {
  if (a.status !== "published") return false;
  const publishedTime = a.publishedAt ?? a.postedAt;
  if (publishedTime > now) return false;
  return isWithinAvailabilityWindow(a, now);
}

export function shouldAutoPublish(a: Announcement, now = Date.now()) {
  return (
    a.status === "draft" &&
    typeof a.publishAt === "number" &&
    Number.isFinite(a.publishAt) &&
    a.publishAt <= now
  );
}

export function autoPublishIfNeeded(
  a: Announcement,
  now = Date.now(),
): Announcement {
  if (!shouldAutoPublish(a, now)) return a;

  return {
    ...a,
    status: "published",
    publishedAt: a.publishAt,
    publishAt: undefined,
  };
}

/** ---------------------------
 * ✅ Storage helpers (single source of truth)
 * --------------------------*/
export function announcementsKey(courseId: string) {
  return `canvasClone:announcements:${courseId}`;
}

export function normalizeAnnouncement(raw: any): Announcement | null {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" ? raw.id : "";
  const title = typeof raw.title === "string" ? raw.title : "";
  const postedAt =
    typeof raw.postedAt === "number" && Number.isFinite(raw.postedAt)
      ? raw.postedAt
      : Date.now();

  if (!id || !title) return null;

  const status: AnnouncementStatus =
    raw.status === "draft" || raw.status === "published"
      ? raw.status
      : raw.published === false
        ? "draft"
        : "published";

  const publishedAt =
    typeof raw.publishedAt === "number" && Number.isFinite(raw.publishedAt)
      ? raw.publishedAt
      : status === "published"
        ? postedAt
        : undefined;

  const publishAt =
    typeof raw.publishAt === "number" && Number.isFinite(raw.publishAt)
      ? raw.publishAt
      : undefined;

  const availableFrom =
    typeof raw.availableFrom === "number" && Number.isFinite(raw.availableFrom)
      ? raw.availableFrom
      : undefined;

  const availableUntil =
    typeof raw.availableUntil === "number" &&
    Number.isFinite(raw.availableUntil)
      ? raw.availableUntil
      : undefined;

  return {
    id,
    title,
    body:
      typeof raw.body === "string" && raw.body.trim() ? raw.body : undefined,
    postedAt,
    publishedAt,
    status,
    pinned: typeof raw.pinned === "boolean" ? raw.pinned : undefined,
    publishAt,
    availableFrom,
    availableUntil,
  };
}

export function dedupeById(items: Announcement[]) {
  const seen = new Set<string>();
  const out: Announcement[] = [];
  for (const a of items) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

export function loadAnnouncements(courseId: string): Announcement[] {
  try {
    const raw = window.localStorage.getItem(announcementsKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];

    const normalized = arr
      .map(normalizeAnnouncement)
      .filter((x): x is Announcement => !!x);

    // auto-publish on read
    const now = Date.now();
    return dedupeById(normalized).map((a) => autoPublishIfNeeded(a, now));
  } catch {
    return [];
  }
}

export function saveAnnouncements(courseId: string, items: Announcement[]) {
  try {
    const deduped = dedupeById(items);
    window.localStorage.setItem(
      announcementsKey(courseId),
      JSON.stringify(deduped),
    );
    window.dispatchEvent(new Event("canvasClone:announcementsChanged"));
  } catch {
    // no-op
  }
}
