import type { StoredSubmissionFile } from "../../utils/submissionFileStorage";
import { ViewerShell } from "./ViewerChrome";

export default function ImageFileViewer({
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
      <div className="flex h-full items-center justify-center p-4">
        <img
          src={stored.dataUrl}
          alt={fileName}
          className={`max-w-full rounded border border-gray-200 bg-white object-contain shadow-sm ${
            fillHeight ? "max-h-full" : "max-h-[70vh]"
          }`}
        />
      </div>
    </ViewerShell>
  );
}
