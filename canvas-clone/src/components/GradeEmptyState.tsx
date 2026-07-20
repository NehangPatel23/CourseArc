import { Link } from "react-router-dom";
import EmptyGradeDoodle from "./EmptyGradeDoodle";

export default function GradeEmptyState({
  title,
  subtitle,
  ctaTo,
  ctaLabel,
  compact = false,
  fill = false,
}: {
  title: string;
  subtitle?: string;
  ctaTo?: string;
  ctaLabel?: string;
  compact?: boolean;
  fill?: boolean;
}) {
  return (
    <div
      className={`mx-auto flex flex-col items-center justify-center text-center ${
        fill ? "h-full w-full" : ""
      } ${
        compact
          ? "px-4 py-8"
          : fill
            ? "max-w-lg rounded-xl border border-gray-200 bg-white px-6 py-12 shadow-sm"
            : "mt-10 max-w-lg rounded-xl border border-gray-200 bg-white px-6 py-12 shadow-sm"
      }`}
    >
      <EmptyGradeDoodle className={compact ? "h-36 w-36" : "h-48 w-48"} />
      <h2 className={`font-semibold text-canvas-grayDark ${compact ? "mt-4 text-base" : "mt-6 text-lg"}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-2 max-w-sm text-gray-600 ${compact ? "text-xs" : "text-sm"}`}>{subtitle}</p>
      )}
      {ctaTo && ctaLabel && (
        <Link to={ctaTo} className="btn-canvas-primary mt-6 text-sm">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
