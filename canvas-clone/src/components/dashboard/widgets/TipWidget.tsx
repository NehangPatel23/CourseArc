export default function TipWidget({ studentView }: { studentView: boolean }) {
  return (
    <div
      className={`rounded-xl p-4 text-white ${
        studentView
          ? "bg-gradient-to-br from-canvas-grayDark to-canvas-grayMedium"
          : "bg-gradient-to-br from-canvas-blue to-canvas-blueLight"
      }`}
    >
      <p className="text-sm font-medium opacity-90">
        {studentView ? "Study tip" : "Tip of the day"}
      </p>
      <p className="mt-2 text-sm leading-relaxed opacity-95">
        {studentView
          ? "Check the Modules tab in each course to see what's due and track your progress."
          : "Use modules to organize content into a clear learning path for your students."}
      </p>
    </div>
  );
}
