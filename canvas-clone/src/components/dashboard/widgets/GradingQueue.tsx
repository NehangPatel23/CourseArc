import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAllPendingSubmissions } from "../../../utils/assignmentSubmissions";
import { loadAssignments } from "../../../utils/assignments";
import { getPendingParticipationsForCourse } from "../../../utils/discussionParticipations";
import { getTopicById } from "../../../utils/discussions";
import { matchesSearch } from "../../../utils/listFilters";
import { loadQuizzes } from "../../../utils/quizzes";
import {
  getAttemptsForQuiz,
  QUIZ_ATTEMPTS_CHANGED_EVENT,
} from "../../../utils/quizSubmissions";
import { isQuizAttemptPending } from "../../../utils/gradingCounts";
import { loadCourses } from "../../../utils/coursesStore";
import { DISCUSSION_PARTICIPATIONS_CHANGED_EVENT } from "../../../utils/discussionParticipations";
import { StatusAlertBanner } from "../../ui/StatusAlert";
import ListFiltersBar from "../../ListFiltersBar";

type QueueEntry = {
  id: string;
  courseId: string;
  title: string;
  studentName: string;
  submittedAt: number;
  gradePath: string;
};

function collectPendingQueue(): QueueEntry[] {
  const entries: QueueEntry[] = [];

  for (const s of getAllPendingSubmissions()) {
    const assignment = loadAssignments(s.courseId).find((a) => a.id === s.assignmentId);
    entries.push({
      id: s.id,
      courseId: s.courseId,
      title: assignment?.title ?? "Assignment",
      studentName: s.studentName,
      submittedAt: s.submittedAt,
      gradePath: `/courses/${s.courseId}/assignments/${s.assignmentId}/grade`,
    });
  }

  for (const course of loadCourses()) {
    for (const quiz of loadQuizzes(course.id)) {
      for (const attempt of getAttemptsForQuiz(course.id, quiz.id).filter(isQuizAttemptPending)) {
        entries.push({
          id: attempt.id,
          courseId: course.id,
          title: quiz.title,
          studentName: attempt.studentName,
          submittedAt: attempt.submittedAt,
          gradePath: `/courses/${course.id}/quizzes/${quiz.id}/grade?attempt=${attempt.id}`,
        });
      }
    }
    for (const p of getPendingParticipationsForCourse(course.id)) {
      const topic = getTopicById(course.id, p.topicId);
      entries.push({
        id: p.id,
        courseId: course.id,
        title: topic?.title ?? "Discussion",
        studentName: p.studentName,
        submittedAt: p.firstPostedAt ?? Date.now(),
        gradePath: `/courses/${course.id}/discussions/${p.topicId}/grade?participation=${p.id}`,
      });
    }
  }

  return entries.sort((a, b) => b.submittedAt - a.submittedAt);
}

export default function GradingQueue({ studentView }: { studentView: boolean }) {
  const [search, setSearch] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const bump = () => setRefreshTick((n) => n + 1);
    window.addEventListener("canvasClone:assignmentSubmissionsChanged", bump);
    window.addEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, bump);
    window.addEventListener(DISCUSSION_PARTICIPATIONS_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener("canvasClone:assignmentSubmissionsChanged", bump);
      window.removeEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, bump);
      window.removeEventListener(DISCUSSION_PARTICIPATIONS_CHANGED_EVENT, bump);
    };
  }, []);

  const pending = useMemo(() => collectPendingQueue(), [refreshTick]);

  const filtered = useMemo(() => {
    if (!search.trim()) return pending;
    return pending.filter(
      (s) => matchesSearch(s.studentName, search) || matchesSearch(s.title, search),
    );
  }, [pending, search]);

  if (studentView) return null;

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

      {pending.length > 3 && (
        <ListFiltersBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search student or item…"
          sort="newest"
          onSortChange={() => {}}
          sortOptions={[]}
          hideSort
          resultCount={filtered.length}
          totalCount={pending.length}
          className="mb-3"
        />
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No pending submissions match your search.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link
                to={s.gradePath}
                className="block rounded-lg px-2 py-1.5 text-sm hover:bg-canvas-grayLight"
              >
                <span className="font-medium text-canvas-grayDark">
                  {s.title}
                </span>
                <span className="block text-xs text-gray-500">
                  {s.studentName} · {new Date(s.submittedAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
