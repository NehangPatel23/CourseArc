export default function CourseContentWrapper({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-canvas-grayLight p-10 pb-24">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-8 py-6">
        <h2 className="text-2xl font-semibold text-canvas-grayDark mb-4">
          {title}
        </h2>
        <div className="text-gray-600 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
