export default function CalendarCoursePip({
  color,
  onTypeFill = false,
  className = "h-1.5 w-1.5",
  title,
}: {
  color: string;
  onTypeFill?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`inline-block ${className} shrink-0 rounded-full ring-1 ${
        onTypeFill ? "ring-white" : "ring-black/20"
      }`}
      style={{ backgroundColor: color }}
      title={title}
      aria-hidden={!title}
    />
  );
}
