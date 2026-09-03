import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { wrapPlainTextAsHtml, renderRichContentInContainer, RICH_CONTENT_VIEWER_CODE_CLASSES } from "../utils/richContent";
import {
  handleCourseContentLinkClick,
  patchInternalLinkHrefs,
} from "../utils/courseContentNavigation";
import { useStudentView } from "../utils/studentView";

type Props = {
  html: string;
  className?: string;
  courseId?: string;
  /**
   * `default` — assignments, pages, quizzes, discussions, syllabus.
   * `loose` — course home landing.
   * `compact` — chips, comments, click-to-edit previews.
   */
  spacing?: "default" | "loose" | "compact";
};

const VIEWER_BASE = [
  "rich-content-viewer",
  "text-canvas-grayDark text-[15px] leading-7",
  "[&>:first-child]:mt-0",
  "[&_strong]:font-semibold",
  "[&_em]:italic",
  "[&_ol]:list-decimal [&_ol]:pl-7",
  "[&_ul]:list-disc [&_ul]:pl-7",
  "[&_a]:text-canvas-blue [&_a]:underline [&_a]:font-medium [&_a]:cursor-pointer",
  "[&_blockquote]:border-l-4 [&_blockquote]:border-arc-copper [&_blockquote]:bg-arc-copper-tint/70 [&_blockquote]:not-italic",
  "[&_blockquote_p]:my-0",
  "[&_hr]:border-arc-line",
  "[&_table]:w-full [&_table]:border-collapse",
  "[&_th]:border-b [&_th]:border-arc-ink/20 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_th]:text-arc-ink",
  "[&_td]:border-b [&_td]:border-arc-line [&_td]:align-top [&_td]:text-[15px]",
  "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md",
  RICH_CONTENT_VIEWER_CODE_CLASSES,
  "[&_.canvas-equation-inline]:inline [&_.canvas-equation-inline]:align-baseline [&_.canvas-equation-inline]:leading-[inherit]",
  "[&_.canvas-equation-inline_.katex]:inline-block [&_.canvas-equation-inline_.katex]:align-baseline [&_.canvas-equation-inline_.katex]:text-[1em]",
  "[&_.canvas-equation-block]:block [&_.canvas-equation-block]:w-full [&_.canvas-equation-block]:text-center",
  "[&_.canvas-equation-block_.katex]:block [&_.canvas-equation-block_.katex]:mx-auto",
].join(" ");

const VIEWER_SPACING = {
  compact: [
    "[&_p]:my-2.5",
    "[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:my-3",
    "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:my-3",
    "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-2",
    "[&_h4]:text-base [&_h4]:font-semibold [&_h4]:my-2",
    "[&_ol]:my-2.5",
    "[&_ul]:my-2.5",
    "[&_li]:my-1",
    "[&_blockquote]:my-3 [&_blockquote]:px-3 [&_blockquote]:py-2.5",
    "[&_hr]:my-4",
    "[&_table]:my-3",
    "[&_th]:py-1.5 [&_th]:pr-3",
    "[&_td]:py-2 [&_td]:pr-3 [&_td]:leading-6",
    "[&_.canvas-equation-block]:my-2",
  ].join(" "),
  default: [
    "[&_p]:my-4 [&_p]:leading-8",
    "[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:mt-8 [&_h1]:mb-4",
    "[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-9 [&_h2]:mb-4",
    "[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-7 [&_h3]:mb-3",
    "[&_h4]:text-lg [&_h4]:font-semibold [&_h4]:mt-5 [&_h4]:mb-2",
    "[&_ol]:my-5 [&_ol]:space-y-2.5",
    "[&_ul]:my-5 [&_ul]:space-y-2.5",
    "[&_li]:my-0 [&_li]:leading-7",
    "[&_blockquote]:my-7 [&_blockquote]:px-5 [&_blockquote]:py-4",
    "[&_hr]:my-8",
    "[&_table]:my-6",
    "[&_th]:py-3 [&_th]:pr-4",
    "[&_td]:py-3.5 [&_td]:pr-4 [&_td]:leading-7",
    "[&_.canvas-equation-block]:my-4",
  ].join(" "),
  loose: [
    "[&_p]:my-5 [&_p]:leading-8",
    "[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:mt-10 [&_h1]:mb-5",
    "[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-12 [&_h2]:mb-5",
    "[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3",
    "[&_h4]:text-lg [&_h4]:font-semibold [&_h4]:mt-6 [&_h4]:mb-3",
    "[&_ol]:my-6 [&_ol]:space-y-3",
    "[&_ul]:my-6 [&_ul]:space-y-3",
    "[&_li]:my-0 [&_li]:leading-7",
    "[&_blockquote]:my-10 [&_blockquote]:px-6 [&_blockquote]:py-5",
    "[&_hr]:my-10",
    "[&_table]:my-8",
    "[&_th]:py-3 [&_th]:pr-5",
    "[&_td]:py-4 [&_td]:pr-5 [&_td]:leading-7",
    "[&_.canvas-equation-block]:my-5",
  ].join(" "),
};

export default function RichContentViewer({
  html,
  className = "",
  courseId,
  spacing = "default",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { studentView } = useStudentView(courseId);
  const content = wrapPlainTextAsHtml(html) || "<p></p>";

  useEffect(() => {
    const t = window.setTimeout(() => {
      renderRichContentInContainer(ref.current);
      patchInternalLinkHrefs(ref.current, courseId);
    }, 0);
    return () => window.clearTimeout(t);
  }, [content, courseId]);

  return (
    <div
      ref={ref}
      onClick={(e) =>
        handleCourseContentLinkClick(e, {
          studentView,
          courseId,
          location,
          navigate,
          preferPageView: true,
        })
      }
      className={`${VIEWER_BASE} ${VIEWER_SPACING[spacing]} ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
