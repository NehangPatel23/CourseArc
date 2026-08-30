import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../icons/Icon";
import { addCourse } from "../utils/coursesStore";
import { useToast } from "./ui/Toast";

const WASHES = [
  { hex: "#C45D26", label: "Copper" },
  { hex: "#1F2A24", label: "Moss" },
  { hex: "#3D6B4F", label: "Sage" },
  { hex: "#A33B2B", label: "Brick" },
  { hex: "#C4A35A", label: "Gold" },
  { hex: "#4A6670", label: "Slate" },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreateCourseModal({ open, onClose }: Props) {
  const { showToast } = useToast();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [shortName, setShortName] = useState("");
  const [term, setTerm] = useState("Fall 2025");
  const [color, setColor] = useState(WASHES[0].hex);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => titleRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const reset = () => {
    setTitle("");
    setCode("");
    setShortName("");
    setTerm("Fall 2025");
    setColor(WASHES[0].hex);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !code.trim()) return;
    addCourse({
      title: title.trim(),
      code: code.trim(),
      short_name: shortName.trim() || code.trim(),
      term: term.trim(),
      color,
      published: false,
    });
    showToast(`“${title.trim()}” composed`, "positive");
    window.dispatchEvent(new Event("canvasClone:coursesChanged"));
    reset();
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-arc-moss/45 p-4"
      onClick={onClose}
    >
      <form
        className="paper-grain w-full max-w-md bg-arc-paper p-7 shadow-lift ring-1 ring-arc-ink/10"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <p className="kicker">Compose</p>
            <h2 className="font-display mt-1 text-2xl font-medium text-arc-ink">A new course</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-arc-mute hover:bg-arc-cream hover:text-arc-ink"
            aria-label="Close"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-arc-mute">
          Opens as an unpublished plate. Publish it when the studio is ready.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="kicker">Title</span>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input mt-2"
              required
            />
          </label>
          <label className="block">
            <span className="kicker">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="form-input mt-2"
              placeholder="CSCI 570"
              required
            />
          </label>
          <label className="block">
            <span className="kicker">Short name</span>
            <input
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              className="form-input mt-2"
              placeholder="Same as code if blank"
            />
          </label>
          <label className="block">
            <span className="kicker">Term</span>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="form-input mt-2"
            />
          </label>
          <div>
            <span className="kicker">Wash</span>
            <div className="mt-2 flex gap-2">
              {WASHES.map((w) => (
                <button
                  key={w.hex}
                  type="button"
                  onClick={() => setColor(w.hex)}
                  className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-arc-paper ${
                    color === w.hex ? "ring-arc-copper" : "ring-transparent"
                  }`}
                  style={{ backgroundColor: w.hex }}
                  aria-label={w.label}
                  title={w.label}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-arc-ink/10 pt-4">
          <button type="button" onClick={onClose} className="text-sm text-arc-mute hover:text-arc-ink">
            Cancel
          </button>
          <button type="submit" className="btn-canvas-primary">
            Compose
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
