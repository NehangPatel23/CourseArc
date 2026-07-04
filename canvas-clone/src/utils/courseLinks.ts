import { loadAssignments } from "./assignments";
import { loadTopics } from "./discussions";
import { loadFilesMeta } from "./files";
import { extractPageItems, loadModulesFromStorage, slugifyLabel } from "./modules";
import { normalizePageId } from "./pageStorage";

export type CourseLinkCategory =
  | "page"
  | "file"
  | "module"
  | "assignment"
  | "discussion";

export type CourseLinkOption = {
  id: string;
  category: CourseLinkCategory;
  label: string;
  href: string;
  sublabel?: string;
};

type PageIndexEntry = { id: string; title: string; updatedAt: number };

function pagesIndexKey(courseId: string) {
  return `canvasClone:pagesIndex:${courseId}`;
}

function loadPagesIndex(courseId: string): PageIndexEntry[] {
  try {
    const raw = window.localStorage.getItem(pagesIndexKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function coursePageHref(courseId: string, pageId: string, studentView = true) {
  const id = encodeURIComponent(normalizePageId(pageId));
  if (studentView) {
    return `/courses/${courseId}/pages/${id}/view`;
  }
  return `/courses/${courseId}/pages/${id}`;
}

/** Pick the correct in-app path for pages/files based on viewing role. */
export function resolveCourseContentHref(
  href: string,
  options: { studentView: boolean; courseId?: string; preferPageView?: boolean },
): string {
  const normalized = normalizeInternalHref(href, options.courseId);
  if (!normalized) return href;

  const pageViewMatch = normalized.match(/^\/courses\/([^/]+)\/pages\/([^/]+)\/view$/);
  if (pageViewMatch) {
    const [, cid, pageId] = pageViewMatch;
    return `/courses/${cid}/pages/${pageId}/view`;
  }

  const pageEditMatch = normalized.match(/^\/courses\/([^/]+)\/pages\/([^/]+)$/);
  if (pageEditMatch) {
    const [, cid, pageId] = pageEditMatch;
    if (options.preferPageView || options.studentView) {
      return `/courses/${cid}/pages/${pageId}/view`;
    }
    return `/courses/${cid}/pages/${pageId}`;
  }

  return normalized;
}

export function parseCourseContentHref(href: string): {
  courseId: string;
  kind: "page" | "file" | "assignment" | "discussion" | "module" | "other";
  id?: string;
} | null {
  if (!isInternalCourseHref(href)) return null;

  const pageView = href.match(/^\/courses\/([^/]+)\/pages\/([^/]+)\/view\/?$/);
  if (pageView) return { courseId: pageView[1], kind: "page", id: pageView[2] };

  const page = href.match(/^\/courses\/([^/]+)\/pages\/([^/]+)\/?$/);
  if (page) return { courseId: page[1], kind: "page", id: page[2] };

  const file = href.match(/^\/courses\/([^/]+)\/files\/([^/]+)\/?$/);
  if (file) return { courseId: file[1], kind: "file", id: file[2] };

  const assignment = href.match(/^\/courses\/([^/]+)\/assignments\/([^/]+)\/?$/);
  if (assignment && !href.includes("/edit") && !href.includes("/grade")) {
    return { courseId: assignment[1], kind: "assignment", id: assignment[2] };
  }

  const discussion = href.match(/^\/courses\/([^/]+)\/discussions\/([^/]+)\/?$/);
  if (discussion && !href.includes("/edit")) {
    return { courseId: discussion[1], kind: "discussion", id: discussion[2] };
  }

  if (href.match(/^\/courses\/([^/]+)\/modules\/?$/)) {
    const m = href.match(/^\/courses\/([^/]+)\/modules\/?$/)!;
    return { courseId: m[1], kind: "module" };
  }

  return { courseId: href.split("/")[2] ?? "default", kind: "other" };
}

export function courseFileHref(courseId: string, fileId: string) {
  return `/courses/${courseId}/files/${fileId}`;
}

export function courseModuleHref(courseId: string) {
  return `/courses/${courseId}/modules`;
}

export function courseAssignmentHref(courseId: string, assignmentId: string) {
  return `/courses/${courseId}/assignments/${assignmentId}`;
}

export function courseDiscussionHref(courseId: string, topicId: string) {
  return `/courses/${courseId}/discussions/${topicId}`;
}

export function isInternalCourseHref(href: string, courseId?: string) {
  return normalizeInternalHref(href, courseId) !== null;
}

/** Normalize course links from TinyMCE (may drop leading slash or use relative paths). */
export function normalizeInternalHref(href: string, courseId?: string): string | null {
  let path = href.trim();
  if (!path || path.startsWith("#") || path.startsWith("mailto:") || path.startsWith("javascript:")) {
    return null;
  }

  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      const url = new URL(path);
      if (url.origin !== window.location.origin) return null;
      path = url.pathname;
    }
  } catch {
    return null;
  }

  if (!path.startsWith("/")) {
    if (path.startsWith("courses/")) {
      path = `/${path}`;
    } else if (courseId && /^(pages|files|modules|assignments|discussions)\//.test(path)) {
      path = `/courses/${courseId}/${path}`;
    } else {
      return null;
    }
  }

  if (!path.startsWith("/courses/")) return null;

  const clean = path.split("?")[0].split("#")[0];
  return clean.endsWith("/") && clean.length > 1 ? clean.slice(0, -1) : clean;
}

export function getCourseLinkTargets(courseId: string): CourseLinkOption[] {
  const out: CourseLinkOption[] = [];
  const seen = new Set<string>();

  const add = (opt: CourseLinkOption) => {
    const key = `${opt.category}:${opt.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(opt);
  };

  for (const p of loadPagesIndex(courseId)) {
    add({
      id: p.id,
      category: "page",
      label: p.title || p.id,
      href: coursePageHref(courseId, p.id),
      sublabel: "Page",
    });
  }

  for (const p of extractPageItems(loadModulesFromStorage())) {
    add({
      id: p.pageId,
      category: "page",
      label: p.label,
      href: coursePageHref(courseId, p.pageId),
      sublabel: p.moduleTitle,
    });
  }

  for (const f of loadFilesMeta(courseId)) {
    add({
      id: f.id,
      category: "file",
      label: f.name,
      href: courseFileHref(courseId, f.id),
      sublabel: "File",
    });
  }

  for (const m of loadModulesFromStorage()) {
    add({
      id: slugifyLabel(m.title),
      category: "module",
      label: m.title,
      href: courseModuleHref(courseId),
      sublabel: "Module",
    });

    for (const it of m.items) {
      if (it.type === "file" && it.fileId) {
        add({
          id: it.fileId,
          category: "file",
          label: it.label || it.fileName || "File",
          href: courseFileHref(courseId, it.fileId),
          sublabel: m.title,
        });
      }
      if (it.type === "page") {
        const pageId = it.pageId ?? slugifyLabel(it.label);
        add({
          id: pageId,
          category: "page",
          label: it.label,
          href: coursePageHref(courseId, pageId),
          sublabel: m.title,
        });
      }
    }
  }

  for (const a of loadAssignments(courseId)) {
    add({
      id: a.id,
      category: "assignment",
      label: a.title,
      href: courseAssignmentHref(courseId, a.id),
      sublabel: "Assignment",
    });
  }

  for (const t of loadTopics(courseId)) {
    add({
      id: t.id,
      category: "discussion",
      label: t.title,
      href: courseDiscussionHref(courseId, t.id),
      sublabel: "Discussion",
    });
  }

  return out.sort((a, b) => {
    const cat = a.category.localeCompare(b.category);
    if (cat !== 0) return cat;
    return a.label.localeCompare(b.label);
  });
}

export function buildLinkHtml(href: string, text: string) {
  const safeHref = href.replace(/"/g, "&quot;");
  const safeText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<a href="${safeHref}">${safeText}</a>`;
}

export const CATEGORY_LABELS: Record<CourseLinkCategory, string> = {
  page: "Pages",
  file: "Files",
  module: "Modules",
  assignment: "Assignments",
  discussion: "Discussions",
};
