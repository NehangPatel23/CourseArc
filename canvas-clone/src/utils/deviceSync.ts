import { recordAudit } from "./auditLog";

const CHANNEL = "canvasClone:deviceSync";
const META_KEY = "canvasClone:syncMeta";
const DEVICE_ID_KEY = "canvasClone:deviceId";
const DEVICE_NAME_KEY = "canvasClone:deviceName";
const ROOM_KEY = "canvasClone:syncRoomId";
const LAST_PULL_KEY = "canvasClone:syncLastPull";
const LAST_PUSH_KEY = "canvasClone:syncLastPush";
const CONFLICTS_KEY = "canvasClone:syncConflicts";

export const DEVICE_SYNC_CHANGED_EVENT = "canvasClone:deviceSyncChanged";
export const DEVICE_SYNC_APPLIED_EVENT = "canvasClone:syncApplied";

const SKIP_KEYS = new Set([
  META_KEY,
  DEVICE_ID_KEY,
  DEVICE_NAME_KEY,
  ROOM_KEY,
  LAST_PULL_KEY,
  LAST_PUSH_KEY,
  CONFLICTS_KEY,
  "canvasClone:session",
]);

const JSONBLOB = "https://jsonblob.com/api/jsonBlob";
const MAX_VALUE_BYTES = 350_000;

export type SyncStamp = {
  updatedAt: number;
  deviceId: string;
  hash: string;
};

export type SyncConflict = {
  id: string;
  key: string;
  local: SyncStamp & { preview: string };
  remote: SyncStamp & { preview: string };
  remoteValue: string;
  at: number;
};

type WireMessage = {
  type: "set" | "remove";
  key: string;
  value?: string | null;
  stamp: SyncStamp;
};

type RoomSnapshot = {
  version: 1;
  pushedAt: number;
  deviceId: string;
  deviceName: string;
  entries: Record<string, { value: string; stamp: SyncStamp }>;
};

let applyingRemote = false;
let origSet: typeof localStorage.setItem | null = null;
let origRemove: typeof localStorage.removeItem | null = null;
let channel: BroadcastChannel | null = null;
let pollTimer: number | null = null;
let started = false;

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function notify() {
  window.dispatchEvent(new Event(DEVICE_SYNC_CHANGED_EVENT));
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSetRaw(key: string, value: string) {
  (origSet ?? localStorage.setItem.bind(localStorage))(key, value);
}

function shouldTrack(key: string) {
  return key.startsWith("canvasClone:") && !SKIP_KEYS.has(key);
}

export function getDeviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      lsSetRaw(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "dev_unknown";
  }
}

export function getDeviceName(): string {
  try {
    const saved = window.localStorage.getItem(DEVICE_NAME_KEY);
    if (saved?.trim()) return saved.trim();
  } catch {}
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Win/i.test(ua)) return "Windows";
  return "This browser";
}

export function setDeviceName(name: string) {
  lsSetRaw(DEVICE_NAME_KEY, name.trim() || getDeviceName());
  notify();
}

export function getSyncRoomId(): string | null {
  try {
    return window.localStorage.getItem(ROOM_KEY);
  } catch {
    return null;
  }
}

export function setSyncRoomId(id: string | null) {
  if (!id) {
    try {
      window.localStorage.removeItem(ROOM_KEY);
    } catch {}
  } else {
    lsSetRaw(ROOM_KEY, id.trim());
  }
  notify();
}

