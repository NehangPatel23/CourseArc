/** Estimate localStorage usage in bytes. */
export function estimateLocalStorageBytes(): { used: number; quota: number } {
  let used = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const val = window.localStorage.getItem(key) ?? "";
      used += key.length + val.length;
    }
  } catch {}
  return { used: used * 2, quota: 5 * 1024 * 1024 };
}

export function formatStorageUsage(): string {
  const { used, quota } = estimateLocalStorageBytes();
  const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${mb(used)} of ~${mb(quota)}`;
}

export function isStorageNearQuota(): boolean {
  const { used, quota } = estimateLocalStorageBytes();
  return used / quota > 0.8;
}

export function downloadSettingsBackup() {
  const dump: Record<string, string> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("canvasClone:")) continue;
      dump[key] = window.localStorage.getItem(key) ?? "";
    }
  } catch {}
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "coursearc-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}
