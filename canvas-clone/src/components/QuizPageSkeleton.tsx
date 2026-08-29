/** Loading placeholder for quiz stats / GradePro shells (#154). */
export default function QuizPageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 rounded-lg bg-gray-200" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
