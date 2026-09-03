import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import RichContentViewer from "../components/RichContentViewer";
import GradeProShell, { gradeProChipClass, gradeProNavBtnClass } from "../components/GradeProShell";
import Icon from "../icons/Icon";
import GradeEmptyState from "../components/GradeEmptyState";
import MissingStudentsPanel from "../components/MissingStudentsPanel";
import GradePublishButton from "../components/GradePublishButton";
import StudentGradeProScoreSection from "../components/StudentGradeProScoreSection";
import { SimpleStudentCommentComposer } from "../components/SubmissionCommentComposer";
import RichPromptField from "../components/RichPromptField";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../hooks/useStudentView";
import { staffCommentRole } from "../utils/permissions";
import { getCourseById } from "../utils/coursesStore";
import { getRosterStudentName } from "../utils/gradebook";
import { graderDisplayName } from "../utils/anonymousGrading";
import {
  addParticipationComment,
  appendParticipationFeedback,
  DISCUSSION_PARTICIPATIONS_CHANGED_EVENT,
  gradeParticipation,
  loadParticipationsForTopic,
  type DiscussionParticipation,
} from "../utils/discussionParticipations";
import {
  buildReplyTree,
  getTopicById,
  isGradedDiscussion,
  loadReplies,
  type ReplyNode,
} from "../utils/discussions";
import {
  GRADE_PUBLISH_CHANGED_EVENT,
  isItemGradeVisible,
} from "../utils/gradeVisibility";
import { loadUser } from "../utils/userStore";
import { richTextIsEmpty, wrapPlainTextAsHtml } from "../utils/richContent";

