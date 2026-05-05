/**
 * Skeleton card for search/listing grid while loading.
 * Improves perceived performance per mobile responsiveness spec.
 */
const SkeletonCard = () => (
  <article
    className="flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface"
    aria-hidden
  >
    <div className="h-48 w-full animate-pulse bg-gradient-to-br from-bg-muted to-bg-surface" />
    <div className="flex flex-1 flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-6 w-3/4 animate-pulse rounded bg-bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-bg-muted" />
        </div>
        <div className="h-6 w-20 animate-pulse rounded-full bg-bg-muted" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="h-8 w-24 animate-pulse rounded bg-bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-bg-muted" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-xl bg-bg-muted" />
      </div>
    </div>
  </article>
);

export default SkeletonCard;
