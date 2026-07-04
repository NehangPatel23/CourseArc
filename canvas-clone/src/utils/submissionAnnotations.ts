import { loadUser } from "./userStore";
import { uid } from "./assignments";

export type DocumentAnnotation = {
  id: string;
  type: "pin" | "text";
  page: number;
  /** Position as percentage of document width (0–100). */
  xPct: number;
  /** Position as percentage of document height (0–100). */
  yPct: number;
  body: string;
  author: string;
  createdAt: number;
};

const PREFIX = "canvasClone:docAnnotations:";

function key(submissionId: string) {
  return `${PREFIX}${submissionId}`;
}

export function loadDocumentAnnotations(submissionId: string): DocumentAnnotation[] {
  try {
    const raw = window.localStorage.getItem(key(submissionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDocumentAnnotations(submissionId: string, items: DocumentAnnotation[]) {
  try {
    window.localStorage.setItem(key(submissionId), JSON.stringify(items));
    window.dispatchEvent(new Event("canvasClone:docAnnotationsChanged"));
  } catch {}
}

export function addDocumentAnnotation(
  submissionId: string,
  data: Omit<DocumentAnnotation, "id" | "author" | "createdAt">,
): DocumentAnnotation {
  const user = loadUser();
  const annotation: DocumentAnnotation = {
    ...data,
    id: uid("ann"),
    author: user.name,
    createdAt: Date.now(),
  };
  const all = loadDocumentAnnotations(submissionId);
  saveDocumentAnnotations(submissionId, [...all, annotation]);
  return annotation;
}

export function updateDocumentAnnotation(
  submissionId: string,
  annotationId: string,
  patch: Partial<Pick<DocumentAnnotation, "body" | "xPct" | "yPct">>,
) {
  const all = loadDocumentAnnotations(submissionId);
  saveDocumentAnnotations(
    submissionId,
    all.map((a) => (a.id === annotationId ? { ...a, ...patch } : a)),
  );
}

export function deleteDocumentAnnotation(submissionId: string, annotationId: string) {
  const all = loadDocumentAnnotations(submissionId);
  saveDocumentAnnotations(
    submissionId,
    all.filter((a) => a.id !== annotationId),
  );
}
