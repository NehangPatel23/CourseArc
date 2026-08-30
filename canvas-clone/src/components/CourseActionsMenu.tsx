import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon, { type IconName } from "../icons/Icon";
import {
  duplicateCourse,
  duplicateCourseWithContent,
  archiveCourse,
  unarchiveCourse,
  toggleCoursePublished,
  type Course,
} from "../utils/coursesStore";
import { useToast } from "./ui/Toast";
import CourseNicknameModal from "./CourseNicknameModal";

type Props = {
  course: Course;
  onEdit: () => void;
  onDelete: () => void;
  onChanged?: () => void;
  onNickname?: () => void;
};

export default function CourseActionsMenu({
  course,
  onEdit,
  onDelete,
  onChanged,
  onNickname,
}: Props) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const place = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = 220;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 8);
    setCoords({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onReposition = () => place();
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const done = () => {
    setOpen(false);
    onChanged?.();
  };

  const togglePublish = () => {
    const next = toggleCoursePublished(course.id);
    if (next == null) return;
    showToast(next ? "Course published" : "Course unpublished", next ? "positive" : "neutral");
    done();
  };

  const handleDuplicate = () => {
    const id = duplicateCourse(course.id);
    showToast(id ? "Course duplicated" : "Could not duplicate", id ? "positive" : "negative");
    done();
  };

  const handleDuplicateContent = () => {
    const id = duplicateCourseWithContent(course.id);
    showToast(id ? "Course duplicated with content" : "Could not duplicate", id ? "positive" : "negative");
    done();
  };

  const handleArchive = () => {
    if (course.archived) unarchiveCourse(course.id);
    else archiveCourse(course.id);
    showToast(course.archived ? "Course restored" : "Course archived", "neutral");
    done();
  };

  const handleNickname = () => {
    setOpen(false);
    if (onNickname) {
      onNickname();
      return;
    }
    setNicknameOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        className="rounded-md p-1.5 text-white/90 opacity-100 transition hover:bg-black/20 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Course actions"
        aria-expanded={open}
      >
        <Icon name="more" size={14} />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            className="min-w-[220px] bg-arc-ivory py-1.5 shadow-lift ring-1 ring-arc-ink/10"
            style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 10000 }}
            onClick={stop}
          >
            <MenuButton icon="pencil" label="Edit" onClick={() => { setOpen(false); onEdit(); }} />
            <MenuButton icon="tag" label="Set nickname" onClick={handleNickname} />
            <MenuButton icon="copy" label="Duplicate" onClick={handleDuplicate} />
            <MenuButton icon="copy" label="Duplicate with content" onClick={handleDuplicateContent} />
            <MenuButton
              icon={course.published ? "download" : "upload"}
              label={course.published ? "Unpublish" : "Publish"}
              onClick={togglePublish}
            />
            <MenuButton
              icon={course.archived ? "restore" : "archive"}
              label={course.archived ? "Restore" : "Archive"}
              onClick={handleArchive}
            />
            <MenuButton
              icon="trash"
              label="Delete"
              onClick={() => { setOpen(false); onDelete(); }}
              danger
            />
          </div>,
          document.body,
        )}
      {nicknameOpen && (
        <CourseNicknameModal
          course={course}
          onClose={() => setNicknameOpen(false)}
          onSaved={onChanged}
        />
      )}
    </>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-arc-cream ${
        danger ? "text-arc-brick" : "text-arc-ink"
      }`}
    >
      <Icon name={icon} size={13} className="opacity-70" />
      {label}
    </button>
  );
}
