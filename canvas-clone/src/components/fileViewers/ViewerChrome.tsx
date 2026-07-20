import type { ReactNode } from "react";
import { Download } from "lucide-react";

export function ViewerShell({
  title,
  onDownload,
  children,
  fillHeight,
  toolbarExtra,
}: {
  title?: string;
  onDownload?: () => void;
  children: ReactNode;
  fillHeight?: boolean;
  toolbarExtra?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col bg-[#e8eaed] ${
        fillHeight ? "h-full min-h-full" : "min-h-[420px]"
      }`}
    >
      {(title || onDownload || toolbarExtra) && (
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2">
          <p className="min-w-0 truncate text-sm font-medium text-canvas-grayDark">
            {title}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {toolbarExtra}
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-canvas-blue hover:bg-gray-50"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            )}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function ViewerEmptyState({
  icon,
  title,
  subtitle,
  onDownload,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onDownload?: () => void;
}) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">{icon}</div>
      <p className="text-sm font-semibold text-canvas-grayDark">{title}</p>
      <p className="max-w-sm text-xs text-gray-500">{subtitle}</p>
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
        >
          <Download className="h-4 w-4" />
          Download file
        </button>
      )}
    </div>
  );
}
