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
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="11" fill="#1F2A24" />
      <path
        d="M14 38V22.5C14 16.7 18.7 12 24.5 12C30.3 12 35 16.7 35 22.5V38"
        stroke="#EDE4D4"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M14 38H18.5V28H31.5V38H35" stroke="#EDE4D4" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="24.5" cy="22" r="2.2" fill="#C45D26" />
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
        className="font-display font-semibold italic leading-none text-arc-ivory whitespace-nowrap"
        style={{ fontSize: wordmarkSize }}
      >
        CourseArc
      </span>
    </span>
  );
}
