import DoodleAvatarFace from "./DoodleAvatarFace";
import {
  avatarColorForId,
  initialsFromName,
  type AvatarProps,
} from "../utils/avatar";
import { isDoodleAvatarId } from "../utils/avatarDoodles";

const sizeClass = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
} as const;

export default function UserAvatar({
  name,
  initials,
  color,
  imageUrl,
  doodleId,
  size = "md",
  className = "",
  ring = false,
}: AvatarProps) {
  const label = (initials?.trim() || initialsFromName(name)).slice(0, 2).toUpperCase();
  const bg = color || avatarColorForId(name);
  const ringClass = ring ? "ring-2 ring-white/15" : "";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        title={name}
        className={`${sizeClass[size]} shrink-0 rounded-full object-cover ${ringClass} ${className}`}
      />
    );
  }

  if (doodleId && isDoodleAvatarId(doodleId)) {
    return (
      <DoodleAvatarFace
        id={doodleId}
        title={name}
        className={`${sizeClass[size]} shrink-0 rounded-full ${ringClass} ${className}`}
      />
    );
  }

  return (
    <div
      title={name}
      aria-hidden={!name}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${
        sizeClass[size]
      } ${ringClass} ${className}`}
      style={{ backgroundColor: bg }}
    >
      {label}
    </div>
  );
}
