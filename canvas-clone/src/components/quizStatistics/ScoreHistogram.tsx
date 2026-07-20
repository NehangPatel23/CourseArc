export default function ScoreHistogram({
  buckets,
  total,
}: {
  buckets: { label: string; count: number }[];
  total: number;
}) {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm">
      <h2 className="text-lg font-semibold text-canvas-grayDark">Score distribution</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Percentage score buckets across {total} response{total === 1 ? "" : "s"}
      </p>
      <div className="mt-6 flex items-end gap-2" style={{ height: 160 }}>
        {buckets.map((bucket) => {
          const barAreaHeight = 120;
          const barHeight =
            bucket.count > 0
              ? Math.max(4, (bucket.count / maxCount) * barAreaHeight)
              : 0;
          return (
            <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-xs font-medium tabular-nums text-canvas-grayDark">
                {bucket.count}
              </span>
              <div
                className="flex w-full items-end justify-center"
                style={{ height: barAreaHeight }}
              >
                <div
                  className="w-full rounded-t bg-canvas-blue transition-all"
                  style={{ height: barHeight }}
                  title={`${bucket.label}: ${bucket.count}`}
                />
              </div>
              <span className="w-full truncate text-center text-[10px] text-gray-500">
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
