import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  detectPreviewKind,
  previewKindLabel,
  type FilePreviewKind,
} from "../../utils/filePreviewKind";
import { fileExtension } from "../../utils/assignmentDisplay";
import { formatBytes } from "../../utils/files";

type Props = {
  blob?: Blob | null;
  blobUrl?: string | null;
  fileName: string;
  mime?: string;
  size?: number;
};

const TEXT_CAP = 180_000;

export default function CourseFilePreview({
  blob,
  blobUrl,
  fileName,
  mime,
  size,
}: Props) {
  const kind = detectPreviewKind(fileName, mime);
  const ext = (fileExtension(fileName) || "file").toUpperCase();
  const [text, setText] = useState<string | null>(null);
  const [hex, setHex] = useState<string>("");
  const [looksText, setLooksText] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setHex("");
    setLooksText(false);

    (async () => {
      const source = blob ?? (blobUrl ? await fetch(blobUrl).then((r) => r.blob()) : null);
      if (!source || cancelled) return;

      const head = await source.slice(0, 512).arrayBuffer();
      if (cancelled) return;
      setHex(formatHexDump(head));

      const shouldReadText =
        kind === "text" ||
        kind === "html" ||
        kind === "csv" ||
        kind === "unknown";
      if (!shouldReadText) return;

      const raw = await source.slice(0, TEXT_CAP + 1).text();
      if (cancelled) return;
      const printable = isMostlyPrintable(raw);
      setLooksText(printable);
      if (kind !== "unknown" || printable) {
        setText(raw.length > TEXT_CAP ? `${raw.slice(0, TEXT_CAP)}\n\n…` : raw);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob, blobUrl, kind]);

  const bytesLabel = typeof size === "number" ? formatBytes(size) : undefined;
  const title = fileName.replace(/\.[^.]+$/, "") || fileName;

  if (kind === "image" && blobUrl) {
    return (
      <PreviewFrame ext={ext} kind={kind} fileName={fileName} bytesLabel={bytesLabel}>
        <div className="flex min-h-[420px] items-center justify-center bg-[repeating-conic-gradient(#e8ddd0_0%_25%,#faf6ef_0%_50%)] bg-[length:24px_24px] p-8">
          <img
            src={blobUrl}
            alt={fileName}
            className="max-h-[70vh] max-w-full rounded-md border border-arc-line bg-arc-paper object-contain"
          />
        </div>
      </PreviewFrame>
    );
  }

  if (kind === "pdf" && blobUrl) {
    return (
      <PreviewFrame ext={ext} kind={kind} fileName={fileName} bytesLabel={bytesLabel}>
        <iframe title={fileName} src={blobUrl} className="h-[75vh] w-full bg-arc-paper" />
      </PreviewFrame>
    );
  }

  if (kind === "video" && blobUrl) {
    return (
      <PreviewFrame ext={ext} kind={kind} fileName={fileName} bytesLabel={bytesLabel}>
        <div className="bg-arc-moss px-6 py-8">
          <video controls src={blobUrl} className="mx-auto max-h-[70vh] w-full max-w-4xl rounded-md">
            <track kind="captions" />
          </video>
        </div>
      </PreviewFrame>
    );
  }

  if (kind === "audio" && blobUrl) {
    return (
      <PreviewFrame ext={ext} kind={kind} fileName={fileName} bytesLabel={bytesLabel}>
        <AudioStage fileName={fileName} src={blobUrl} />
      </PreviewFrame>
    );
  }

  if (kind === "html" && text != null) {
    return (
      <PreviewFrame ext={ext} kind={kind} fileName={fileName} bytesLabel={bytesLabel}>
        <iframe
          title={fileName}
          sandbox=""
          srcDoc={text}
          className="h-[75vh] w-full bg-arc-paper"
        />
      </PreviewFrame>
    );
  }

  if (kind === "csv" && text != null) {
    return (
      <PreviewFrame ext={ext} kind={kind} fileName={fileName} bytesLabel={bytesLabel}>
        <CsvPreview text={text} />
      </PreviewFrame>
    );
  }

  if ((kind === "text" || (kind === "unknown" && looksText)) && text != null) {
    return (
      <PreviewFrame ext={ext} kind={looksText && kind === "unknown" ? "text" : kind} fileName={fileName} bytesLabel={bytesLabel}>
        <TextDocument text={text} code={isCodeExtension(ext)} />
      </PreviewFrame>
    );
  }

  if (kind === "docx") {
    return (
      <PreviewFrame ext={ext} kind={kind} fileName={fileName} bytesLabel={bytesLabel}>
        <WordPreview title={title} fileName={fileName} />
      </PreviewFrame>
    );
  }

  if (kind === "pptx") {
    return (
      <PreviewFrame ext={ext} kind={kind} fileName={fileName} bytesLabel={bytesLabel}>
        <SlidePreview title={title} />
      </PreviewFrame>
    );
  }

  if (kind === "spreadsheet") {
    return (
      <PreviewFrame ext={ext} kind={kind} fileName={fileName} bytesLabel={bytesLabel}>
        <SheetPreview title={title} />
      </PreviewFrame>
    );
  }

  if (kind === "archive") {
    return (
      <PreviewFrame ext={ext} kind={kind} fileName={fileName} bytesLabel={bytesLabel}>
        <ArchivePreview title={title} ext={ext} />
      </PreviewFrame>
    );
  }

  return (
    <PreviewFrame ext={ext} kind="unknown" fileName={fileName} bytesLabel={bytesLabel}>
      <BinaryPreview fileName={fileName} ext={ext} mime={mime} hex={hex} />
    </PreviewFrame>
  );
}

function PreviewFrame({
  ext,
  kind,
  fileName,
  bytesLabel,
  children,
}: {
  ext: string;
  kind: FilePreviewKind;
  fileName: string;
  bytesLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-arc-line bg-arc-ivory">
      <div className="flex items-center gap-3 border-b border-arc-line px-5 py-3">
        <span className="rounded-md bg-arc-copper-tint px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-arc-copper">
          {ext.slice(0, 6)}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-arc-mute">
          {previewKindLabel(kind)} preview
        </span>
        <span className="ml-auto truncate text-xs text-arc-mute">
          {fileName}
          {bytesLabel ? ` · ${bytesLabel}` : ""}
        </span>
      </div>
      {children}
    </div>
  );
}

function TextDocument({ text, code }: { text: string; code: boolean }) {
  return (
    <div className="bg-arc-cream/40 px-4 py-8 sm:px-10 sm:py-12">
      <article className="mx-auto max-w-3xl border border-arc-line bg-arc-paper px-8 py-10 sm:px-12 sm:py-12">
        <div className="mb-8 h-px bg-arc-copper/40" />
        <pre
          className={
            code
              ? "overflow-x-auto whitespace-pre-wrap break-words font-mono text-[13px] leading-7 text-arc-ink"
              : "whitespace-pre-wrap break-words font-sans text-[15px] leading-8 text-arc-ink"
          }
        >
          {text || "(Empty file)"}
        </pre>
      </article>
    </div>
  );
}

function CsvPreview({ text }: { text: string }) {
  const rows = useMemo(() => parseCsv(text).slice(0, 40), [text]);
  const cols = Math.max(1, ...rows.map((r) => r.length));
  return (
    <div className="overflow-auto bg-arc-paper p-4">
      <table className="min-w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i === 0 ? "bg-arc-copper-tint/60" : "odd:bg-arc-ivory"}>
              {Array.from({ length: cols }, (_, c) => (
                <td
                  key={c}
                  className="border border-arc-line px-3 py-2 text-arc-ink"
                >
                  {row[c] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AudioStage({ fileName, src }: { fileName: string; src: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-8 bg-arc-paper px-8 py-12">
      <div className="flex items-end gap-1.5" aria-hidden>
        {[8, 16, 28, 20, 36, 14, 24, 18, 32, 12, 22, 10].map((h, i) => (
          <span
            key={i}
            className="w-1.5 rounded-full bg-arc-copper/70"
            style={{ height: h }}
          />
        ))}
      </div>
      <p className="max-w-md truncate text-sm font-medium text-arc-ink">{fileName}</p>
      <audio controls src={src} className="w-full max-w-lg">
        <track kind="captions" />
      </audio>
    </div>
  );
}

function WordPreview({ title, fileName }: { title: string; fileName: string }) {
  return (
    <div className="bg-arc-cream/50 px-6 py-12 sm:px-12">
      <div className="relative mx-auto max-w-xl">
        <div className="absolute inset-x-4 top-3 h-full rounded-sm border border-arc-line bg-arc-ivory" />
        <div className="absolute inset-x-2 top-1.5 h-full rounded-sm border border-arc-line bg-arc-paper" />
        <div className="relative border border-arc-line bg-arc-paper px-10 py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-arc-copper">
            Document
          </p>
          <h3 className="mt-4 font-display text-2xl font-medium text-arc-ink">{title}</h3>
          <p className="mt-1 text-xs text-arc-mute">{fileName}</p>
          <div className="mt-8 space-y-3">
            {[100, 92, 96, 70, 88, 94, 60].map((w, i) => (
              <div
                key={i}
                className="h-2 rounded-full bg-arc-line/80"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlidePreview({ title }: { title: string }) {
  return (
    <div className="bg-arc-moss px-6 py-12 sm:px-12">
      <div className="relative mx-auto max-w-2xl">
        <div className="absolute left-6 top-4 h-full w-full rounded-md bg-arc-ink/20" />
        <div className="absolute left-3 top-2 h-full w-full rounded-md bg-arc-ink/30" />
        <div className="relative aspect-video rounded-md border border-arc-gold/40 bg-arc-ivory px-10 py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arc-copper">
            Slide 1
          </p>
          <h3 className="mt-6 font-display text-3xl font-medium text-arc-ink">{title}</h3>
          <div className="mt-8 flex gap-2">
            <span className="h-1.5 w-10 rounded-full bg-arc-copper" />
            <span className="h-1.5 w-6 rounded-full bg-arc-line" />
            <span className="h-1.5 w-6 rounded-full bg-arc-line" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SheetPreview({ title }: { title: string }) {
  const cols = ["A", "B", "C", "D", "E", "F"];
  return (
    <div className="overflow-auto bg-arc-paper p-4">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-10 border border-arc-line bg-arc-cream px-2 py-1.5 text-arc-mute" />
            {cols.map((c) => (
              <th
                key={c}
                className="border border-arc-line bg-arc-cream px-4 py-1.5 font-semibold text-arc-mute"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }, (_, r) => (
            <tr key={r}>
              <td className="border border-arc-line bg-arc-cream px-2 py-2 text-center text-arc-mute">
                {r + 1}
              </td>
              {cols.map((c, i) => (
                <td
                  key={c}
                  className="border border-arc-line px-3 py-2 text-arc-ink"
                >
                  {r === 0 && i === 0 ? title : r === 0 ? "—" : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArchivePreview({ title, ext }: { title: string; ext: string }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center bg-arc-ivory px-6 py-12">
      <div className="relative w-full max-w-sm">
        <div className="absolute inset-x-6 top-0 h-8 rounded-t-md bg-arc-gold/80" />
        <div className="relative mt-5 rounded-md border border-arc-line bg-arc-paper px-6 py-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-arc-copper">
            {ext} archive
          </p>
          <h3 className="mt-3 text-lg font-semibold text-arc-ink">{title}</h3>
          <ul className="mt-6 space-y-2 text-sm text-arc-mute">
            <li className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-arc-copper-tint" />
              README
            </li>
            <li className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-arc-cream" />
              src /
            </li>
            <li className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-arc-cream" />
              assets /
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function BinaryPreview({
  fileName,
  ext,
  mime,
  hex,
}: {
  fileName: string;
  ext: string;
  mime?: string;
  hex: string;
}) {
  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,220px)_1fr]">
      <div className="flex flex-col items-center justify-center gap-4 border-b border-arc-line bg-arc-ivory px-6 py-10 lg:border-b-0 lg:border-r">
        <div className="flex h-28 w-24 flex-col overflow-hidden rounded-sm border border-arc-line bg-arc-paper">
          <div className="bg-arc-copper px-1 py-1 text-center font-mono text-[10px] font-bold text-white">
            {ext.slice(0, 5)}
          </div>
          <div className="flex flex-1 items-end justify-end p-2">
            <div className="h-8 w-8 origin-bottom-right rotate-12 border-l border-t border-arc-line bg-arc-cream" />
          </div>
        </div>
        <p className="text-center text-xs text-arc-mute">{mime || "binary"}</p>
      </div>
      <div className="bg-arc-moss px-5 py-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-arc-gold">
          First bytes · {fileName}
        </p>
        <pre className="overflow-x-auto font-mono text-[12px] leading-6 text-arc-cream">
          {hex || "No bytes loaded in this browser yet."}
        </pre>
      </div>
    </div>
  );
}

function isCodeExtension(ext: string): boolean {
  return [
    "JSON",
    "XML",
    "JS",
    "TS",
    "TSX",
    "JSX",
    "PY",
    "RB",
    "GO",
    "JAVA",
    "C",
    "H",
    "CPP",
    "CS",
    "RS",
    "SQL",
    "SH",
    "CSS",
    "YML",
    "YAML",
  ].includes(ext);
}

function isMostlyPrintable(s: string): boolean {
  if (!s) return false;
  const sample = s.slice(0, 4000);
  let bad = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13) continue;
    if (c < 32) bad += 1;
  }
  return bad / sample.length < 0.08;
}

function formatHexDump(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const slice = bytes.slice(i, i + 16);
    const hex = Array.from(slice)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ")
      .padEnd(47, " ");
    const ascii = Array.from(slice)
      .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "."))
      .join("");
    lines.push(`${i.toString(16).padStart(4, "0")}  ${hex}  ${ascii}`);
  }
  return lines.join("\n");
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim()));
}
