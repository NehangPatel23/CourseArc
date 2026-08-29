import { Link } from "react-router-dom";
import {
  listMissingStudentsForItem,
  type MissingStudentRow,
} from "../utils/studentSubmissionStatus";
import type { GradebookColumnKind } from "../utils/gradebook";

type Props = {
  courseId: string;
  kind: GradebookColumnKind;
  itemId: string;
  gradePath?: string;
};

export default function MissingStudentsPanel({ courseId, kind, itemId, gradePath }: Props) {
  const missing: MissingStudentRow[] = listMissingStudentsForItem(courseId, kind, itemId);
  if (missing.length === 0) return null;

  return (
    <div className="border-t border-canvas-border pt-4">
      <h3 className="mb-2 text-sm font-semibold text-canvas-grayDark">
        Missing ({missing.length})
      </h3>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
        {missing.map((row) => (
          <li key={row.studentId}>
            {gradePath ? (
              <Link
                to={`${gradePath}?student=${encodeURIComponent(row.studentId)}`}
                className="text-canvas-blue hover:underline"
              >
                {row.studentName}
              </Link>
            ) : (
              <span className="text-gray-700">{row.studentName}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
