import { FileText } from "lucide-react";
import { detectPreviewKind } from "../utils/filePreviewKind";
import {
  downloadStoredFile,
  type StoredSubmissionFile,
} from "../utils/submissionFileStorage";
import ImageFileViewer from "./fileViewers/ImageFileViewer";
import PdfFileViewer from "./fileViewers/PdfFileViewer";
import VideoFileViewer, { AudioFileViewer } from "./fileViewers/VideoFileViewer";
import OfficeFileViewer from "./fileViewers/OfficeFileViewer";
import CourseFilePreview from "./fileViewers/CourseFilePreview";
import { ViewerEmptyState, ViewerShell } from "./fileViewers/ViewerChrome";

type Props = {
  stored: StoredSubmissionFile | null;
  fileName: string;
  onDownload?: () => void;
  fillHeight?: boolean;
  readOnly?: boolean;
};

export default function SubmissionFileViewer({
  stored,
  fileName,
  onDownload,
  fillHeight,
}: Props) {
  const handleDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (stored) downloadStoredFile(stored);
  };

  if (!stored) {
    return (
      <ViewerShell title={fileName} onDownload={onDownload} fillHeight={fillHeight}>
        <ViewerEmptyState
          icon={<FileText className="h-10 w-10 text-gray-400" />}
          title="Preview unavailable"
          subtitle="This file may have been submitted before preview storage was enabled, or it was too large to store locally."
          onDownload={onDownload}
        />
      </ViewerShell>
    );
  }

  const kind = detectPreviewKind(fileName, stored.mimeType);

  switch (kind) {
    case "image":
      return (
        <ImageFileViewer
          stored={stored}
          fileName={fileName}
          onDownload={handleDownload}
          fillHeight={fillHeight}
        />
      );
    case "pdf":
      return (
        <PdfFileViewer
          stored={stored}
          fileName={fileName}
          onDownload={handleDownload}
          fillHeight={fillHeight}
        />
      );
    case "video":
      return (
        <VideoFileViewer
          stored={stored}
          fileName={fileName}
          onDownload={handleDownload}
          fillHeight={fillHeight}
        />
      );
    case "audio":
      return (
        <AudioFileViewer
          stored={stored}
          fileName={fileName}
          onDownload={handleDownload}
          fillHeight={fillHeight}
        />
      );
    case "text":
    case "html":
    case "csv":
      return (
        <CourseFilePreview
          blobUrl={stored.dataUrl}
          fileName={fileName}
          mime={stored.mimeType}
          size={stored.size}
        />
      );
    case "docx":
    case "pptx":
    case "spreadsheet":
    case "archive":
    case "unknown":
    default:
      return (
        <OfficeFileViewer
          fileName={fileName}
          kind={
            kind === "docx" ||
            kind === "pptx" ||
            kind === "spreadsheet" ||
            kind === "archive"
              ? kind
              : "unknown"
          }
          blobUrl={stored.dataUrl}
          mime={stored.mimeType}
          size={stored.size}
          onDownload={handleDownload}
          fillHeight={fillHeight}
        />
      );
  }
}
