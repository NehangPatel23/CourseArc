export default function CourseContentWrapper({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-transparent p-10 pb-24">
      <div className="rounded-lg border border-arc-ink/10 bg-arc-paper px-8 py-6">
        <h2 className="mb-4 text-2xl font-semibold text-canvas-grayDark">
          {title}
        </h2>
        <div className="leading-relaxed text-gray-600">{children}</div>
      </div>
    </div>
  );
}
