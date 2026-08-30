import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../icons/Icon";
import type { Course } from "../utils/coursesStore";
import { displayCourseTitle, getCourseNickname, setCourseNickname } from "../utils/courseNicknames";
import { useToast } from "./ui/Toast";

type Props = {
  course: Course;
  onClose: () => void;
  onSaved?: () => void;
};

export default function CourseNicknameModal({ course, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const existing = getCourseNickname(course.id) ?? "";
  const [value, setValue] = useState(displayCourseTitle(course.id, course.title));

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const save = (next: string) => {
    const trimmed = next.trim();
    const nickname = trimmed && trimmed !== course.title ? trimmed : "";
    setCourseNickname(course.id, nickname);
    showToast(nickname ? "Nickname saved" : "Nickname cleared", "positive");
    onSaved?.();
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-arc-moss/45 p-4"
      onClick={onClose}
    >
      <form
        className="paper-grain w-full max-w-sm bg-arc-paper p-7 shadow-lift ring-1 ring-arc-ink/10"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save(value);
        }}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <p className="kicker">Catalog</p>
            <h2 className="font-display mt-1 text-2xl font-medium text-arc-ink">Nickname</h2>
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
          Shown on your catalog instead of{" "}
          <span className="text-arc-ink">{course.title}</span>.
        </p>

        <label className="mt-5 block">
          <span className="kicker">Name</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={course.title}
            className="form-input mt-2"
            autoComplete="off"
          />
        </label>

        <div className="mt-6 flex items-center justify-between border-t border-arc-ink/10 pt-4">
          {existing ? (
            <button
              type="button"
              onClick={() => save("")}
              className="text-sm text-arc-mute hover:text-arc-ink"
            >
              Clear
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="text-sm text-arc-mute hover:text-arc-ink">
              Cancel
            </button>
            <button type="submit" className="btn-canvas-primary">
              Save
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
