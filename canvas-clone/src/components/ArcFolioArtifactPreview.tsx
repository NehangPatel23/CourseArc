import { Link } from "react-router-dom";
import {
  ExternalLink,
  Eye,
  FileArchive,
  FileText,
  Github,
  Globe,
  HelpCircle,
  Link2,
  MessageSquare,
} from "lucide-react";
import CanvasModal from "./CanvasModal";
import RichContentViewer from "./RichContentViewer";
import SubmissionContentPreview from "./SubmissionContentPreview";
import SubmissionFileViewer from "./SubmissionFileViewer";
import {
  resolveArcFolioPreview,
  type ArcFolioFilePreview,
  type ArcFolioPreview,
} from "../utils/arcFolioPreview";
import {
  portfolioEntryHref,
  type PortfolioEntry,
} from "../utils/ePortfolioStore";
import { downloadPortfolioFile } from "../utils/portfolioFileStorage";
import { downloadStoredFile } from "../utils/submissionFileStorage";

function formatWhen(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FileThumb({ file }: { file: ArcFolioFilePreview }) {
  if (file.kind === "image" && file.stored) {
    return (
      <img
        src={file.stored.dataUrl}
        alt={file.fileName}
        className="h-full w-full object-cover"
      />
    );
  }
  const Icon =
    file.kind === "pdf"
      ? FileText
      : file.kind === "unknown"
        ? FileArchive
        : FileText;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
      <Icon className="h-8 w-8 text-gray-400" />
      <p className="line-clamp-2 text-xs font-medium text-gray-600">{file.fileName}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-400">
        {file.stored ? "Click to preview" : "Preview unavailable"}
      </p>
    </div>
  );
}

function CardChrome({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative mb-3 h-36 w-full overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100 text-left transition hover:border-canvas-blue/40 hover:shadow-sm"
    >
      {children}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/45 to-transparent py-2 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
        <Eye className="h-3.5 w-3.5" />
        Preview
      </span>
    </button>
  );
}

