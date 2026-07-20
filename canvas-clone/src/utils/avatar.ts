export const AVATAR_COLORS = [
  "#008EE2",
  "#27AE60",
  "#E74C3C",
  "#9B59B6",
  "#F39C12",
  "#1ABC9C",
  "#E67E22",
  "#34495E",
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number] | string;

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

/** Deterministic color from an id string. */
export function avatarColorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

export type AvatarProps = {
  name: string;
  initials?: string;
  color?: string;
  imageUrl?: string | null;
  /** Built-in doodle face id (used when no imageUrl). */
  doodleId?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  ring?: boolean;
};
