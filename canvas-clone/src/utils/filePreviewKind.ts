import { fileExtension } from "./assignmentDisplay";

export type FilePreviewKind =
  | "image"
  | "pdf"
  | "text"
  | "docx"
  | "pptx"
  | "video"
  | "audio"
  | "unknown";

export function detectPreviewKind(
  fileName: string,
  mimeType?: string,
): FilePreviewKind {
  const ext = fileExtension(fileName).toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();

  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)
  ) {
    return "image";
  }
  if (
    mime.startsWith("text/") ||
    ["txt", "html", "htm", "md", "csv", "json", "xml"].includes(ext)
  ) {
    return "text";
  }
  if (
    mime.startsWith("video/") ||
    ["mp4", "webm", "ogg", "mov", "m4v"].includes(ext)
  ) {
    return "video";
  }
  if (
    mime.startsWith("audio/") ||
    ["mp3", "wav", "m4a", "aac", "flac", "oga"].includes(ext)
  ) {
    return "audio";
  }
  if (
    ext === "docx" ||
    mime.includes("wordprocessingml") ||
    ext === "doc"
  ) {
    return "docx";
  }
  if (
    ext === "pptx" ||
    mime.includes("presentationml") ||
    ext === "ppt"
  ) {
    return "pptx";
  }
  return "unknown";
}
