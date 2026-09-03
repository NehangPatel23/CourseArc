import CourseFilePreview from "./CourseFilePreview";
import type { FilePreviewKind } from "../../utils/filePreviewKind";

export default function OfficeFileViewer({
  fileName,
  kind: _kind,
  onDownload: _onDownload,
  fillHeight: _fillHeight,
  blobUrl,
  mime,
  size,
}: {
  fileName: string;
  kind: Extract<FilePreviewKind, "docx" | "pptx" | "spreadsheet" | "archive" | "unknown">;
  onDownload?: () => void;
  fillHeight?: boolean;
  blobUrl?: string | null;
  mime?: string;
  size?: number;
}) {
  return (
    <CourseFilePreview
      blobUrl={blobUrl}
      fileName={fileName}
      mime={mime}
      size={size}
    />
  );
}
