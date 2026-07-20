import {
  DOODLE_BG,
  type DoodleAvatarId,
} from "../utils/avatarDoodles";

type Props = {
  id: DoodleAvatarId;
  className?: string;
  title?: string;
};

/** Playful line-art faces for profile avatars. */
export default function DoodleAvatarFace({ id, className = "", title }: Props) {
  const bg = DOODLE_BG[id];

  return (
    <svg
      viewBox="0 0 80 80"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={!title}
    >
      <circle cx="40" cy="40" r="40" fill={bg} />
      {id === "smile" && <SmileFace />}
      {id === "glasses" && <GlassesFace />}
      {id === "curly" && <CurlyFace />}
      {id === "beanie" && <BeanieFace />}
      {id === "headphones" && <HeadphonesFace />}
      {id === "sparkle" && <SparkleFace />}
      {id === "cool" && <CoolFace />}
      {id === "wink" && <WinkFace />}
    </svg>
  );
}

function FaceBase() {
  return (
    <>
      {/* head */}
      <circle cx="40" cy="42" r="22" fill="#FFF8F0" stroke="#2D3B45" strokeWidth="2.2" />
    </>
  );
}

function SmileFace() {
  return (
    <g stroke="#2D3B45" strokeWidth="2.2" strokeLinecap="round" fill="none">
      <FaceBase />
      <circle cx="32" cy="40" r="2.2" fill="#2D3B45" stroke="none" />
      <circle cx="48" cy="40" r="2.2" fill="#2D3B45" stroke="none" />
      <path d="M31 50c3 5 15 5 18 0" />
      {/* rosy cheeks */}
      <circle cx="26" cy="46" r="3" fill="#F9A8A8" stroke="none" opacity="0.7" />
      <circle cx="54" cy="46" r="3" fill="#F9A8A8" stroke="none" opacity="0.7" />
    </g>
  );
}

function GlassesFace() {
  return (
    <g stroke="#2D3B45" strokeWidth="2.2" strokeLinecap="round" fill="none">
      <FaceBase />
      <circle cx="31" cy="40" r="6" />
      <circle cx="49" cy="40" r="6" />
      <path d="M37 40h6" />
      <path d="M25 40H20" />
      <path d="M55 40h5" />
      <path d="M33 52c2.5 3.5 11.5 3.5 14 0" />
    </g>
  );
}

function CurlyFace() {
  return (
    <g stroke="#2D3B45" strokeWidth="2.2" strokeLinecap="round" fill="none">
      {/* curls */}
      <path d="M22 34c0-10 8-16 18-16s18 6 18 16" fill="#2D3B45" stroke="none" />
      <circle cx="24" cy="30" r="5" fill="#2D3B45" stroke="none" />
      <circle cx="32" cy="24" r="5.5" fill="#2D3B45" stroke="none" />
      <circle cx="42" cy="22" r="5.5" fill="#2D3B45" stroke="none" />
      <circle cx="52" cy="26" r="5" fill="#2D3B45" stroke="none" />
      <circle cx="56" cy="34" r="4.5" fill="#2D3B45" stroke="none" />
      <FaceBase />
      <circle cx="32" cy="41" r="2.2" fill="#2D3B45" stroke="none" />
      <circle cx="48" cy="41" r="2.2" fill="#2D3B45" stroke="none" />
      <path d="M34 51c2 3 10 3 12 0" />
    </g>
  );
}

function BeanieFace() {
  return (
    <g stroke="#2D3B45" strokeWidth="2.2" strokeLinecap="round" fill="none">
      <FaceBase />
      {/* beanie */}
      <path
        d="M20 38c2-16 14-24 20-24s18 8 20 24"
        fill="#008EE2"
        stroke="#2D3B45"
      />
      <path d="M20 38h40" />
      <circle cx="40" cy="14" r="4" fill="#F59E0B" stroke="#2D3B45" />
      <circle cx="32" cy="44" r="2.2" fill="#2D3B45" stroke="none" />
      <circle cx="48" cy="44" r="2.2" fill="#2D3B45" stroke="none" />
      <path d="M32 54c3 4 13 4 16 0" />
    </g>
  );
}

function HeadphonesFace() {
  return (
    <g stroke="#2D3B45" strokeWidth="2.2" strokeLinecap="round" fill="none">
      <FaceBase />
      <path d="M22 42c0-14 8-22 18-22s18 8 18 22" />
      <rect x="16" y="38" width="9" height="14" rx="3" fill="#2D3B45" stroke="none" />
      <rect x="55" y="38" width="9" height="14" rx="3" fill="#2D3B45" stroke="none" />
      <circle cx="32" cy="42" r="2.2" fill="#2D3B45" stroke="none" />
      <circle cx="48" cy="42" r="2.2" fill="#2D3B45" stroke="none" />
      <path d="M33 52c2.5 3.5 11.5 3.5 14 0" />
    </g>
  );
}

function SparkleFace() {
  return (
    <g stroke="#2D3B45" strokeWidth="2.2" strokeLinecap="round" fill="none">
      <FaceBase />
      <circle cx="32" cy="40" r="2.2" fill="#2D3B45" stroke="none" />
      <circle cx="48" cy="40" r="2.2" fill="#2D3B45" stroke="none" />
      <path d="M31 50c3 5 15 5 18 0" />
      {/* sparkles */}
      <path d="M14 22v8M10 26h8" stroke="#F59E0B" strokeWidth="2.5" />
      <path d="M64 18v7M60.5 21.5h7" stroke="#008EE2" strokeWidth="2.5" />
      <path d="M62 58v6M59 61h6" stroke="#EC4899" strokeWidth="2.2" />
    </g>
  );
}

function CoolFace() {
  return (
    <g stroke="#2D3B45" strokeWidth="2.2" strokeLinecap="round" fill="none">
      <FaceBase />
      {/* shades */}
      <rect x="24" y="36" width="13" height="9" rx="2" fill="#2D3B45" stroke="none" />
      <rect x="43" y="36" width="13" height="9" rx="2" fill="#2D3B45" stroke="none" />
      <path d="M37 40.5h6" />
      <path d="M24 40.5H19" />
      <path d="M56 40.5h5" />
      <path d="M34 52h12" />
    </g>
  );
}

function WinkFace() {
  return (
    <g stroke="#2D3B45" strokeWidth="2.2" strokeLinecap="round" fill="none">
      <FaceBase />
      <circle cx="32" cy="40" r="2.2" fill="#2D3B45" stroke="none" />
      <path d="M44 40h8" />
      <path d="M31 50c3 5 15 5 18 0" />
      <circle cx="26" cy="46" r="3" fill="#F9A8A8" stroke="none" opacity="0.7" />
      <circle cx="54" cy="46" r="3" fill="#F9A8A8" stroke="none" opacity="0.7" />
    </g>
  );
}
