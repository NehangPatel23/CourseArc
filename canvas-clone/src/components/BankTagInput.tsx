import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { normalizeTags } from "../utils/bankMeta";

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
};

export default function BankTagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = "Add a topic and press Enter",
}: Props) {
  const [draft, setDraft] = useState("");

  const unusedSuggestions = useMemo(() => {
    const have = new Set(tags.map((t) => t.toLowerCase()));
    const q = draft.trim().toLowerCase();
    return suggestions
      .filter((s) => !have.has(s.toLowerCase()))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestions, tags, draft]);

  const add = (raw: string) => {
    const next = normalizeTags([...tags, raw]);
    if (next.length !== tags.length) onChange(next);
    setDraft("");
  };

  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-200">
        {tags.map((tag) => (
          <span
            key={tag.toLowerCase()}
            className="inline-flex items-center gap-1 rounded-full bg-canvas-blueTint px-2 py-0.5 text-xs font-medium text-canvas-blueDark"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="rounded-full p-0.5 hover:bg-white/80"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (draft.trim()) add(draft);
            } else if (e.key === "Backspace" && !draft && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) add(draft);
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 border-0 bg-transparent py-0.5 text-sm outline-none placeholder:text-gray-400"
        />
      </div>
      {unusedSuggestions.length > 0 && draft.trim() && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {unusedSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
              className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600 hover:border-canvas-blue/40 hover:bg-canvas-blueTint"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