export function getLastPushAt(): number | null {
  const n = Number(window.localStorage.getItem(LAST_PUSH_KEY) ?? "");
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getLastPullAt(): number | null {
  const n = Number(window.localStorage.getItem(LAST_PULL_KEY) ?? "");
  return Number.isFinite(n) && n > 0 ? n : null;
}

function loadMeta(): Record<string, SyncStamp> {
  return lsGet<Record<string, SyncStamp>>(META_KEY, {});
}

function saveMeta(meta: Record<string, SyncStamp>) {
  lsSetRaw(META_KEY, JSON.stringify(meta));
}

function stampKey(key: string, value: string): SyncStamp {
  const stamp: SyncStamp = {
    updatedAt: Date.now(),
    deviceId: getDeviceId(),
    hash: djb2(value),
  };
  const meta = loadMeta();
  meta[key] = stamp;
  saveMeta(meta);
  return stamp;
}

function preview(value: string | null | undefined): string {
  if (!value) return "(empty)";
  const trimmed = value.length > 80 ? `${value.slice(0, 80)}…` : value;
  return trimmed.replace(/\s+/g, " ");
}

export function loadConflicts(): SyncConflict[] {
  return lsGet<SyncConflict[]>(CONFLICTS_KEY, []);
}

function saveConflicts(rows: SyncConflict[]) {
  lsSetRaw(CONFLICTS_KEY, JSON.stringify(rows.slice(0, 50)));
  notify();
}

function addConflict(row: Omit<SyncConflict, "id" | "at">) {
  const next: SyncConflict = {
    ...row,
    id: `cf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
  };
  const existing = loadConflicts().filter((c) => c.key !== row.key);
  saveConflicts([next, ...existing]);
}

function post(msg: WireMessage) {
  try {
    channel?.postMessage(msg);
  } catch {}
}

function applyIncoming(msg: WireMessage, opts?: { recordConflicts?: boolean }): "applied" | "kept" | "conflict" | "skip" {
  if (!shouldTrack(msg.key)) return "skip";
  const meta = loadMeta();
  const local = meta[msg.key];
  if (local && local.hash === msg.stamp.hash && local.updatedAt === msg.stamp.updatedAt) return "skip";
  if (local && local.updatedAt > msg.stamp.updatedAt) {
    if (opts?.recordConflicts && local.hash !== msg.stamp.hash) {
      addConflict({
        key: msg.key,
        local: { ...local, preview: preview(window.localStorage.getItem(msg.key)) },
        remote: { ...msg.stamp, preview: preview(msg.value ?? "") },
        remoteValue: msg.value ?? "",
      });
      return "conflict";
    }
    return "kept";
  }
  applyingRemote = true;
  try {
    if (msg.type === "remove" || msg.value == null) {
      (origRemove ?? localStorage.removeItem.bind(localStorage))(msg.key);
      const next = loadMeta();
      delete next[msg.key];
      saveMeta(next);
    } else {
      lsSetRaw(msg.key, msg.value);
      const next = loadMeta();
      next[msg.key] = msg.stamp;
      saveMeta(next);
    }
  } finally {
    applyingRemote = false;
  }
  window.dispatchEvent(new Event(DEVICE_SYNC_APPLIED_EVENT));
  return "applied";
}

function collectSnapshot(): RoomSnapshot {
  const meta = loadMeta();
  const entries: RoomSnapshot["entries"] = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !shouldTrack(key)) continue;
    const value = window.localStorage.getItem(key);
    if (value == null) continue;
    if (value.length > MAX_VALUE_BYTES) continue;
    entries[key] = {
      value,
      stamp: meta[key] ?? {
        updatedAt: Date.now(),
        deviceId: getDeviceId(),
        hash: djb2(value),
      },
    };
  }
  return {
    version: 1,
    pushedAt: Date.now(),
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
    entries,
  };
}

export async function createSyncRoom(): Promise<string> {
  const snap = collectSnapshot();
  const res = await fetch(JSONBLOB, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(snap),
  });
  if (!res.ok) throw new Error("Could not create a sync room (network blocked or jsonblob is down).");
  const loc = res.headers.get("Location") || res.url;
  const id = loc.split("/").pop()?.trim();
  if (!id) throw new Error("Sync room created but no id was returned.");
  setSyncRoomId(id);
  lsSetRaw(LAST_PUSH_KEY, String(Date.now()));
  notify();
  return id;
}

export async function pushSyncRoom(): Promise<void> {
  const id = getSyncRoomId();
  if (!id) throw new Error("Join or create a room first.");
  const snap = collectSnapshot();
  const res = await fetch(`${JSONBLOB}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(snap),
  });
  if (!res.ok) throw new Error("Push failed. Check the room id and try again.");
  lsSetRaw(LAST_PUSH_KEY, String(Date.now()));
  notify();
}

