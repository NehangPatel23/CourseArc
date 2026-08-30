import { Link, useLocation } from "react-router-dom";
import Icon from "../icons/Icon";
import { FAQ_ITEMS } from "../utils/faq";

function idsForPath(pathname: string): string[] {
  if (pathname.includes("/assignments")) return ["peer-review", "missing-work", "anonymous-grading", "rubric-library"];
  if (pathname.includes("/quizzes") || pathname.includes("/question-banks"))
    return ["question-banks", "quiz-moderate", "quiz-accommodations"];
  if (pathname.includes("/grades")) return ["grades-post", "assignment-groups", "missing-work"];
  if (pathname.includes("/settings")) return ["import-export", "assignment-groups"];
  if (pathname.includes("/planner")) return ["planner"];
  if (pathname.includes("/portfolio")) return ["eportfolio"];
  if (pathname.includes("/people")) return ["course-groups", "demo-personas"];
  if (pathname.includes("/syllabus")) return ["syllabus"];
  if (pathname.includes("/rubrics")) return ["rubric-library"];
  if (pathname === "/courses" || pathname.startsWith("/courses?")) return ["nav-dashboard"];
  if (pathname.includes("/help")) return ["help-center"];
  return ["help-center", "nav-search"];
}

export default function PageHelpLink() {
  const location = useLocation();
  const ids = idsForPath(location.pathname);
  const first = FAQ_ITEMS.find((i) => ids.includes(i.id));
  const q = first?.title ?? "help";
  return (
    <Link
      to={`/help?q=${encodeURIComponent(q)}`}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-arc-mute transition-colors hover:text-arc-copper"
      title="Help for this page"
    >
      <Icon name="help" size={12} />
      Help
    </Link>
  );
}
