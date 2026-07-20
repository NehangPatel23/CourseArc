import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import GradeActionButton from "./GradeActionButton";
import { formatAssignmentDueDate } from "../utils/assignments";
import type { DiscussionParticipation } from "../utils/discussionParticipations";
import { isGradedDiscussion, loadReplyCount, type DiscussionTopic } from "../utils/discussions";
import {
  getDiscussionParticipationStats,
} from "../utils/gradingCounts";

function formatAvailability(topic: DiscussionTopic): string | null {
  if (typeof topic.availableFrom === "number" && typeof topic.availableUntil === "number") {
    return `${formatAssignmentDueDate(topic.availableFrom).replace(" by ", " at ")} – ${formatAssignmentDueDate(topic.availableUntil).replace(" by ", " at ")}`;
  }
  if (typeof topic.availableFrom === "number") {
    return `From ${formatAssignmentDueDate(topic.availableFrom).replace(" by ", " at ")}`;
  }
  if (typeof topic.availableUntil === "number") {
    return `Until ${formatAssignmentDueDate(topic.availableUntil).replace(" by ", " at ")}`;
  }
  return null;
}

export function discussionGradePath(
  courseId: string,
  topicId: string,
  returnTo?: string,
): string {
  const base = `/courses/${courseId}/discussions/${topicId}/grade`;
  if (!returnTo) return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}

type Props = {
  courseId: string;
  topicId: string;
  topic: DiscussionTopic;
  studentView: boolean;
  participation?: DiscussionParticipation;
};

export default function DiscussionSidebar({
  courseId,
  topicId,
  topic,
  studentView,
  participation,
}: Props) {
  const graded = isGradedDiscussion(topic);
  const replyCount = loadReplyCount(courseId, topicId);
  const stats = getDiscussionParticipationStats(courseId, topicId);
  const availability = formatAvailability(topic);
  const editUrl = `/courses/${courseId}/discussions/${topicId}/edit`;
  const gradePath = discussionGradePath(
    courseId,
    topicId,
    `/courses/${courseId}/discussions/${topicId}`,
  );

  return (
    <aside className="lg:pt-2">
      <h3 className="text-sm font-semibold text-canvas-grayDark">Details</h3>
      <dl className="mt-3 space-y-2 border-t border-gray-200 pt-3 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Type</dt>
          <dd>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                graded
                  ? "bg-amber-50 text-amber-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {graded ? "Graded discussion" : "Discussion"}
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Replies</dt>
          <dd className="font-medium text-canvas-grayDark">{replyCount}</dd>
        </div>
        {topic.pinned && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Pinned</dt>
            <dd className="text-canvas-grayDark">Yes</dd>
          </div>
        )}
        {topic.locked && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Locked</dt>
            <dd className="text-canvas-grayDark">Yes</dd>
          </div>
        )}
        {availability && (
          <div>
            <dt className="text-gray-500">Availability</dt>
            <dd className="mt-0.5 text-xs text-canvas-grayDark">{availability}</dd>
          </div>
        )}
        {graded && typeof topic.points === "number" && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Points</dt>
            <dd className="font-medium text-canvas-grayDark">{topic.points}</dd>
          </div>
        )}
        {graded && typeof topic.dueAt === "number" && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Due</dt>
            <dd className="text-canvas-grayDark">
              {formatAssignmentDueDate(topic.dueAt).replace(" by ", " at ")}
            </dd>
          </div>
        )}
      </dl>

      <h3 className="mt-6 text-sm font-semibold text-canvas-grayDark">Grading</h3>
      <div className="mt-3 border-t border-gray-200 pt-3">
        {!graded ? (
          <p className="text-sm text-gray-500">
            Ungraded discussion.
            {!studentView && (
              <>
                {" "}
                <Link to={editUrl} className="text-canvas-blue hover:underline">
                  Enable grading in Edit
                </Link>
              </>
            )}
          </p>
        ) : studentView ? (
          participation ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Status</dt>
                <dd className="capitalize text-canvas-grayDark">{participation.status}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Your replies</dt>
                <dd className="text-canvas-grayDark">{participation.replyCount}</dd>
              </div>
              {participation.status === "graded" && typeof participation.score === "number" && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Score</dt>
                  <dd className="font-semibold text-canvas-grayDark">
                    {participation.score} / {topic.points ?? 0}
                  </dd>
                </div>
              )}
              {participation.firstPostedAt && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">First posted</dt>
                  <dd className="text-xs text-canvas-grayDark">
                    {new Date(participation.firstPostedAt).toLocaleString()}
                  </dd>
                </div>
              )}
              {participation.status === "graded" &&
                (participation.feedbackEntries?.length ?? 0) > 0 && (
                  <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
                    {participation.feedbackEntries![0]?.body}
                  </div>
                )}
            </dl>
          ) : (
            <p className="text-sm text-gray-500">
              {topic.requireInitialPost
                ? "Post a reply to participate."
                : "No participation recorded yet."}
            </p>
          )
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">
              {stats.graded} graded · {stats.submitted} awaiting grade · {stats.total} participants
            </p>
            <GradeActionButton
              to={gradePath}
              label="Open GradePro"
              variant="sidebar"
            />
          </div>
        )}
      </div>

      {!studentView && (
        <>
          <h3 className="mt-6 text-sm font-semibold text-canvas-grayDark">Related Items</h3>
          <ul className="mt-3 divide-y divide-gray-200 border-t border-gray-200">
            <li>
              <Link
                to={editUrl}
                className="flex w-full items-center gap-3 py-3 text-left text-sm text-canvas-blue hover:underline"
              >
                <Pencil className="h-4 w-4 shrink-0 text-gray-500" />
                Edit discussion
              </Link>
            </li>
            {graded && (
              <li>
                <GradeActionButton
                  to={gradePath}
                  label="GradePro"
                  variant="sidebar"
                />
              </li>
            )}
          </ul>
        </>
      )}
    </aside>
  );
}
