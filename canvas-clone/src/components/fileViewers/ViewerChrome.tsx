import type { ReactNode } from "react";
import Icon from "../../icons/Icon";

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
      className={`flex flex-col bg-arc-paper ${
        fillHeight ? "h-full min-h-full" : "min-h-[420px]"
      }`}
    >
      {(title || onDownload || toolbarExtra) && (
        <div className="flex items-center justify-between gap-3 border-b border-arc-ink/10 bg-arc-ivory px-4 py-2">
          <p className="min-w-0 truncate text-sm font-medium text-arc-ink">
            {title}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {toolbarExtra}
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1 rounded-md border border-arc-ink/15 px-2.5 py-1 text-xs font-medium text-arc-copper hover:bg-arc-paper"
              >
                <Icon name="download" size={14} />
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
      <div className="rounded-2xl border border-arc-ink/10 bg-arc-ivory p-4">{icon}</div>
      <p className="text-sm font-semibold text-arc-ink">{title}</p>
      <p className="max-w-sm text-xs text-arc-mute">{subtitle}</p>
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1 text-sm text-arc-copper hover:underline"
        >
          <Icon name="download" size={16} />
          Download file
        </button>
      )}
    </div>
  );
}
