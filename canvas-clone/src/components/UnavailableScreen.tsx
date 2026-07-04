import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * A friendly "nothing to see here" screen used for locked / missing / hidden
 * content. It fills the course content window (the pane inside the layout),
 * not the whole viewport, so the course sidebar stays visible.
 * The doodle is inline SVG so it inherits the app theme.
 */
export default function UnavailableScreen({
  title,
  message,
  backTo,
  backLabel = "Go back",
}: {
  title: string;
  message: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center bg-gradient-to-b from-canvas-blueTint/50 via-white to-white px-6 py-12 text-center">
      <UnavailableDoodle className="h-56 w-56 sm:h-64 sm:w-64" />
      <h1 className="mt-6 text-2xl font-semibold text-canvas-grayDark sm:text-3xl">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base">
        {message}
      </p>
      {backTo && (
        <Link
          to={backTo}
          className="btn-canvas-primary mt-8 inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
    </div>
  );
}

/**
 * A playful illustration: a floating "window" catching some Zzz's behind a
 * padlock, surrounded by a dashed orbit and sparkles. Purely decorative.
 */
export function UnavailableDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* soft backdrop blob */}
      <ellipse cx="120" cy="118" rx="98" ry="82" className="fill-canvas-blueTint" />

      {/* dashed orbit */}
      <ellipse
        cx="120"
        cy="112"
        rx="96"
        ry="80"
        className="stroke-canvas-blue/30"
        strokeWidth="2.5"
        strokeDasharray="3 11"
        strokeLinecap="round"
      />
      <circle cx="24" cy="112" r="4" className="fill-canvas-blue/40" />
      <circle cx="216" cy="112" r="5" className="fill-canvas-blue/30" />

      {/* sparkles */}
      <g className="stroke-canvas-blue" strokeWidth="3.5" strokeLinecap="round">
        <path d="M52 58l0 13M45.5 64.5l13 0" />
        <path d="M190 150l0 11M184.5 155.5l11 0" />
      </g>
      <g className="stroke-amber-400" strokeWidth="3.5" strokeLinecap="round">
        <path d="M186 62l0 11M180.5 67.5l11 0" />
      </g>

      {/* drop shadow under the card */}
      <ellipse cx="118" cy="176" rx="52" ry="9" className="fill-canvas-grayDark/10" />

      {/* floating window/card */}
      <g strokeLinejoin="round" strokeLinecap="round">
        <rect
          x="66"
          y="62"
          width="108"
          height="98"
          rx="18"
          className="fill-white stroke-canvas-grayDark"
          strokeWidth="4.5"
        />
        {/* title bar */}
        <path
          d="M66 84a18 18 0 0118-18h72a18 18 0 0118 18v2H66z"
          className="fill-canvas-blueTint"
        />
        <line
          x1="66"
          y1="86"
          x2="174"
          y2="86"
          className="stroke-canvas-grayDark"
          strokeWidth="4.5"
        />
        <circle cx="82" cy="74" r="3.4" className="fill-canvas-red/70" />
        <circle cx="94" cy="74" r="3.4" className="fill-amber-400" />
        <circle cx="106" cy="74" r="3.4" className="fill-canvas-green/80" />

        {/* sleepy closed eyes */}
        <path
          d="M92 112q9 9 18 0"
          className="stroke-canvas-grayDark"
          strokeWidth="4.5"
          fill="none"
        />
        <path
          d="M130 112q9 9 18 0"
          className="stroke-canvas-grayDark"
          strokeWidth="4.5"
          fill="none"
        />
        {/* content placeholder line */}
        <line
          x1="98"
          y1="140"
          x2="142"
          y2="140"
          className="stroke-canvas-grayLight"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>

      {/* Zzz drifting up */}
      <g className="fill-canvas-blue" fontFamily="sans-serif" fontWeight="700">
        <text x="150" y="56" fontSize="18">z</text>
        <text x="163" y="44" fontSize="14">z</text>
        <text x="173" y="35" fontSize="10">z</text>
      </g>

      {/* padlock badge */}
      <g strokeLinejoin="round" strokeLinecap="round" strokeWidth="4">
        <circle cx="164" cy="150" r="24" className="fill-white stroke-amber-500" />
        <path d="M154 148v-6a10 10 0 0120 0v6" className="fill-none stroke-amber-500" />
        <rect
          x="150"
          y="148"
          width="28"
          height="22"
          rx="5"
          className="fill-amber-100 stroke-amber-500"
        />
        <circle cx="164" cy="157" r="3" className="fill-amber-500" />
        <path d="M164 160v5" className="stroke-amber-500" strokeWidth="3" />
      </g>
    </svg>
  );
}