function safeReturnPath(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function ReplyBlock({ node, courseId, depth = 0 }: { node: ReplyNode; courseId: string; depth?: number }) {
  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-arc-ink/10 pl-4" : ""}>
      <div className="border border-arc-ink/10 bg-arc-ivory p-4">
        <p className="text-sm font-semibold text-canvas-grayDark">{node.author}</p>
        <p className="text-xs text-arc-mute">{new Date(node.createdAt).toLocaleString()}</p>
        <div className="mt-2">
          <RichContentViewer html={node.body} courseId={courseId} spacing="compact" />
        </div>
      </div>
      {node.children.map((child) => (
        <div key={child.id} className="mt-3">
          <ReplyBlock node={child} courseId={courseId} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}

export default function DiscussionGradePage() {
  const { courseId, topicId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const currentUser = loadUser();
  const course = getCourseById(effectiveCourseId);
  const { showToast } = useToast();

  const topicPath = `/courses/${effectiveCourseId}/discussions/${topicId}`;
  const exitPath = safeReturnPath(searchParams.get("returnTo"), topicPath);

  const [participations, setParticipations] = useState<DiscussionParticipation[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [publishTick, setPublishTick] = useState(0);

  const topic = topicId ? getTopicById(effectiveCourseId, topicId) : undefined;
  const columnKey = topicId ? `discussion:${topicId}` : "";

  useEffect(() => {
    const bump = () => setPublishTick((n) => n + 1);
    window.addEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
    return () => window.removeEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
  }, []);

  const rosterParticipations = useMemo(
    () =>
      studentView
        ? participations.filter((p) => p.studentId === currentUser.id)
        : participations,
    [studentView, participations, currentUser.id],
  );

  useEffect(() => {
    if (!topic || !isGradedDiscussion(topic)) {
      navigate(topicPath, { replace: true });
    }
  }, [topic, navigate, topicPath]);

  useEffect(() => {
    const refresh = () => {
      if (!topicId) return;
      setParticipations(loadParticipationsForTopic(effectiveCourseId, topicId));
    };
    refresh();
    window.addEventListener(DISCUSSION_PARTICIPATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(DISCUSSION_PARTICIPATIONS_CHANGED_EVENT, refresh);
  }, [effectiveCourseId, topicId]);

  const participationIdParam = searchParams.get("participation");
  const studentIdParam = searchParams.get("student");

  useEffect(() => {
    if (participationIdParam && rosterParticipations.length > 0) {
      const idx = rosterParticipations.findIndex((p) => p.id === participationIdParam);
      if (idx >= 0) setIndex(idx);
      return;
    }
    if (studentIdParam && rosterParticipations.length > 0) {
      const idx = rosterParticipations.findIndex((p) => p.studentId === studentIdParam);
      if (idx >= 0) setIndex(idx);
    }
  }, [participationIdParam, studentIdParam, rosterParticipations]);

  const safeIndex = Math.min(index, Math.max(0, rosterParticipations.length - 1));
  const selected =
    studentIdParam != null
      ? rosterParticipations.find((p) => p.studentId === studentIdParam)
      : rosterParticipations[safeIndex];
  const studentOnlyMode = !!studentIdParam && !selected;
  const pendingStudentName = studentOnlyMode
    ? getRosterStudentName(effectiveCourseId, studentIdParam!)
    : null;
  const activeStudentId = selected?.studentId ?? studentIdParam ?? null;
  const maxPoints = topic?.points ?? 0;
  const anonymousEnabled = !!topic?.anonymousGrading;
  const displayNameFor = (studentId: string, realName: string) =>
    graderDisplayName({
      courseId: effectiveCourseId,
      columnKey,
      studentId,
      realName,
      anonymousEnabled,
    });
  const headerDisplayName = selected
    ? displayNameFor(selected.studentId, selected.studentName)
    : studentOnlyMode && studentIdParam && pendingStudentName
      ? displayNameFor(studentIdParam, pendingStudentName)
      : pendingStudentName;

  const studentReplies = useMemo(() => {
    if (!selected || !topicId) return [];
    const all = loadReplies(effectiveCourseId, topicId);
    return all.filter((r) => r.author === selected.studentName);
  }, [selected?.id, effectiveCourseId, topicId, selected?.studentName]);

  const replyTree = useMemo(() => buildReplyTree(studentReplies), [studentReplies]);

  useEffect(() => {
    if (!selected) {
      setScore("");
      setCommentDraft("");
      setFeedbackDraft("");
      return;
    }
    setScore(selected.status === "graded" && typeof selected.score === "number" ? String(selected.score) : "");
    setCommentDraft("");
    setFeedbackDraft("");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const gradedCount = rosterParticipations.filter((p) => p.status === "graded").length;

  const navigateToParticipation = (nextIndex: number) => {
    setIndex(nextIndex);
    const p = rosterParticipations[nextIndex];
    if (p) {
      const params: Record<string, string> = { participation: p.id };
      const returnTo = searchParams.get("returnTo");
      if (returnTo) params.returnTo = returnTo;
      setSearchParams(params, { replace: true });
    }
  };

  const handleSaveGrade = () => {
    if (!selected || !topic) return;
    const num = score.trim() === "" ? NaN : Number(score);
    if (!Number.isFinite(num) || num < 0 || num > maxPoints) {
      showToast(`Score must be between 0 and ${maxPoints}`, "negative");
      return;
    }
    gradeParticipation(effectiveCourseId, selected.id, num, maxPoints);
    if (!richTextIsEmpty(feedbackDraft)) {
      appendParticipationFeedback(effectiveCourseId, selected.id, feedbackDraft);
      setFeedbackDraft("");
    }
    showToast("Grade saved", "positive", "grading");
  };

  const handleAddComment = () => {
    if (!selected || richTextIsEmpty(commentDraft)) return;
    addParticipationComment(effectiveCourseId, selected.id, commentDraft, staffCommentRole());
    setCommentDraft("");
    showToast("Comment added", "positive", "grading");
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const visibilityStudentId = selected?.studentId ?? studentIdParam ?? currentUser.id;
  const itemVisible =
    Boolean(columnKey) &&
    isItemGradeVisible(effectiveCourseId, columnKey, visibilityStudentId);
  void publishTick;
  const allComments = selected?.comments ?? [];
  const visibleStudentComments = studentView
    ? allComments.filter((c) => c.role === "student" || itemVisible)
    : allComments;
  const feedbackEntries = selected?.feedbackEntries ?? [];
  const visibleFeedbackEntries = studentView && !itemVisible ? [] : feedbackEntries;

  if (!topic || !topicId || !isGradedDiscussion(topic)) {
    return null;
  }

  return (
    <GradeProShell
      exitTo={exitPath}
      title={topic.title}
      subtitle={`Discussion GradePro${course ? ` — ${course.title}` : ""}`}
      stats={
        !studentView ? (
          <>
            <span>
              {gradedCount}/{rosterParticipations.length} Graded
            </span>
            <span>
              {rosterParticipations.length === 0
                ? "0/0"
                : `${safeIndex + 1}/${rosterParticipations.length}`}{" "}
              Viewing
            </span>
          </>
        ) : (
          <span className="text-arc-cream/90">Your participation</span>
        )
      }
      trailing={
        <>
          {!studentView && (
            <>
              <button
                type="button"
                onClick={() => navigateToParticipation(Math.max(0, safeIndex - 1))}
                disabled={safeIndex <= 0}
                className={gradeProNavBtnClass}
              >
                <Icon name="chevronLeft" size={20} />
              </button>
              <button
                type="button"
                onClick={() =>
                  navigateToParticipation(
                    Math.min(rosterParticipations.length - 1, safeIndex + 1),
                  )
                }
                disabled={safeIndex >= rosterParticipations.length - 1}
                className={gradeProNavBtnClass}
              >
                <Icon name="chevronRight" size={20} />
              </button>
            </>
          )}
          {(selected || studentOnlyMode) && (
            <div className={gradeProChipClass}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-arc-sage text-xs font-bold text-white">
                {initials(headerDisplayName ?? "?")}
              </span>
              <span className="max-w-[140px] truncate text-sm">{headerDisplayName}</span>
            </div>
          )}
          {!studentView && activeStudentId && (
            <GradePublishButton
              courseId={effectiveCourseId}
              studentId={activeStudentId}
              columnKey={columnKey}
              variant="dark"
            />
          )}
        </>
      }
    >
        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-arc-paper p-6 text-arc-ink">
          {studentOnlyMode ? (
            <GradeEmptyState
              title="No participation yet"
              subtitle={`${pendingStudentName} has not posted on this discussion.`}
            />
          ) : !selected ? (
            <GradeEmptyState
              title="No participations to grade yet"
              subtitle="When students post on this graded discussion, their submissions will appear here for you to review."
            />
          ) : (
            <div className="w-full space-y-4 px-4">
              <div className="border border-arc-ink/10 bg-arc-ivory p-4 text-sm text-arc-mute">
                <p>
                  <span className="font-semibold text-canvas-grayDark">{selected.replyCount}</span>{" "}
                  {selected.replyCount === 1 ? "reply" : "replies"} · Status:{" "}
                  <span className="capitalize">{selected.status}</span>
                </p>
                {selected.firstPostedAt && (
                  <p className="mt-1 text-xs text-arc-mute">
                    First posted {new Date(selected.firstPostedAt).toLocaleString()}
                  </p>
                )}
              </div>
              {replyTree.length === 0 ? (
                <p className="text-sm text-arc-mute">No replies from this student.</p>
              ) : (
                replyTree.map((node) => <ReplyBlock key={node.id} node={node} courseId={effectiveCourseId} />)
              )}
            </div>
          )}
        </div>

        <aside className="flex w-[380px] shrink-0 flex-col border-l border-arc-ink/10 bg-arc-ivory text-arc-ink">
          <div className="flex-1 overflow-y-auto p-4">
            {studentView ? (
              <div className="space-y-4">
                <StudentGradeProScoreSection
                  courseId={effectiveCourseId}
                  columnKey={columnKey}
                  maxPoints={maxPoints}
                  score={
                    selected?.status === "graded" && typeof selected.score === "number"
                      ? selected.score
                      : null
                  }
                  isGraded={selected?.status === "graded"}
                />

                <div>
                  <h3 className="text-sm font-semibold">Comments</h3>
                  {visibleStudentComments.length === 0 ? (
                    <p className="mt-2 text-sm text-arc-mute">No comments yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {visibleStudentComments.map((c) => (
                        <li key={c.id} className="border border-arc-ink/10 bg-arc-paper p-2 text-xs">
                          <span className="font-medium">{c.author}</span>
                          <RichContentViewer
                            html={wrapPlainTextAsHtml(c.body)}
                            courseId={effectiveCourseId}
                            spacing="compact"
                            className="mt-1 text-arc-ink"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  {selected && (
                    <SimpleStudentCommentComposer
                      courseId={effectiveCourseId}
                      onSubmit={(body) => {
                        addParticipationComment(
                          effectiveCourseId,
                          selected.id,
                          body,
                          "student",
                        );
                        showToast("Comment added", "positive", "grading");
                      }}
                    />
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold">Feedback</h3>
                  {!itemVisible ? (
                    <p className="mt-2 text-sm text-arc-mute">
                      Feedback will appear when your grade is posted
                    </p>
                  ) : visibleFeedbackEntries.length === 0 ? (
                    <p className="mt-2 text-sm text-arc-mute">No feedback yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {visibleFeedbackEntries.map((f) => (
                        <li key={f.id} className="border border-arc-ink/10 bg-arc-paper p-2 text-xs">
                          <RichContentViewer
                            html={wrapPlainTextAsHtml(f.body)}
                            courseId={effectiveCourseId}
                            spacing="compact"
                            className="text-arc-ink"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <>
            <h3 className="text-sm font-semibold">Grade</h3>
            {selected ? (
              <div className="mt-3 space-y-4">
                <div>
                  <label className="text-xs font-medium text-arc-mute">Score out of {maxPoints}</label>
                  <input
                    type="number"
                    min={0}
                    max={maxPoints}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="form-input mt-1 w-full"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-arc-mute">Comments</label>
                  <ul className="mt-2 space-y-2">
                    {(selected.comments ?? []).map((c) => (
                      <li key={c.id} className="border border-arc-ink/10 bg-arc-paper p-2 text-xs">
                        <span className="font-medium">{c.author}</span>
                        <RichContentViewer
                          html={wrapPlainTextAsHtml(c.body)}
                          courseId={effectiveCourseId}
                          spacing="compact"
                          className="mt-1 text-arc-ink"
                        />
                      </li>
                    ))}
                  </ul>
                  <RichPromptField
                    value={commentDraft}
                    onChange={setCommentDraft}
                    courseId={effectiveCourseId}
                    mountKey={`disc-grade-comment-${selected.id}`}
                    placeholder="Add a comment…"
                    height={140}
                    alwaysEdit
                  />
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={richTextIsEmpty(commentDraft)}
                    className="btn-canvas-secondary mt-2 text-sm disabled:opacity-50"
                  >
                    Add comment
                  </button>
                </div>

                <div>
                  <label className="text-xs font-medium text-arc-mute">Feedback to student</label>
                  <ul className="mt-2 space-y-2">
                    {(selected.feedbackEntries ?? []).map((f) => (
                      <li key={f.id} className="border border-arc-ink/10 bg-arc-paper p-2 text-xs">
                        <RichContentViewer
                          html={wrapPlainTextAsHtml(f.body)}
                          courseId={effectiveCourseId}
                          spacing="compact"
                          className="text-arc-ink"
                        />
                      </li>
                    ))}
                  </ul>
                  <RichPromptField
                    value={feedbackDraft}
                    onChange={setFeedbackDraft}
                    courseId={effectiveCourseId}
                    mountKey={`disc-grade-feedback-${selected.id}`}
                    placeholder="Feedback visible to student…"
                    height={140}
                    alwaysEdit
                  />
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-arc-mute">Select a student to grade.</p>
            )}
              </>
            )}
          </div>
          {!studentView && (
          <div className="border-t border-gray-200 p-4">
            <button
              type="button"
              onClick={handleSaveGrade}
              disabled={!selected}
              className="btn-canvas-primary w-full disabled:opacity-50"
            >
              Save grade
            </button>
          </div>
          )}
          {!studentView && topicId && (
            <div className="shrink-0 px-4 pb-4">
              <MissingStudentsPanel
                courseId={effectiveCourseId}
                kind="discussion"
                itemId={topicId}
                gradePath={`/courses/${effectiveCourseId}/discussions/${topicId}/grade`}
              />
            </div>
          )}
        </aside>
    </GradeProShell>
  );
}
