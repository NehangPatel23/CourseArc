const SUBMISSION_FILE_PREFIX = "canvasClone:submissionFile:";
const COMMENT_ATTACHMENT_PREFIX = "canvasClone:commentAttachment:";

export type StoredSubmissionFile = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
};

const MAX_STORE_BYTES = 4 * 1024 * 1024;

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function saveSubmissionFile(submissionId: string, file: StoredSubmissionFile): boolean {
  try {
    if (file.size > MAX_STORE_BYTES) return false;
    window.localStorage.setItem(`${SUBMISSION_FILE_PREFIX}${submissionId}`, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

export async function saveSubmissionFileFromUpload(
  submissionId: string,
  file: File,
): Promise<{ saved: boolean; tooLarge: boolean }> {
  if (file.size > MAX_STORE_BYTES) {
    return { saved: false, tooLarge: true };
  }
  const dataUrl = await readFileAsDataUrl(file);
  const saved = saveSubmissionFile(submissionId, {
    dataUrl,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  });
  return { saved, tooLarge: false };
}

export function getSubmissionFile(submissionId: string): StoredSubmissionFile | null {
  try {
    const raw = window.localStorage.getItem(`${SUBMISSION_FILE_PREFIX}${submissionId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSubmissionFile;
  } catch {
    return null;
  }
}

export function deleteSubmissionFile(submissionId: string) {
  try {
    window.localStorage.removeItem(`${SUBMISSION_FILE_PREFIX}${submissionId}`);
  } catch {}
}

export function downloadStoredFile(stored: StoredSubmissionFile) {
  const link = document.createElement("a");
  link.href = stored.dataUrl;
  link.download = stored.fileName;
  link.click();
}

export function saveCommentAttachment(commentId: string, file: StoredSubmissionFile): boolean {
  try {
    if (file.size > MAX_STORE_BYTES) return false;
    window.localStorage.setItem(`${COMMENT_ATTACHMENT_PREFIX}${commentId}`, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

export async function saveCommentAttachmentFromUpload(
  commentId: string,
  file: File,
): Promise<{ saved: boolean; tooLarge: boolean }> {
  if (file.size > MAX_STORE_BYTES) {
    return { saved: false, tooLarge: true };
  }
  const dataUrl = await readFileAsDataUrl(file);
  const saved = saveCommentAttachment(commentId, {
    dataUrl,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  });
  return { saved, tooLarge: false };
}

export function getCommentAttachment(commentId: string): StoredSubmissionFile | null {
  try {
    const raw = window.localStorage.getItem(`${COMMENT_ATTACHMENT_PREFIX}${commentId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSubmissionFile;
  } catch {
    return null;
  }
}

export function deleteCommentAttachment(commentId: string) {
  try {
    window.localStorage.removeItem(`${COMMENT_ATTACHMENT_PREFIX}${commentId}`);
  } catch {}
}
