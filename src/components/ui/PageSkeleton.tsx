/** Shared skeleton for server-rendered list pages (used by route loading.tsx files). */
export function PageSkeleton({ rows = 6, avatar = false }: { rows?: number; avatar?: boolean }) {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-3 h-9 w-60" />
      <div className="skeleton mt-3 h-4 w-80 max-w-full" />
      <div className="mt-6 flex gap-2">
        <div className="skeleton h-11 w-16 rounded-xl" />
        <div className="skeleton h-11 w-24 rounded-xl" />
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="tile flex items-center gap-3 p-4" style={{ opacity: 1 - i * 0.12 }}>
            {avatar && <div className="skeleton h-10 w-10 shrink-0 rounded-full" />}
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-3 w-1/3" />
            </div>
            <div className="skeleton h-6 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
