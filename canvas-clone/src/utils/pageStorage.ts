export function normalizePageId(pageId: string) {
  try {
    return decodeURIComponent(pageId);
  } catch {
    return pageId;
  }
}

export function pageStorageKey(courseId: string, pageId: string) {
  return `canvasClone:page:${courseId}:${normalizePageId(pageId)}`;
}

export function pageStorageKeyCandidates(courseId: string, pageId: string) {
  const normalized = normalizePageId(pageId);
  return [
    `canvasClone:page:${courseId}:${normalized}`,
    `canvasClone:page:${courseId}:${pageId}`,
    `canvasClone:page:${courseId}:${encodeURIComponent(normalized)}`,
  ].filter((k, i, arr) => arr.indexOf(k) === i);
}

export type PageContent = { title?: string; content?: string };

export function readPageContent(courseId: string, pageId: string): PageContent | null {
  for (const key of pageStorageKeyCandidates(courseId, pageId)) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as PageContent;
      return parsed;
    } catch {
      continue;
    }
  }
  return null;
}
