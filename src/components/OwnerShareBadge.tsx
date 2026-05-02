/**
 * TASK-1705: Owner-share trust badge.
 *
 * Shows "0% commission — book direct" trust signal on listing cards and detail pages.
 * Highlights that unlike OTA platforms (which keep 15–20%), direct bookings via Atlas
 * go entirely to the host.
 *
 * Optional `nightlyPrice` prop: when provided, shows the amount in ₹ that the host
 * receives (e.g. "₹3,800 to host" for a ₹4,000/night listing, assuming ~5% payment
 * processing).
 */

interface OwnerShareBadgeProps {
  /** If provided, shows the estimated ₹ amount going to the host. */
  nightlyPrice?: number | null;
  /** Additional CSS class names. */
  className?: string;
}

const PLATFORM_SHARE = 0.95; // conservative host share (accounts for ~5% payment processing)

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export default function OwnerShareBadge({ nightlyPrice, className = "" }: OwnerShareBadgeProps) {
  const hostAmount =
    nightlyPrice != null && nightlyPrice > 0
      ? Math.round(nightlyPrice * PLATFORM_SHARE)
      : null;

  const label = hostAmount != null
    ? `${formatINR(hostAmount)} to host (0% OTA commission)`
    : "0% commission — book direct";

  const tooltip =
    "Booking direct via Atlas means your host keeps significantly more. " +
    "OTA platforms (marketplaces) typically charge 15–20% commission. " +
    "Direct bookings have 0% platform commission — only a small payment-processing fee.";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 cursor-default ${className}`}
      title={tooltip}
      aria-label={`${label}. ${tooltip}`}
    >
      🏦 {label}
    </span>
  );
}