export function ArcFolioCardPreview({
  entry,
  studentId,
  onOpenPreview,
}: {
  entry: PortfolioEntry;
  studentId: string;
  onOpenPreview: () => void;
}) {
  const preview = resolveArcFolioPreview(entry, studentId);

  if (preview.kind === "assignment-file" || preview.kind === "external-file") {
    return (
      <CardChrome onClick={onOpenPreview}>
        <FileThumb file={preview.file} />
      </CardChrome>
    );
  }

  if (preview.kind === "assignment-text") {
    return (
      <CardChrome onClick={onOpenPreview}>
        <div className="flex h-full flex-col justify-between p-3">
          <p className="line-clamp-5 text-xs leading-relaxed text-gray-700">
            {preview.excerpt}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Text submission
          </p>
        </div>
      </CardChrome>
    );
  }

  if (preview.kind === "quiz") {
    return (
      <CardChrome onClick={onOpenPreview}>
        <div className="flex h-full items-center gap-4 px-4">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full bg-violet-100 text-violet-800">
            <HelpCircle className="mb-0.5 h-4 w-4" />
            <span className="text-sm font-bold tabular-nums">
              {preview.scoreLabel ?? "—"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-canvas-grayDark">
              {preview.quizTitle}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {preview.attempts.length === 0
                ? "No attempts yet"
                : `${preview.attempts.length} attempt${
                    preview.attempts.length === 1 ? "" : "s"
                  }`}
            </p>
          </div>
        </div>
      </CardChrome>
    );
  }

  if (preview.kind === "discussion") {
    return (
      <CardChrome onClick={onOpenPreview}>
        <div className="flex h-full flex-col justify-between p-3">
          <div className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="line-clamp-4 text-xs leading-relaxed text-gray-700">
              {preview.excerpt}
            </p>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {preview.replyCount}{" "}
            {preview.replyCount === 1 ? "reply" : "replies"}
          </p>
        </div>
      </CardChrome>
    );
  }

  if (preview.kind === "external-url") {
    const Icon =
      preview.externalType === "github"
        ? Github
        : preview.externalType === "website"
          ? Globe
          : Link2;
    return (
      <CardChrome onClick={onOpenPreview}>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-gray-200/80 bg-white/70 px-3 py-1.5">
            <span className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-red-300" />
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            <span className="min-w-0 truncate rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
              {preview.pathLabel}
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
            <Icon className="h-7 w-7 text-amber-700/80" />
            <p className="line-clamp-2 text-xs font-medium text-gray-700">
              {preview.description || preview.host}
            </p>
          </div>
        </div>
      </CardChrome>
    );
  }

  return (
    <CardChrome onClick={onOpenPreview}>
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <FileText className="h-7 w-7 text-gray-400" />
        <p className="text-xs text-gray-500">
          {preview.kind === "unavailable" || preview.kind === "assignment-empty"
            ? preview.message
            : "Preview unavailable"}
        </p>
      </div>
    </CardChrome>
  );
}

function FullPreviewBody({
  preview,
  entry,
}: {
  preview: ArcFolioPreview;
  entry: PortfolioEntry;
}) {
  if (preview.kind === "assignment-text") {
    return (
      <SubmissionContentPreview
        target={{ kind: "text", body: preview.body, courseId: preview.courseId }}
        fillHeight
        readOnly
      />
    );
  }

  if (preview.kind === "assignment-file") {
    return (
      <SubmissionContentPreview
        target={{
          kind: "file",
          stored: preview.file.stored,
          fileName: preview.file.fileName,
        }}
        onDownload={
          preview.file.stored
            ? () => downloadStoredFile(preview.file.stored!)
            : undefined
        }
        fillHeight
        readOnly
      />
    );
  }

  if (preview.kind === "external-file") {
    return (
      <div className="space-y-3 p-4">
        {preview.description && (
          <p className="text-sm text-gray-600">{preview.description}</p>
        )}
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <SubmissionFileViewer
            stored={preview.file.stored}
            fileName={preview.file.fileName}
            onDownload={
              preview.file.stored
                ? () => downloadPortfolioFile(preview.file.stored!)
                : undefined
            }
            fillHeight
          />
        </div>
      </div>
    );
  }

  if (preview.kind === "quiz") {
    return (
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-violet-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              Final score
            </p>
            <p className="text-2xl font-bold tabular-nums text-violet-900">
              {preview.scoreLabel ?? "—"}
            </p>
          </div>
          <p className="text-sm text-violet-700/80">
            {preview.attempts.length} attempt
            {preview.attempts.length === 1 ? "" : "s"}
          </p>
        </div>
        {preview.attempts.length === 0 ? (
          <p className="text-sm text-gray-500">No quiz attempts to show.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {preview.attempts.map((a) => (
              <li
                key={a.attemptNumber}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="font-medium text-canvas-grayDark">
                  Attempt {a.attemptNumber}
                </span>
                <span className="text-gray-500">{formatWhen(a.submittedAt)}</span>
                <span className="font-semibold tabular-nums text-canvas-blue">
                  {a.scoreLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (preview.kind === "discussion") {
    return (
      <div className="space-y-4 p-5">
        {preview.replies.length === 0 ? (
          <p className="text-sm text-gray-500">
            No discussion posts found for this student.
          </p>
        ) : (
          preview.replies.map((reply) => (
            <article
              key={reply.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <p className="mb-2 text-xs text-gray-500">
                {formatWhen(reply.createdAt)}
                {reply.parentReplyId ? " · Reply" : " · Post"}
              </p>
              <RichContentViewer html={reply.body} courseId={preview.courseId} />
            </article>
          ))
        )}
      </div>
    );
  }

  if (preview.kind === "external-url") {
    const canEmbed =
      preview.externalType === "website" || preview.externalType === "link";
    return (
      <div className="flex min-h-[420px] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
          <p className="min-w-0 truncate text-xs text-gray-600">{preview.url}</p>
          <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-canvas-blue hover:underline"
          >
            Open in new tab
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {preview.description && (
          <p className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
            {preview.description}
          </p>
        )}
        {canEmbed ? (
          <iframe
            title={`Preview of ${entry.title}`}
            src={preview.url}
            className="min-h-[480px] w-full flex-1 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Github className="h-10 w-10 text-gray-400" />
            <p className="max-w-md text-sm text-gray-600">
              GitHub pages often block embedded previews. Open the repository in a
              new tab to view the project.
            </p>
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-canvas-primary text-sm"
            >
              Open on GitHub
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 text-sm text-gray-500">
      {preview.kind === "unavailable" || preview.kind === "assignment-empty"
        ? preview.message
        : "Preview unavailable."}
    </div>
  );
}

export function ArcFolioPreviewModal({
  entry,
  studentId,
  onClose,
}: {
  entry: PortfolioEntry;
  studentId: string;
  onClose: () => void;
}) {
  const preview = resolveArcFolioPreview(entry, studentId);
  const href = portfolioEntryHref(entry);

  return (
    <CanvasModal title={entry.title} onClose={onClose} size="preview">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FullPreviewBody preview={preview} entry={entry} />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-3">
        <p className="text-xs text-gray-500">
          Built-in ArcFolio preview
          {entry.note
            ? ` · ${entry.note.slice(0, 80)}${entry.note.length > 80 ? "…" : ""}`
            : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {entry.kind === "external" &&
            entry.externalType === "file" &&
            preview.kind === "external-file" &&
            preview.file.stored && (
              <button
                type="button"
                onClick={() => downloadPortfolioFile(preview.file.stored!)}
                className="btn-canvas-secondary text-xs"
              >
                Download file
              </button>
            )}
          {href && entry.kind === "external" && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-canvas-secondary text-xs"
            >
              Open link
            </a>
          )}
          {href && entry.kind !== "external" && (
            <Link to={href} className="btn-canvas-primary text-xs" onClick={onClose}>
              Open original
            </Link>
          )}
        </div>
      </div>
    </CanvasModal>
  );
}
