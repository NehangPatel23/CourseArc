export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="w-full px-8 pb-2 pt-10 lg:px-14 lg:pt-14">
        <div className="mb-8 flex justify-between border-b border-arc-ink/10 pb-4">
          <div className="h-3 w-40 bg-arc-line" />
          <div className="h-3 w-28 bg-arc-line" />
        </div>
        <div className="h-5 w-24 bg-arc-line" />
        <div className="mt-3 h-12 w-56 bg-arc-line" />
        <div className="mt-6 h-4 w-80 max-w-full bg-arc-line" />
        <div className="mt-10 flex gap-8 border-y border-arc-ink/10 py-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 space-y-2">
              <div className="h-3 w-16 bg-arc-line" />
              <div className="h-8 w-12 bg-arc-line" />
            </div>
          ))}
        </div>
      </div>
      <div className="w-full px-8 py-12 lg:px-14">
        <div className="grid gap-12 xl:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <div className="h-8 w-40 bg-arc-line" />
            <div className="grid gap-6 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-72 bg-arc-line/80" />
              ))}
            </div>
          </div>
          <div className="space-y-6 border-l border-arc-ink/10 pl-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 border-b border-arc-ink/10" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
