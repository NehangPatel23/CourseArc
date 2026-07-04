import { useEffect, useRef, useState } from "react";
import { Copy, MoreVertical, Pencil, Trash2, Upload, UploadCloud } from "lucide-react";
import { duplicateCourse, duplicateCourseWithContent, archiveCourse, unarchiveCourse, updateCourse, type Course } from "../utils/coursesStore";
import { Archive, ArchiveRestore } from "lucide-react";
import { useToast } from "./ui/Toast";

type Props = {
  course: Course;
  onEdit: () => void;
  onDelete: () => void;
};

export default function CourseActionsMenu({ course, onEdit, onDelete }: Props) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const togglePublish = () => {
    updateCourse(course.id, { published: !course.published });
    showToast(
      course.published ? "Course unpublished" : "Course published",
      course.published ? "neutral" : "positive",
    );
    setOpen(false);
  };

  const handleDuplicate = () => {
    const id = duplicateCourse(course.id);
    if (id) showToast("Course duplicated (metadata only)", "positive");
    setOpen(false);
  };

  const handleDuplicateContent = () => {
    const id = duplicateCourseWithContent(course.id);
    if (id) showToast("Course duplicated with content", "positive");
    setOpen(false);
  };

  const handleArchive = () => {
    if (course.archived) unarchiveCourse(course.id);
    else archiveCourse(course.id);
    showToast(course.archived ? "Course restored" : "Course archived", "neutral");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative z-20">
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        className="rounded-lg p-1.5 text-gray-400 opacity-100 transition-opacity hover:bg-gray-100 hover:text-canvas-grayDark sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Course actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-canvas-border bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          onClick={stop}
        >
          <MenuButton icon={Pencil} label="Edit" onClick={() => { setOpen(false); onEdit(); }} />
          <MenuButton icon={Copy} label="Duplicate" onClick={handleDuplicate} />
          <MenuButton icon={Copy} label="Duplicate with content" onClick={handleDuplicateContent} />
          <MenuButton
            icon={course.published ? UploadCloud : Upload}
            label={course.published ? "Unpublish" : "Publish"}
            onClick={togglePublish}
          />
          <MenuButton
            icon={course.archived ? ArchiveRestore : Archive}
            label={course.archived ? "Restore" : "Archive"}
            onClick={handleArchive}
          />
          <MenuButton
            icon={Trash2}
            label="Delete"
            onClick={() => { setOpen(false); onDelete(); }}
            danger
          />
        </div>
      )}
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Pencil;
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
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas-grayLight ${
        danger ? "text-red-600" : "text-gray-700"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
