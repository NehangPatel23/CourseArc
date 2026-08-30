/** Hand-drawn studio sketch for the compose-course tile. */
export default function ComposeCourseDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 168 148"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="92" cy="132" rx="46" ry="8" className="fill-arc-ink/[0.07]" />

      <path
        d="M28 86c18-28 48-40 86-28"
        className="stroke-arc-copper/25"
        strokeWidth="1.4"
        strokeDasharray="3 7"
        strokeLinecap="round"
      />

      <g strokeLinejoin="round" strokeLinecap="round">
        <path d="M62 126 L78 58 L96 126" className="stroke-arc-ink/55" strokeWidth="2.2" />
        <path d="M78 92 L118 124" className="stroke-arc-ink/45" strokeWidth="2" />
        <path d="M70 126h28" className="stroke-arc-ink/35" strokeWidth="2" />
      </g>

      <g transform="rotate(-8 86 70)">
        <rect
          x="46"
          y="34"
          width="80"
          height="62"
          rx="3"
          className="fill-arc-ivory stroke-arc-ink"
          strokeWidth="2.2"
        />
        <rect
          x="52"
          y="40"
          width="68"
          height="50"
          rx="1.5"
          className="stroke-arc-copper/35"
          strokeWidth="1.3"
          strokeDasharray="3 4"
        />
        <path
          d="M86 54v22M75 65h22"
          className="stroke-arc-copper"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>

      <g transform="rotate(32 132 98)">
        <path d="M128 72h8v38h-8z" className="fill-arc-gold/80 stroke-arc-ink" strokeWidth="1.6" />
        <path d="M128 110h8l-4 14z" className="fill-arc-cream stroke-arc-ink" strokeWidth="1.6" />
        <path d="M132 122l-2.2 8 2.2 2.4 2.2-2.4z" className="fill-arc-copper stroke-arc-ink" strokeWidth="1.4" />
        <rect x="128" y="66" width="8" height="8" rx="1.2" className="fill-arc-brick/80 stroke-arc-ink" strokeWidth="1.6" />
        <path d="M128 74h8" className="stroke-arc-ink/40" strokeWidth="1.2" />
      </g>

      <g className="stroke-arc-copper" strokeWidth="2" strokeLinecap="round">
        <path d="M34 40v10M29 45h10" />
        <path d="M148 36v8M144 40h8" />
      </g>
      <circle cx="150" cy="78" r="2.2" className="fill-arc-gold" />
    </svg>
  );
}
