import { Link } from "react-router-dom";
import {
  listInstructorMissingWork,
  listMissingWork,
} from "../../../utils/studentSubmissionStatus";
import { StatusAlertBanner } from "../../ui/StatusAlert";
import { useUserId } from "../../../hooks/useUser";

export default function MissingWorkAlert({ studentView }: { studentView: boolean }) {
  const userId = useUserId();

  if (!studentView) {
    const items = listInstructorMissingWork().slice(0, 8);
    if (!items.length) {
      return (
        <StatusAlertBanner tone="positive">
          <p className="text-sm font-medium">No missing submissions</p>
        </StatusAlertBanner>
      );
    }
    return (
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={`${item.kind}:${item.courseId}:${item.itemId}`}>
            <Link to={item.path} className="block">
              <StatusAlertBanner tone="negative">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.courseColor }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <span className="text-xs opacity-70">
                      {item.courseShortName} · {item.missingCount} missing
                    </span>
                  </div>
                </div>
              </StatusAlertBanner>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  const missing = listMissingWork(userId).slice(0, 8);

  if (!missing.length) {
    return (
      <StatusAlertBanner tone="positive">
        <p className="text-sm font-medium">No missing work</p>
      </StatusAlertBanner>
    );
  }

  return (
    <ul className="space-y-2">
      {missing.map((item) => (
        <li key={`${item.kind}:${item.courseId}:${item.itemId}`}>
          <Link to={item.path} className="block">
            <StatusAlertBanner tone="negative">
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.courseColor }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <span className="text-xs opacity-70">
                    {item.courseShortName} · Due{" "}
                    {new Date(item.dueAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </StatusAlertBanner>
          </Link>
        </li>
      ))}
    </ul>
  );
}
