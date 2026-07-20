/** Friendly empty-state illustration for GradePro when nothing is ready to grade. */
export default function EmptyGradeDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 210"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="120" cy="188" rx="72" ry="10" fill="#E8ECF0" />
      <rect x="58" y="42" width="124" height="148" rx="12" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" />
      <rect x="72" y="58" width="96" height="8" rx="4" fill="#E2E8F0" />
      <rect x="72" y="76" width="72" height="6" rx="3" fill="#E2E8F0" />
      <rect x="72" y="90" width="84" height="6" rx="3" fill="#E2E8F0" />
      <rect x="72" y="104" width="60" height="6" rx="3" fill="#E2E8F0" />
      <circle cx="168" cy="150" r="28" fill="#EEF2FF" stroke="#93C5FD" strokeWidth="2" />
      <path
        d="M152 158 L168 142 L184 158 L176 158 L176 172 L160 172 L160 158 Z"
        fill="#3B82F6"
        stroke="#2563EB"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="164" y="172" width="8" height="6" rx="1" fill="#2563EB" />
      <circle cx="88" cy="36" r="4" fill="#FCD34D" opacity="0.8" />
      <circle cx="196" cy="52" r="3" fill="#A5B4FC" opacity="0.7" />
      <path d="M48 68 Q44 60 52 56" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <text x="38" y="54" fontSize="14" fill="#94A3B8" fontFamily="system-ui,sans-serif">
        z
      </text>
      <text x="48" y="44" fontSize="11" fill="#94A3B8" fontFamily="system-ui,sans-serif">
        z
      </text>
    </svg>
  );
}
