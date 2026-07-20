import RichContentViewer from "./RichContentViewer";
import SubmissionFileViewer from "./SubmissionFileViewer";
import type { StoredSubmissionFile } from "../utils/submissionFileStorage";

type PreviewTarget =
  | { kind: "file"; stored: StoredSubmissionFile | null; fileName: string }
  | { kind: "text"; body: string; courseId: string };

type Props = {
  target: PreviewTarget;
  onDownload?: () => void;
  fillHeight?: boolean;
  readOnly?: boolean;
};

export default function SubmissionContentPreview({
  target,
  onDownload,
  fillHeight,
  readOnly,
}: Props) {
  if (target.kind === "text") {
    return (
      <div className={`bg-white p-6 ${fillHeight ? "min-h-full" : "min-h-[320px]"}`}>
        <RichContentViewer html={target.body} courseId={target.courseId} />
      </div>
    );
  }

  return (
    <SubmissionFileViewer
      stored={target.stored}
      fileName={target.fileName}
      onDownload={onDownload}
      fillHeight={fillHeight}
      readOnly={readOnly}
    />
  );
}
