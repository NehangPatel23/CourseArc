import { idbDeleteBlob, idbGetBlob, idbPutBlob } from "./files";

const PREFIX = "quizAnswerFile:";

export type QuizFileMeta = {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export function quizFileStorageKey(opts: {
  courseId: string;
  quizId: string;
  studentId: string;
  questionId: string;
}): string {
  return `${PREFIX}${opts.courseId}:${opts.quizId}:${opts.studentId}:${opts.questionId}`;
}

export async function saveQuizAnswerFile(storageKey: string, file: File): Promise<QuizFileMeta> {
  await idbPutBlob(storageKey, file);
  return {
    storageKey,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
  };
}

export async function loadQuizAnswerFile(storageKey: string): Promise<Blob | undefined> {
  return idbGetBlob(storageKey);
}

export async function deleteQuizAnswerFile(storageKey: string): Promise<void> {
  await idbDeleteBlob(storageKey);
}

export type QuizUploadPresetId =
  | "pdf"
  | "images"
  | "word"
  | "slides"
  | "spreadsheet"
  | "text"
  | "csv"
  | "zip"
  | "audio"
  | "video";

export const QUIZ_UPLOAD_TYPE_PRESETS: {
  id: QuizUploadPresetId;
  label: string;
  hint?: string;
  specs: string[];
}[] = [
  { id: "pdf", label: "PDF", specs: ["application/pdf", ".pdf"] },
  { id: "images", label: "Images", hint: "PNG, JPG, GIF, WebP", specs: ["image/*"] },
  { id: "word", label: "Word", specs: [".doc", ".docx"] },
  { id: "slides", label: "PowerPoint", specs: [".ppt", ".pptx"] },
  { id: "spreadsheet", label: "Excel", specs: [".xls", ".xlsx"] },
  { id: "text", label: "Plain text", specs: [".txt", "text/plain"] },
  { id: "csv", label: "CSV", specs: [".csv", "text/csv"] },
  { id: "zip", label: "ZIP", specs: [".zip", "application/zip"] },
  { id: "audio", label: "Audio", specs: ["audio/*"] },
  { id: "video", label: "Video", specs: ["video/*"] },
];

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

export function specsFromUploadPresetIds(ids: QuizUploadPresetId[]): string[] {
  const want = new Set(ids);
  return QUIZ_UPLOAD_TYPE_PRESETS.filter((p) => want.has(p.id)).flatMap((p) => p.specs);
}

export const DEFAULT_QUIZ_UPLOAD_SPECS = specsFromUploadPresetIds(["pdf", "images", "text"]);

export function selectedUploadPresetIds(types: string[] | undefined): QuizUploadPresetId[] {
  if (!types?.length) return [];
  const set = new Set(types.map((t) => t.trim().toLowerCase()).filter(Boolean));
  return QUIZ_UPLOAD_TYPE_PRESETS.filter((preset) => {
    if (preset.specs.some((s) => set.has(s.toLowerCase()))) return true;
    if (preset.id === "images") {
      return [...set].some((s) => s.startsWith("image/") || IMAGE_EXTS.has(s));
    }
    return false;
  }).map((p) => p.id);
}

const PRESET_SPEC_SET = new Set(
  QUIZ_UPLOAD_TYPE_PRESETS.flatMap((p) => p.specs.map((s) => s.toLowerCase())),
);

/** Specs the instructor typed that are not covered by a checkbox preset. */
export function customUploadTypeSpecs(types: string[] | undefined): string[] {
  if (!types?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of types) {
    const spec = raw.trim().toLowerCase();
    if (!spec || seen.has(spec)) continue;
    if (PRESET_SPEC_SET.has(spec)) continue;
    if (spec.startsWith("image/") || IMAGE_EXTS.has(spec)) continue;
    seen.add(spec);
    out.push(spec);
  }
  return out;
}

export function parseCustomUploadSpecs(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;]+/)) {
    let spec = part.trim().toLowerCase();
    if (!spec) continue;
    if (!spec.includes("/") && !spec.startsWith(".")) spec = `.${spec}`;
    if (seen.has(spec)) continue;
    seen.add(spec);
    out.push(spec);
  }
  return out;
}

export function formatAllowedTypes(types: string[] | undefined): string {
  if (!types?.length) return "Any file";
  const ids = selectedUploadPresetIds(types);
  const custom = customUploadTypeSpecs(types);
  const labels = new Map(QUIZ_UPLOAD_TYPE_PRESETS.map((p) => [p.id, p.label]));
  const parts = [...ids.map((id) => labels.get(id) ?? id), ...custom];
  return parts.length ? parts.join(", ") : types.join(", ");
}

export function fileMatchesAllowed(file: File, types: string[] | undefined): boolean {
  if (!types?.length) return true;
  return types.some((t) => {
    const spec = t.trim().toLowerCase();
    if (!spec) return true;
    if (spec.endsWith("/*")) {
      return file.type.toLowerCase().startsWith(spec.slice(0, -1));
    }
    if (spec.startsWith(".")) {
      return file.name.toLowerCase().endsWith(spec);
    }
    return file.type.toLowerCase() === spec;
  });
}

export async function downloadQuizAnswerFile(meta: QuizFileMeta): Promise<void> {
  const blob = await loadQuizAnswerFile(meta.storageKey);
  if (!blob) throw new Error("File is not available on this device");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = meta.fileName || "upload";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