export async function pullSyncRoom(): Promise<{ applied: number; conflicts: number }> {
  const id = getSyncRoomId();
  if (!id) throw new Error("Join or create a room first.");
  const res = await fetch(`${JSONBLOB}/${id}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Pull failed. Check the room id.");
  const snap = (await res.json()) as RoomSnapshot;
  if (!snap?.entries || snap.version !== 1) throw new Error("Unexpected sync payload.");
  let applied = 0;
  let conflicts = 0;
  for (const [key, row] of Object.entries(snap.entries)) {
    const result = applyIncoming(
      { type: "set", key, value: row.value, stamp: row.stamp },
      { recordConflicts: true },
    );
    if (result === "applied") applied += 1;
    if (result === "conflict") conflicts += 1;
  }
  lsSetRaw(LAST_PULL_KEY, String(Date.now()));
  notify();
  if (applied > 0) {
    recordAudit({
      action: "sync_import",
      summary: `Pulled ${applied} key${applied === 1 ? "" : "s"} from sync room`,
      detail: conflicts ? `${conflicts} conflict(s) kept local-newer` : undefined,
    });
  }
  return { applied, conflicts };
}

export function resolveConflict(id: string, take: "local" | "remote") {
  const rows = loadConflicts();
  const row = rows.find((c) => c.id === id);
  if (!row) return;
  if (take === "remote") {
    applyIncoming(
      {
        type: "set",
        key: row.key,
        value: row.remoteValue,
        stamp: row.remote,
      },
      { recordConflicts: false },
    );
  }
  saveConflicts(rows.filter((c) => c.id !== id));
  recordAudit({
    action: "sync_conflict_resolved",
    summary: `Resolved sync conflict on ${row.key.replace("canvasClone:", "")}`,
    detail: take === "local" ? "Kept this device" : "Took the other device's value",
  });
}

export function dismissConflict(id: string) {
  saveConflicts(loadConflicts().filter((c) => c.id !== id));
}

export function exportSyncSnapshot(): string {
  return JSON.stringify(collectSnapshot(), null, 2);
}

export function importSyncSnapshot(json: string): { applied: number; conflicts: number } {
  const snap = JSON.parse(json) as RoomSnapshot;
  if (!snap?.entries) throw new Error("Not a CourseArc sync snapshot.");
  let applied = 0;
  let conflicts = 0;
  for (const [key, row] of Object.entries(snap.entries)) {
    const result = applyIncoming(
      { type: "set", key, value: row.value, stamp: row.stamp },
      { recordConflicts: true },
    );
    if (result === "applied") applied += 1;
    if (result === "conflict") conflicts += 1;
  }
  recordAudit({
    action: "sync_import",
    summary: `Imported snapshot (${applied} applied)`,
    detail: conflicts ? `${conflicts} conflict(s)` : undefined,
  });
  window.dispatchEvent(new Event(DEVICE_SYNC_APPLIED_EVENT));
  return { applied, conflicts };
}

export function startDeviceSync() {
  if (typeof window === "undefined" || started) return;
  started = true;
  origSet = localStorage.setItem.bind(localStorage);
  origRemove = localStorage.removeItem.bind(localStorage);

  localStorage.setItem = (key: string, value: string) => {
    origSet!(key, value);
    if (applyingRemote || !shouldTrack(key)) return;
    const stamp = stampKey(key, value);
    post({ type: "set", key, value, stamp });
  };
  localStorage.removeItem = (key: string) => {
    origRemove!(key);
    if (applyingRemote || !shouldTrack(key)) return;
    const meta = loadMeta();
    delete meta[key];
    saveMeta(meta);
    post({
      type: "remove",
      key,
      stamp: { updatedAt: Date.now(), deviceId: getDeviceId(), hash: "" },
    });
  };

  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (ev: MessageEvent<WireMessage>) => {
      if (!ev.data?.key || ev.data.stamp?.deviceId === getDeviceId()) return;
      applyIncoming(ev.data, { recordConflicts: true });
    };
  } catch {
    channel = null;
  }

  window.addEventListener("storage", (e) => {
    if (!e.key || !shouldTrack(e.key) || applyingRemote) return;
    // Other-tab localStorage writes already applied the value; refresh UI.
    window.dispatchEvent(new Event(DEVICE_SYNC_APPLIED_EVENT));
  });

  const tick = () => {
    if (document.visibilityState !== "visible") return;
    if (!getSyncRoomId()) return;
    void pullSyncRoom().catch(() => {});
  };
  pollTimer = window.setInterval(tick, 20_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });
}

export function stopDeviceSyncForTests() {
  started = false;
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = null;
  try {
    channel?.close();
  } catch {}
  channel = null;
}
