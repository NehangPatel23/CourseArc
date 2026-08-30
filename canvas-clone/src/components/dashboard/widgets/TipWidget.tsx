export default function TipWidget({ studentView }: { studentView: boolean }) {
  return (
    <blockquote className="border-l border-arc-gold/60 py-1 pl-4">
      <p className="kicker text-arc-gold">
        {studentView ? "Study note" : "Note of the day"}
      </p>
      <p className="font-display mt-2 text-[15px] italic leading-relaxed text-arc-ink">
        {studentView
          ? "Check the Modules tab in each course to see what’s due and track your progress."
          : "Use modules to organize content into a clear learning path for your students."}
      </p>
    </blockquote>
  );
}
