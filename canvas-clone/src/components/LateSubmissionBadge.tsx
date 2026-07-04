type LateSubmissionBadgeProps = {
  className?: string;
  variant?: "default" | "dark";
};

export default function LateSubmissionBadge({
  className = "",
  variant = "default",
}: LateSubmissionBadgeProps) {
  const styles =
    variant === "dark"
      ? "border-red-300/40 bg-red-400/20 text-red-100"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${styles} ${className}`}
    >
      Late submission
    </span>
  );
}
