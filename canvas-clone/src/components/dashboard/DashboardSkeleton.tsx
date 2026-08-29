export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse bg-canvas-grayLight">
      <div className="w-full px-8 pb-2 pt-10 lg:px-12 lg:pt-12">
        <div className="mb-8 flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-8 w-40 rounded-lg bg-gray-200" />
            <div className="h-6 w-56 rounded-lg bg-gray-200" />
            <div className="h-4 w-72 rounded-lg bg-gray-200" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 w-44 rounded-2xl bg-gray-200" />
          ))}
        </div>
      </div>
      <div className="w-full px-8 py-10 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="h-8 w-48 rounded-lg bg-gray-200" />
            <div className="grid gap-5 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-56 rounded-2xl bg-gray-200" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
