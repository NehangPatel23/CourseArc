const PREFIX = "canvasClone:appointmentChatSeen:";

function storageKey(userId: string, slotId: string) {
  return `${PREFIX}${userId}:${slotId}`;
}

export function getAppointmentChatSeenAt(userId: string, slotId: string) {
  try {
    const raw = window.localStorage.getItem(storageKey(userId, slotId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function markAppointmentChatSeen(userId: string, slotId: string, seenAt = Date.now()) {
  try {
    window.localStorage.setItem(storageKey(userId, slotId), String(seenAt));
  } catch {}
}

export function appointmentChatUnreadCount(
  messages: { createdAt: number }[],
  lastSeen: number,
) {
  return messages.filter((m) => m.createdAt > lastSeen).length;
}
