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
};

const VIEWER_CLASSES = [
  "rich-content-viewer",
  "text-canvas-grayDark text-[15px] leading-7",
  "[&_p]:my-3",
  "[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:my-4",
  "[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:my-4",
  "[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:my-3",
  "[&_h4]:text-lg [&_h4]:font-semibold [&_h4]:my-2",
  "[&_strong]:font-semibold",
  "[&_em]:italic",
  "[&_ol]:list-decimal [&_ol]:pl-7 [&_ol]:my-3",
  "[&_ul]:list-disc [&_ul]:pl-7 [&_ul]:my-3",
  "[&_li]:my-1",
  "[&_a]:text-canvas-blue [&_a]:underline [&_a]:font-medium [&_a]:cursor-pointer",
  "[&_img]:max-w-full [&_img]:h-auto",
  RICH_CONTENT_VIEWER_CODE_CLASSES,
  "[&_.canvas-equation-inline]:inline [&_.canvas-equation-inline]:align-baseline [&_.canvas-equation-inline]:leading-[inherit]",
  "[&_.canvas-equation-inline_.katex]:inline-block [&_.canvas-equation-inline_.katex]:align-baseline [&_.canvas-equation-inline_.katex]:text-[1em]",
  "[&_.canvas-equation-block]:block [&_.canvas-equation-block]:w-full [&_.canvas-equation-block]:text-center [&_.canvas-equation-block]:my-3",
  "[&_.canvas-equation-block_.katex]:block [&_.canvas-equation-block_.katex]:mx-auto",
].join(" ");

export default function RichContentViewer({ html, className = "", courseId }: Props) {
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
      className={`${VIEWER_CLASSES} ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
