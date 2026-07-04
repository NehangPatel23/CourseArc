import { Link } from "react-router-dom";
import { getAllPendingSubmissions } from "../../../utils/assignmentSubmissions";
import { loadAssignments } from "../../../utils/assignments";
import { StatusAlertBanner } from "../../ui/StatusAlert";

export default function GradingQueue({ studentView }: { studentView: boolean }) {
  if (studentView) return null;

  const pending = getAllPendingSubmissions();

  if (!pending.length) {
    return (
      <StatusAlertBanner tone="positive">
        <p className="text-sm font-medium">No submissions waiting</p>
      </StatusAlertBanner>
    );
  }

  return (
    <div>
      <StatusAlertBanner tone="negative" className="mb-3">
        <p className="text-sm font-medium">
          {pending.length} pending submission{pending.length > 1 ? "s" : ""}
        </p>
      </StatusAlertBanner>
      <ul className="space-y-2">
        {pending.map((s) => {
          const assignment = loadAssignments(s.courseId).find((a) => a.id === s.assignmentId);
          const title = assignment?.title ?? "Assignment";
          return (
            <li key={s.id}>
              <Link
                to={`/courses/${s.courseId}/assignments/${s.assignmentId}/grade`}
                className="block rounded-lg px-2 py-1.5 text-sm hover:bg-canvas-grayLight dark:hover:bg-gray-800"
              >
                <span className="font-medium text-canvas-grayDark dark:text-gray-100">{title}</span>
                <span className="block text-xs text-gray-500">
                  {s.studentName} · {new Date(s.submittedAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
