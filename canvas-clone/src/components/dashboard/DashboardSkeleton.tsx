export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse bg-canvas-grayLight dark:bg-canvas-surface">
      <div className="h-52 bg-canvas-grayDark/80" />
      <div className="mx-auto max-w-7xl px-8 py-10 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="h-8 w-48 rounded-lg bg-gray-200 dark:bg-white/10" />
            <div className="grid gap-5 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-56 rounded-2xl bg-gray-200 dark:bg-canvas-surfaceRaised" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-gray-200 dark:bg-canvas-surfaceRaised" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
