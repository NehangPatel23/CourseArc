import { useLocation, useParams } from "react-router-dom";
import UnavailableScreen from "../components/UnavailableScreen";

export default function ModuleItemUnavailablePage() {
  const { courseId } = useParams();
  const location = useLocation();
  const effectiveCourseId = courseId ?? "default";
  const state = (location.state as { reason?: string; from?: string } | null) ?? null;
  const reason = state?.reason ?? "This item isn't available to view right now.";
  const backTo = state?.from ?? `/courses/${effectiveCourseId}/modules`;

  return (
    <UnavailableScreen
      title="Item unavailable"
      message={reason}
      backTo={backTo}
      backLabel="Back to Modules"
    />
  );
}
