import React, { useEffect, useState } from 'react';

export interface TopHostStatsDto {
  averageRating: number;
  reviewCount: number;
  completedStays: number;
  completedNights?: number;
  hostCancellations?: number;
  periodKey?: string;
  hostingSinceYear?: number | null;
}

export interface TopHostBadgeProps {
  stats?: TopHostStatsDto | null;
  compact?: boolean;
}

export const TopHostBadge: React.FC<TopHostBadgeProps> = ({ stats, compact = false }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        data-testid="marketplace-top-host-badge"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1 self-start rounded-full border border-amber-300 bg-amber-100 font-semibold text-amber-900 hover:bg-amber-200 transition-colors ${
          compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs min-h-[36px]'
        }`}
        aria-label="Top host details"
      >
        <span aria-hidden="true">★</span>
        <span>Top host</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="top-host-modal-title"
          data-testid="top-host-details-modal"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 mb-2">
                  <span aria-hidden="true">★</span> Top host
                </p>
                <h3 id="top-host-modal-title" className="text-lg font-bold text-gray-900">
                  Trusted hospitality on atlastays.com
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close Top host details"
                onClick={() => setOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-sm text-gray-600">
              Top hosts earn their badge automatically every quarter when a property meets high stay, rating, and reliability standards over the past 365 days:
            </p>

            <ul className="mt-3 space-y-1.5 text-sm text-gray-800">
              <li>• 4.6★ or higher overall guest rating (from 5+ reviews)</li>
              <li>• 10+ completed stays (or 3+ stays &amp; 100+ nights)</li>
              <li>• 99%+ booking reliability (no unexpected host cancellations)</li>
            </ul>

            {stats && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-gray-900">
                <div className="font-semibold">
                  {stats.averageRating.toFixed(1)}★ across {stats.reviewCount} review{stats.reviewCount === 1 ? '' : 's'}
                </div>
                <div className="text-xs text-gray-700 mt-1">
                  {stats.completedStays} completed stays in the past 365 days
                  {stats.hostingSinceYear ? ` · Hosting on Atlas since ${stats.hostingSinceYear}` : ''}
                </div>
              </div>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full min-h-[44px] rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-800"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
