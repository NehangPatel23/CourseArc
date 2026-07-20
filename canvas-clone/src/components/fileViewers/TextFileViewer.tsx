import { useMemo } from "react";
import type { StoredSubmissionFile } from "../../utils/submissionFileStorage";
import { ViewerShell } from "./ViewerChrome";

function decodeTextContent(stored: StoredSubmissionFile): string {
  const comma = stored.dataUrl.indexOf(",");
  if (comma < 0) return "";
  const meta = stored.dataUrl.slice(0, comma);
  const payload = stored.dataUrl.slice(comma + 1);
  const binary = atob(payload);
  if (meta.includes("base64")) {
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return decodeURIComponent(payload);
}

export default function TextFileViewer({
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
  const text = useMemo(() => decodeTextContent(stored), [stored]);

  return (
    <ViewerShell title={fileName} onDownload={onDownload} fillHeight={fillHeight}>
      <pre
        className={`overflow-auto whitespace-pre-wrap break-words bg-white p-6 font-mono text-sm text-gray-800 ${
          fillHeight ? "h-full" : "min-h-[420px]"
        }`}
      >
        {text || "(Empty file)"}
      </pre>
    </ViewerShell>
  );
}
