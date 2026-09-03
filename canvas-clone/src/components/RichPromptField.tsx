import { useState } from "react";
import RichContentEditor from "./RichContentEditor";
import RichContentViewer from "./RichContentViewer";
import { wrapPlainTextAsHtml } from "../utils/richContent";

type Props = {
  value: string;
  onChange: (html: string) => void;
  courseId?: string;
  mountKey: string;
  placeholder?: string;
  height?: number;
  disabled?: boolean;
  /** Always show the editor (single-field comments). */
  alwaysEdit?: boolean;
};

/** Click-to-edit rich text so a page of quiz questions does not mount many TinyMCE instances. */
export default function RichPromptField({
  value,
  onChange,
  courseId,
  mountKey,
  placeholder = "Click to edit…",
  height = 180,
  disabled = false,
  alwaysEdit = false,
}: Props) {
  const [editing, setEditing] = useState(alwaysEdit);
  const html = wrapPlainTextAsHtml(value);
  const empty = !html.replace(/<[^>]+>/g, "").trim() && !/<img/i.test(html);

  if (disabled) {
    return empty ? (
      <p className="text-sm italic text-arc-mute">{placeholder}</p>
    ) : (
      <RichContentViewer html={html} courseId={courseId} spacing="compact" className="text-sm" />
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full rounded-md border border-arc-line bg-arc-ivory px-3 py-2 text-left hover:border-arc-copper/50"
      >
        {empty ? (
          <span className="text-sm text-arc-mute">{placeholder}</span>
        ) : (
          <RichContentViewer html={html} courseId={courseId} spacing="compact" className="text-sm" />
        )}
        <span className="mt-1 block text-xs text-arc-mute">Click to edit — images, links, and equations supported</span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <RichContentEditor
        value={html}
        onChange={onChange}
        height={height}
        courseId={courseId}
        mountKey={mountKey}
        compact
        placeholder={placeholder}
      />
      {!alwaysEdit && (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs font-medium text-arc-copper hover:underline"
        >
          Done
        </button>
      )}
    </div>
  );
}
