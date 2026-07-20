import type { StoredSubmissionFile } from "../../utils/submissionFileStorage";
import { ViewerShell } from "./ViewerChrome";

export default function PdfFileViewer({
  stored,
  fileName,
  onDownload,
  fillHeight,
}: {
  stored: StoredSubmissionFile;
  fileName: string;
  onDownload?: () => void;
  fillHeight?: boolean;
}) {
  return (
    <ViewerShell title={fileName} onDownload={onDownload} fillHeight={fillHeight}>
      <iframe
        title={fileName}
        src={stored.dataUrl}
        className={`w-full border-0 bg-white ${fillHeight ? "h-full min-h-full" : "min-h-[560px]"}`}
      />
    </ViewerShell>
  );
}
