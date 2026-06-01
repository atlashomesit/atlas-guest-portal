import React from "react";

export type LoadingShape = "skeleton-card" | "skeleton-grid" | "skeleton-list" | "spinner";

export interface LoadingStateProps {
  kind: LoadingShape;
  count?: number;
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  kind,
  count = 6,
  message = "Loading…",
}) => {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{message}</span>
      {kind === "skeleton-card" && <SkeletonCards count={count} />}
      {kind === "skeleton-grid" && <SkeletonGrid count={count} />}
      {kind === "skeleton-list" && <SkeletonList count={count} />}
      {kind === "spinner" && <Spinner />}
    </div>
  );
};

const SkeletonCards: React.FC<{ count: number }> = ({ count }) => (
  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <article
        key={i}
        className="flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface"
        aria-hidden
      >
        <div className="h-48 w-full bg-bg-muted animate-pulse" />
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-6 w-3/4 rounded bg-bg-muted animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-bg-muted animate-pulse" />
            </div>
            <div className="h-6 w-20 rounded-full bg-bg-muted animate-pulse" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="h-8 w-24 rounded bg-bg-muted animate-pulse" />
              <div className="h-4 w-16 rounded bg-bg-muted animate-pulse" />
            </div>
            <div className="h-10 w-28 rounded-xl bg-bg-muted animate-pulse" />
          </div>
        </div>
      </article>
    ))}
  </div>
);

const SkeletonGrid: React.FC<{ count: number }> = ({ count }) => (
  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-lg overflow-hidden" aria-hidden>
        <div className="h-32 bg-bg-muted animate-pulse" />
        <div className="p-3 space-y-2">
          <div className="h-4 bg-bg-muted rounded animate-pulse" />
          <div className="h-3 bg-bg-muted rounded w-2/3 animate-pulse" />
        </div>
      </div>
    ))}
  </div>
);

const SkeletonList: React.FC<{ count: number }> = ({ count }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex gap-4 p-4 border border-border-subtle rounded-lg" aria-hidden>
        <div className="w-20 h-20 bg-bg-muted rounded animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-bg-muted rounded animate-pulse w-3/4" />
          <div className="h-3 bg-bg-muted rounded animate-pulse w-1/2" />
          <div className="h-3 bg-bg-muted rounded animate-pulse w-2/3" />
        </div>
      </div>
    ))}
  </div>
);

const Spinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-48" aria-hidden>
    <div className="w-12 h-12 border-4 border-border-subtle border-t-cta-primary rounded-full animate-spin" />
  </div>
);

export default LoadingState;
