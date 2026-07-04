type AppLogoProps = {
  size?: number;
  variant?: "mark" | "full";
  className?: string;
};

function LogoMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="12" fill="canvas-blue" />
      <path
        d="M44 32C44 39.732 37.732 46 30 46C22.268 46 16 39.732 16 32C16 24.268 22.268 18 30 18"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="44" cy="32" r="4" fill="white" />
    </svg>
  );
}

export default function AppLogo({
  size = 32,
  variant = "mark",
  className = "",
}: AppLogoProps) {
  if (variant === "mark") {
    return (
      <span className={`inline-flex shrink-0 ${className}`}>
        <LogoMark size={size} />
      </span>
    );
  }

  const wordmarkSize = Math.round(size * 0.55);

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span
        className="font-semibold text-canvas-grayDark leading-none whitespace-nowrap"
        style={{ fontSize: wordmarkSize }}
      >
        CourseArc
      </span>
    </span>
  );
}
