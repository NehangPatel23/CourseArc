export const DOODLE_AVATAR_IDS = [
  "smile",
  "glasses",
  "curly",
  "beanie",
  "headphones",
  "sparkle",
  "cool",
  "wink",
] as const;

export type DoodleAvatarId = (typeof DOODLE_AVATAR_IDS)[number];

export const DOODLE_AVATAR_LABELS: Record<DoodleAvatarId, string> = {
  smile: "Smile",
  glasses: "Glasses",
  curly: "Curly",
  beanie: "Beanie",
  headphones: "Headphones",
  sparkle: "Sparkle",
  cool: "Cool",
  wink: "Wink",
};

export function isDoodleAvatarId(value: unknown): value is DoodleAvatarId {
  return typeof value === "string" && (DOODLE_AVATAR_IDS as readonly string[]).includes(value);
}

/** Soft background colors paired with each doodle. */
export const DOODLE_BG: Record<DoodleAvatarId, string> = {
  smile: "#FDE68A",
  glasses: "#BFDBFE",
  curly: "#FBCFE8",
  beanie: "#BBF7D0",
  headphones: "#DDD6FE",
  sparkle: "#FED7AA",
  cool: "#A5F3FC",
  wink: "#FECACA",
};
