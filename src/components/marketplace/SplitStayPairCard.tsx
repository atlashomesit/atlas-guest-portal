import { Link } from 'react-router-dom';
import type { SplitStayPairDto } from '@/utils/splitStayPairing';

function formatShortDateRange(checkIn: string, checkOut: string): string {
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${checkIn} – ${checkOut}`;
  }
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const endMonth = end.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
  if (sameMonth) {
    return `${startDay}–${endDay} ${endMonth}`;
  }
  const startMonth = start.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
  return `${startDay} ${startMonth}–${endDay} ${endMonth}`;
}

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function buildLegHref(
  leg: SplitStayPairDto['leg1'],
  guests: number,
): string {
  const params = new URLSearchParams({
    checkIn: leg.checkIn,
    checkOut: leg.checkOut,
    guests: String(Math.max(1, guests)),
  });
  const slug = leg.slug || String(leg.listingId);
  return `/t/${encodeURIComponent(leg.tenantSlug)}/listings/${encodeURIComponent(slug)}?${params.toString()}`;
}

export type SplitStayPairCardProps = {
  pair: SplitStayPairDto;
  guests?: number;
};

export default function SplitStayPairCard({ pair, guests = 2 }: SplitStayPairCardProps) {
  const leg1Range = formatShortDateRange(pair.leg1.checkIn, pair.leg1.checkOut);
  const leg2Range = formatShortDateRange(pair.leg2.checkIn, pair.leg2.checkOut);
  const leg1Href = buildLegHref(pair.leg1, guests);
  const leg2Href = buildLegHref(pair.leg2, guests);

  return (
    <article
      data-testid="marketplace-split-stay-card"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-bg-surface p-4 shadow-sm min-w-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-text-primary" data-testid="split-stay-date-summary">
          Stay 1: {leg1Range} → Stay 2: {leg2Range}
        </p>
        {typeof pair.distanceKm === 'number' && Number.isFinite(pair.distanceKm) && (
          <span
            data-testid="split-stay-distance"
            className="inline-flex items-center rounded-full bg-bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary"
          >
            {pair.distanceKm} km apart
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0">
        {[
          { label: 'Stay 1', leg: pair.leg1, range: leg1Range, href: leg1Href, testId: 'split-stay-leg-1' },
          { label: 'Stay 2', leg: pair.leg2, range: leg2Range, href: leg2Href, testId: 'split-stay-leg-2' },
        ].map(({ label, leg, range, href, testId }) => (
          <div
            key={testId}
            data-testid={testId}
            className="flex flex-col gap-2 rounded-xl border border-border/80 bg-white p-2.5 min-w-0"
          >
            <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-bg-muted">
              {leg.imageUrl ? (
                <img
                  src={leg.imageUrl}
                  alt={leg.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
                  {leg.city || label}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {label} · {range} ({leg.nights} nights)
              </p>
              <h3 className="truncate text-sm font-semibold text-text-primary">{leg.title}</h3>
              {leg.totalPrice != null && (
                <p className="text-xs text-text-secondary">{formatInr(leg.totalPrice)}</p>
              )}
            </div>
            <Link
              to={href}
              data-testid={`${testId}-link`}
              className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-lg border border-black bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-gray-50 transition-colors"
            >
              Book {label}
            </Link>
          </div>
        ))}
      </div>

      {pair.combinedTotal != null && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2.5">
          <span className="text-xs text-text-muted">Combined stay total (booked as 2 separate legs)</span>
          <span className="text-sm font-bold text-text-primary" data-testid="split-stay-combined-total">
            {formatInr(pair.combinedTotal)} total
          </span>
        </div>
      )}
    </article>
  );
}
