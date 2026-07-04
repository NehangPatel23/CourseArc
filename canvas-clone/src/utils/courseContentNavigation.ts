import type { Location, NavigateFunction } from "react-router-dom";
import type { MouseEvent } from "react";
import { normalizeInternalHref, resolveCourseContentHref } from "./courseLinks";

export function handleCourseContentLinkClick(
  e: MouseEvent,
  options: {
    studentView: boolean;
    courseId?: string;
    location: Location;
    navigate: NavigateFunction;
    preferPageView?: boolean;
  },
) {
  const anchor = (e.target as HTMLElement).closest("a");
  if (!anchor) return;

  const normalized = normalizeInternalHref(anchor.getAttribute("href") ?? "", options.courseId);
  if (!normalized) return;

  e.preventDefault();
  e.stopPropagation();

  const target = resolveCourseContentHref(normalized, {
    studentView: options.studentView,
    courseId: options.courseId,
    preferPageView: options.preferPageView ?? true,
  });
  options.navigate(target, {
    state: { from: options.location.pathname + options.location.search },
  });
}

export function patchInternalLinkHrefs(root: HTMLElement | null, courseId?: string) {
  if (!root) return;
  root.querySelectorAll("a[href]").forEach((node) => {
    const anchor = node as HTMLAnchorElement;
    const normalized = normalizeInternalHref(anchor.getAttribute("href") ?? "", courseId);
    if (normalized) {
      anchor.setAttribute("href", normalized);
      anchor.setAttribute("target", "_self");
    }
  });
}
