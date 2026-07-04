import { useState } from "react";
import { X } from "lucide-react";
import { addCourse } from "../utils/coursesStore";
import { useToast } from "./ui/Toast";

const COLORS = ["#E74C3C", "#27AE60", "#3498DB", "#9B59B6", "#F39C12", "#1ABC9C"];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreateCourseModal({ open, onClose }: Props) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [shortName, setShortName] = useState("");
  const [term, setTerm] = useState("Fall 2025");
  const [color, setColor] = useState(COLORS[0]);

  if (!open) return null;

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
    showToast(`"${title.trim()}" created`, "positive");
    window.dispatchEvent(new Event("canvasClone:coursesChanged"));
    setTitle("");
    setCode("");
    setShortName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-canvas-grayDark">Create New Course</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2 text-sm focus:border-canvas-blue focus:outline-none focus:ring-2 focus:ring-canvas-blue/20"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2 text-sm focus:border-canvas-blue focus:outline-none focus:ring-2 focus:ring-canvas-blue/20"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Short name</span>
            <input
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2 text-sm focus:border-canvas-border focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Term</span>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2 text-sm focus:border-canvas-border focus:outline-none"
            />
          </label>
          <div>
            <span className="text-sm font-medium text-gray-700">Color</span>
            <div className="mt-2 flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ${color === c ? "ring-canvas-blue" : "ring-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-canvas-blue px-4 py-2 text-sm font-medium text-white hover:bg-canvas-blue/90"
            >
              Create course
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
