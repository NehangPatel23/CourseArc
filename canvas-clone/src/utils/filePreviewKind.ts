import { fileExtension } from "./assignmentDisplay";

export type FilePreviewKind =
  | "image"
  | "pdf"
  | "text"
  | "html"
  | "csv"
  | "docx"
  | "pptx"
  | "spreadsheet"
  | "archive"
  | "video"
  | "audio"
  | "unknown";

const TEXT_EXTS = [
  "txt",
  "md",
  "markdown",
  "json",
  "xml",
  "yml",
  "yaml",
  "toml",
  "ini",
  "log",
  "tex",
  "rtf",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "rb",
  "go",
  "java",
  "c",
  "h",
  "cpp",
  "cc",
  "cs",
  "rs",
  "swift",
  "kt",
  "php",
  "sql",
  "sh",
  "bash",
  "zsh",
  "css",
  "scss",
  "less",
  "env",
];

const SPREADSHEET_EXTS = ["xlsx", "xls", "ods", "tsv"];
const ARCHIVE_EXTS = ["zip", "rar", "7z", "tar", "gz", "tgz"];

export function detectPreviewKind(
  fileName: string,
  mimeType?: string,
): FilePreviewKind {
  const ext = fileExtension(fileName).toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();

  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)
  ) {
    return "image";
  }
  if (ext === "html" || ext === "htm" || mime === "text/html") return "html";
  if (ext === "csv" || mime === "text/csv") return "csv";
  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime.endsWith("+json") ||
    mime.endsWith("+xml") ||
    TEXT_EXTS.includes(ext)
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
  if (ext === "docx" || mime.includes("wordprocessingml") || ext === "doc") {
    return "docx";
  }
  if (ext === "pptx" || mime.includes("presentationml") || ext === "ppt") {
    return "pptx";
  }
  if (
    SPREADSHEET_EXTS.includes(ext) ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  ) {
    return "spreadsheet";
  }
  if (
    ARCHIVE_EXTS.includes(ext) ||
    mime.includes("zip") ||
    mime.includes("compressed") ||
    mime.includes("tar")
  ) {
    return "archive";
  }
  return "unknown";
}

export function previewKindLabel(kind: FilePreviewKind): string {
  switch (kind) {
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    case "text":
      return "Text";
    case "html":
      return "HTML";
    case "csv":
      return "Spreadsheet";
    case "docx":
      return "Document";
    case "pptx":
      return "Presentation";
    case "spreadsheet":
      return "Spreadsheet";
    case "archive":
      return "Archive";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    default:
      return "File";
  }
}
