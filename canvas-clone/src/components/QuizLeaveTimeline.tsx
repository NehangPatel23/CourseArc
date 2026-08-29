import { formatQuizSubmitReason, type QuizAttempt, type QuizSubmitReason } from "../utils/quizSubmissions";

type Props = {
  leaveCount?: number;
  leaveEvents?: number[];
  seatNumber?: string;
  submitReason?: QuizSubmitReason;
  className?: string;
};

/** Compact leave / seat / submit-reason summary for GradePro and submission details. */
export default function QuizLeaveTimeline({
  leaveCount,
  leaveEvents,
  seatNumber,
  submitReason,
  className = "",
}: Props) {
  const reasonLabel = formatQuizSubmitReason(submitReason);
  const events = leaveEvents ?? [];
  const count = leaveCount ?? events.length;
  if (!seatNumber && count <= 0 && !reasonLabel) return null;

  return (
    <div
      className={`rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950 ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/80">
        Soft proctor
      </p>
      <ul className="mt-1.5 space-y-0.5 text-sm">
        {seatNumber && (
          <li>
            Seat / station: <span className="font-medium">{seatNumber}</span>
          </li>
        )}
        {reasonLabel && <li>{reasonLabel}</li>}
        {count > 0 && (
          <li>
            {count} leave{count === 1 ? "" : "s"} recorded
            {events.length > 0 && (
              <ol className="mt-1 max-h-28 list-decimal space-y-0.5 overflow-y-auto pl-4 text-xs text-amber-900/90">
                {events.map((ts) => (
                  <li key={ts}>{new Date(ts).toLocaleString()}</li>
                ))}
              </ol>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}

export function QuizLeaveTimelineFromAttempt({
  attempt,
  className,
}: {
  attempt: Pick<QuizAttempt, "leaveCount" | "leaveEvents" | "seatNumber" | "submitReason">;
  className?: string;
}) {
  return (
    <QuizLeaveTimeline
      leaveCount={attempt.leaveCount}
      leaveEvents={attempt.leaveEvents}
      seatNumber={attempt.seatNumber}
      submitReason={attempt.submitReason}
      className={className}
    />
  );
}
