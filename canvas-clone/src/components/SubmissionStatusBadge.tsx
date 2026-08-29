import MissingSubmissionBadge from "./MissingSubmissionBadge";
import LateSubmissionBadge from "./LateSubmissionBadge";
import type { StudentSubmissionStatus } from "../utils/studentSubmissionStatus";

export default function SubmissionStatusBadge({
  status,
}: {
  status: StudentSubmissionStatus | "excused";
}) {
  if (status === "missing") return <MissingSubmissionBadge />;
  if (status === "late") return <LateSubmissionBadge />;
  if (status === "excused") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
        Excused
      </span>
    );
  }
  return null;
}
