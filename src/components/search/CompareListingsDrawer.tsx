import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Scale } from 'lucide-react';

export const MAX_COMPARE_LISTINGS = 3;

export interface CompareListingItem {
  id: number;
  title: string;
  imageUrl: string;
  allInTotalLabel: string;
  nightlyRateLabel?: string;
  maxGuests: number;
  bedLayoutLabel: string;
  amenities: string[];
  mealPlansLabel: string;
  cancellationLabel: string;
  href: string;
}

interface CompareListingsDrawerProps {
  items: CompareListingItem[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRemove: (id: number) => void;
  onClear: () => void;
}

export const CompareListingsDrawer: React.FC<CompareListingsDrawerProps> = ({
  items,
  open,
  onOpen,
  onClose,
  onRemove,
  onClear,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (items.length === 0) return null;

  return (
    <>
      {/* Sticky bottom comparison tray */}
      <div
        data-testid="compare-listings-tray"
        className="fixed inset-x-0 bottom-3 z-40 mx-auto max-w-3xl px-3 sm:px-4 pointer-events-none"
      >
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-bg-surface/95 px-3 py-2.5 shadow-xl backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <Scale className="h-4 w-4 shrink-0 text-text-primary" aria-hidden />
            <div className="flex items-center -space-x-1.5">
              {items.map((item) => (
                <img
                  key={item.id}
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-8 w-8 rounded-lg border-2 border-bg-surface object-cover bg-bg-muted"
                />
              ))}
            </div>
            <span className="truncate text-xs sm:text-sm font-semibold text-text-primary">
              {items.length}/{MAX_COMPARE_LISTINGS} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="compare-listings-clear"
              onClick={onClear}
              className="min-h-[44px] rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg-muted hover:text-text-primary"
            >
              Clear
            </button>
            <button
              type="button"
              data-testid="compare-listings-open"
              disabled={items.length < 2}
              onClick={onOpen}
              className="min-h-[44px] rounded-xl bg-cta-primary px-4 py-1.5 text-xs sm:text-sm font-semibold text-[var(--text-on-cta,#fff)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Compare ({items.length})
            </button>
          </div>
        </div>
      </div>

      {/* Comparison modal/drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Compare rooms and homes"
          data-testid="compare-listings-drawer"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-text-primary">
                  Compare stays ({items.length})
                </h2>
                <p className="text-xs text-text-muted">
                  Side-by-side comparison of price, capacity, amenities, meals, and cancellation
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    onClose();
                  }}
                  className="min-h-[44px] rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg-muted"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  aria-label="Close comparison"
                  data-testid="compare-listings-close"
                  onClick={onClose}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-primary hover:bg-bg-muted"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-4 py-4 sm:px-6">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border align-top">
                      <th className="w-36 py-3 pr-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Feature
                      </th>
                      {items.map((item) => (
                        <th key={item.id} className="min-w-[180px] px-3 py-3 align-top">
                          <div className="relative overflow-hidden rounded-xl bg-bg-muted aspect-[16/10] mb-2">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              aria-label={`Remove ${item.title} from comparison`}
                              data-testid={`compare-remove-${item.id}`}
                              onClick={() => onRemove(item.id)}
                              className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                          <div className="font-semibold text-text-primary line-clamp-2">{item.title}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr data-testid="compare-row-price">
                      <th className="py-3 pr-3 text-xs font-semibold text-text-muted">All-in total</th>
                      {items.map((item) => (
                        <td key={item.id} className="px-3 py-3">
                          <div className="font-bold text-text-primary">{item.allInTotalLabel}</div>
                          {item.nightlyRateLabel && (
                            <div className="text-xs text-text-muted">{item.nightlyRateLabel}</div>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr data-testid="compare-row-guests">
                      <th className="py-3 pr-3 text-xs font-semibold text-text-muted">Max guests</th>
                      {items.map((item) => (
                        <td key={item.id} className="px-3 py-3 text-text-body">
                          Up to {item.maxGuests} {item.maxGuests === 1 ? 'guest' : 'guests'}
                        </td>
                      ))}
                    </tr>
                    <tr data-testid="compare-row-beds">
                      <th className="py-3 pr-3 text-xs font-semibold text-text-muted">Bed layout</th>
                      {items.map((item) => (
                        <td key={item.id} className="px-3 py-3 text-text-body">
                          {item.bedLayoutLabel}
                        </td>
                      ))}
                    </tr>
                    <tr data-testid="compare-row-amenities">
                      <th className="py-3 pr-3 text-xs font-semibold text-text-muted">Amenities</th>
                      {items.map((item) => (
                        <td key={item.id} className="px-3 py-3 text-text-body">
                          {item.amenities.length > 0 ? item.amenities.join(', ') : 'Standard essentials'}
                        </td>
                      ))}
                    </tr>
                    <tr data-testid="compare-row-meals">
                      <th className="py-3 pr-3 text-xs font-semibold text-text-muted">Meals</th>
                      {items.map((item) => (
                        <td key={item.id} className="px-3 py-3 text-text-body">
                          {item.mealPlansLabel}
                        </td>
                      ))}
                    </tr>
                    <tr data-testid="compare-row-cancellation">
                      <th className="py-3 pr-3 text-xs font-semibold text-text-muted">Cancellation</th>
                      {items.map((item) => (
                        <td key={item.id} className="px-3 py-3 text-text-body">
                          {item.cancellationLabel}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th className="py-3 pr-3 text-xs font-semibold text-text-muted">Book</th>
                      {items.map((item) => (
                        <td key={item.id} className="px-3 py-3">
                          <Link
                            to={item.href}
                            onClick={onClose}
                            data-testid={`compare-book-${item.id}`}
                            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-cta-primary px-4 py-2 text-xs font-semibold text-[var(--text-on-cta,#fff)] hover:opacity-90"
                          >
                            View &amp; book
                          </Link>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CompareListingsDrawer;
