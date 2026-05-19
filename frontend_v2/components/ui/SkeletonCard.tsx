/**
 * SkeletonCard.tsx — Phase 15
 * Reusable shimmer skeleton for dashboard cards.
 */

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-2/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 bg-gray-100 rounded w-full" />
      ))}
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 animate-pulse py-2">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-2 bg-gray-100 rounded w-1/2" />
      </div>
      <div className="h-6 w-12 bg-gray-100 rounded-full" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="flex items-end gap-1 h-32">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-100 rounded-t"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}
