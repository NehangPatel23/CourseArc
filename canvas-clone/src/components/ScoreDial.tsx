/**
 * A small circular progress dial used to show a score percentage. The ring
 * color shifts with performance (green / blue / amber) and the percentage is
 * centered inside.
 */
export default function ScoreDial({
  percent,
  size = 84,
  stroke = 9,
}: {
  percent: number;
  size?: number;
  stroke?: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  const colorClass =
    clamped >= 80
      ? "text-canvas-green"
      : clamped >= 50
        ? "text-canvas-blue"
        : "text-amber-500";

  return (
    <span className={`relative inline-flex shrink-0 ${colorClass}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-gray-200"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-canvas-grayDark">
        {clamped}%
      </span>
    </span>
  );
}
