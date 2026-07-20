import { FileSpreadsheet, FileText } from "lucide-react";
import type { FilePreviewKind } from "../../utils/filePreviewKind";
import { ViewerEmptyState, ViewerShell } from "./ViewerChrome";

export default function OfficeFileViewer({
  fileName,
  kind,
  onDownload,
  fillHeight,
}: {
  fileName: string;
  kind: Extract<FilePreviewKind, "docx" | "pptx" | "unknown">;
  onDownload?: () => void;
  fillHeight?: boolean;
}) {
  const label =
    kind === "docx" ? "Word document" : kind === "pptx" ? "PowerPoint presentation" : "File";
  const icon =
    kind === "pptx" ? (
      <FileSpreadsheet className="h-10 w-10 text-orange-500" />
    ) : (
      <FileText className="h-10 w-10 text-blue-600" />
    );

  return (
    <ViewerShell title={fileName} onDownload={onDownload} fillHeight={fillHeight}>
      <ViewerEmptyState
        icon={icon}
        title={`Preview unavailable for ${label.toLowerCase()}`}
        subtitle={`${fileName} can’t be rendered in the browser. Download the file to open it in the appropriate app.`}
        onDownload={onDownload}
      />
    </ViewerShell>
  );
}
