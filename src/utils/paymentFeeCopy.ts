/** Display metadata only. Never derive or change the payment amount here. */
export type PaymentFeeDisplay = { percent: number | null; amount?: number | null };

export function feePercent(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

export function feeAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function paymentFeeCopy(fee: PaymentFeeDisplay): string {
  const amount = feeAmount(fee.amount);
  const percent = feePercent(fee.percent);
  // A quote's actual zero includes host-absorbed fees even when its configured percent is positive.
  if (amount === 0 || (amount === null && percent === 0)) return 'No payment-processing fee.';
  if (percent !== null && percent > 0) return `${percent}% payment-processing fee shown before payment.`;
  if (amount !== null && amount > 0) {
    const value = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
    return `${value} payment-processing fee for this booking.`;
  }
  return 'Any payment-processing fee is shown before payment.';
}
