import type { DirectPriceDisplay } from '@/utils/directBookingPrice';
import { directSavingsLabel } from '@/utils/directBookingPrice';

/**
 * Founder ruling 2026-10-21: "₹5,998 (struck)  ₹4,499 / night · 25% off — booked direct" — the line that
 * shows the guest the direct-booking saving instead of only ever showing them the higher standard rate.
 * Renders nothing when there is no saving.
 */
export default function DirectSavingRow({
  display,
  formatAmount,
}: {
  display: DirectPriceDisplay;
  formatAmount: (amount: number) => string;
}) {
  if (display.standardNightly == null || display.savingsPercent <= 0) return null;
  return (
    <div
      data-testid="bw-direct-saving"
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8, marginBottom: 4, fontSize: 14 }}
    >
      <span
        data-testid="bw-standard-nightly"
        style={{ textDecoration: 'line-through', color: 'var(--text-muted, #6b5a55)' }}
      >
        <span className="sr-only">Standard price </span>
        {formatAmount(display.standardNightly)}
      </span>
      <span data-testid="bw-real-nightly" style={{ fontWeight: 600, color: 'var(--text-primary, #3b1f1e)' }}>
        {formatAmount(display.realNightly)}
        <span style={{ fontWeight: 400, color: 'var(--text-muted, #6b5a55)' }}> / night</span>
      </span>
      <span data-testid="bw-saving-label" style={{ fontWeight: 600, color: '#b8472f' }}>
        {directSavingsLabel(display.savingsPercent)}
      </span>
    </div>
  );
}
