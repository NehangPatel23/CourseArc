import { useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import type { StoredSubmissionFile } from "../../utils/submissionFileStorage";
import { ViewerShell } from "./ViewerChrome";

export default function VideoFileViewer({
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <ViewerShell
      title={fileName}
      onDownload={onDownload}
      fillHeight={fillHeight}
      toolbarExtra={
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-canvas-grayDark hover:bg-gray-50"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {playing ? "Pause" : "Play"}
        </button>
      }
    >
      <div className="flex h-full items-center justify-center bg-black p-4">
        <video
          ref={videoRef}
          src={stored.dataUrl}
          controls
          className={`max-w-full rounded ${fillHeight ? "max-h-full" : "max-h-[70vh]"}`}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          <track kind="captions" />
        </video>
      </div>
    </ViewerShell>
  );
}

export function AudioFileViewer({
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
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-100 to-white p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-canvas-blue/10 text-canvas-blue">
          <Volume2 className="h-9 w-9" />
        </div>
        <p className="max-w-md truncate text-sm font-medium text-canvas-grayDark">{fileName}</p>
        <audio src={stored.dataUrl} controls className="w-full max-w-md">
          <track kind="captions" />
        </audio>
      </div>
    </ViewerShell>
  );
}
