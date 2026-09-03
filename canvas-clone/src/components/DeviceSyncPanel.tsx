import { useEffect, useState } from "react";
import { useToast } from "./ui/Toast";
import type { ActionAlertKind } from "../utils/settingsStore";
import {
  createSyncRoom,
  DEVICE_SYNC_CHANGED_EVENT,
  dismissConflict,
  exportSyncSnapshot,
  getDeviceId,
  getDeviceName,
  getLastPullAt,
  getLastPushAt,
  getSyncRoomId,
  importSyncSnapshot,
  loadConflicts,
  pullSyncRoom,
  pushSyncRoom,
  resolveConflict,
  setDeviceName,
  setSyncRoomId,
} from "../utils/deviceSync";

function when(ts: number | null) {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString();
}

export default function DeviceSyncPanel() {
  const { showToast } = useToast();
  const [, setTick] = useState(0);
  const [name, setName] = useState(getDeviceName());
  const [roomDraft, setRoomDraft] = useState(getSyncRoomId() ?? "");
  const [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    const refresh = () => {
      setTick((n) => n + 1);
      setRoomDraft(getSyncRoomId() ?? "");
    };
    window.addEventListener(DEVICE_SYNC_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(DEVICE_SYNC_CHANGED_EVENT, refresh);
  }, []);

  const conflicts = loadConflicts();
  const roomId = getSyncRoomId();

  const run = async (fn: () => Promise<void>, ok: string, kind: ActionAlertKind = "saved") => {
    setBusy(true);
    try {
      await fn();
      showToast(ok, "positive", kind);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sync failed", "negative");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-arc-mute">
        Same-browser tabs stay in sync automatically (BroadcastChannel + last-write-wins). To sync a
        laptop and a phone, create a room, then enter the same room id on the other device and Pull /
        Push. Conflicts appear when both devices wrote different values.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="form-label">Device name</span>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setDeviceName(name)}
          />
        </label>
        <div>
          <span className="form-label">Device id</span>
          <p className="mt-2 font-mono text-xs text-arc-mute">{getDeviceId()}</p>
        </div>
      </div>
      <div>
        <span className="form-label">Sync room id</span>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            className="form-input min-w-[12rem] flex-1"
            value={roomDraft}
            onChange={(e) => setRoomDraft(e.target.value)}
            placeholder="Paste a room id from another device"
          />
          <button
            type="button"
            className="rounded-md border border-arc-line px-3 py-2"
            disabled={busy}
            onClick={() => {
              setSyncRoomId(roomDraft.trim() || null);
              showToast(roomDraft.trim() ? "Room saved" : "Left room", "positive", "saved");
            }}
          >
            Join
          </button>
          <button
            type="button"
            className="rounded-md border border-arc-line bg-arc-ink px-3 py-2 text-arc-paper"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const id = await createSyncRoom();
                setRoomDraft(id);
              }, "Room created — enter this id on your other device", "created")
            }
          >
            Create room
          </button>
        </div>
        {roomId && <p className="mt-1 text-xs text-arc-mute">Active room: {roomId}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-arc-line px-3 py-2"
          disabled={busy || !roomId}
          onClick={() => void run(async () => { await pushSyncRoom(); }, "Pushed this browser to the room")}
        >
          Push this device
        </button>
        <button
          type="button"
          className="rounded-md border border-arc-line px-3 py-2"
          disabled={busy || !roomId}
          onClick={() =>
            void run(async () => {
              const r = await pullSyncRoom();
              showToast(
                `Applied ${r.applied}; ${r.conflicts} conflict(s)`,
                r.conflicts ? "neutral" : "positive",
                "saved",
              );
            }, "Pulled from room")
          }
        >
          Pull other devices
        </button>
      </div>
      <p className="text-xs text-arc-mute">
        Last push: {when(getLastPushAt())} · Last pull: {when(getLastPullAt())}
      </p>

      {conflicts.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <h3 className="font-medium text-amber-950">Conflicts ({conflicts.length})</h3>
          <ul className="mt-2 space-y-3">
            {conflicts.map((c) => (
              <li key={c.id} className="text-xs">
                <p className="font-mono text-amber-950">{c.key.replace("canvasClone:", "")}</p>
                <p className="mt-1 text-amber-900">This device: {c.local.preview}</p>
                <p className="text-amber-900">Other: {c.remote.preview}</p>
                <div className="mt-1 flex gap-2">
                  <button type="button" className="underline" onClick={() => resolveConflict(c.id, "local")}>
                    Keep mine
                  </button>
                  <button type="button" className="underline" onClick={() => resolveConflict(c.id, "remote")}>
                    Take theirs
                  </button>
                  <button type="button" className="text-arc-mute underline" onClick={() => dismissConflict(c.id)}>
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="rounded-lg border border-arc-line bg-arc-ivory p-3">
        <summary className="cursor-pointer font-medium">File backup (works offline)</summary>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            className="rounded-md border border-arc-line px-3 py-2"
            onClick={() => {
              const blob = new Blob([exportSyncSnapshot()], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `coursearc-sync-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download snapshot
          </button>
          <textarea
            className="form-input min-h-[88px] font-mono text-xs"
            placeholder="Paste a snapshot JSON to import…"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <button
            type="button"
            className="rounded-md border border-arc-line px-3 py-2"
            disabled={!importText.trim()}
            onClick={() => {
              try {
                const r = importSyncSnapshot(importText);
                showToast(`Imported ${r.applied} keys (${r.conflicts} conflicts)`, "positive", "files");
                setImportText("");
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Import failed", "negative");
              }
            }}
          >
            Import snapshot
          </button>
        </div>
      </details>
    </div>
  );
}
