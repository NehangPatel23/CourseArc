function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function icsDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

export function icsAllDay(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

export function escapeIcs(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export function wrapIcsCalendar(prodId: string, vevents: string[]) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${prodId}`, ...vevents, "END:VCALENDAR"].join(
    "\r\n",
  );
}

export function downloadIcsFile(filename: string, content: string) {
  downloadTextFile(filename, content, "text/calendar");
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyIcsToClipboard(content: string) {
  await navigator.clipboard.writeText(content);
}
