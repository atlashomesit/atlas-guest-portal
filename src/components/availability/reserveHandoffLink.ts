/**
 * Pure helpers for the Reserve-step WhatsApp hand-off (see ReserveWhatsAppHandoff.tsx for the why).
 * Kept apart from the component file so that file exports only a component (react-refresh).
 *
 * Copy is deliberately NOT new: every sentence below already ships on GuestDetailsPage's offline branch
 * (TASK-8048) or UnitBookingWidget's "Bookings opening soon" banner. The hold clause of the details-page
 * sentence is dropped because no hold exists at the Reserve step. A source-assert test pins these to
 * their originals (ReserveWhatsAppHandoff.test.tsx).
 */
import { format } from 'date-fns';
import { calculateNights } from '@/utils/dateHelpers';
import { buildWaLink } from '@/utils/whatsapp';

export const RESERVE_HANDOFF_COPY = {
  /** GuestDetailsPage offline notice, bold line. */
  title: 'Online payment is not available for this property.',
  /** GuestDetailsPage offline notice, second line - minus "your hold is reserved for {countdown}". */
  withHostNumber: 'Contact the host on WhatsApp to confirm your dates.',
  /** UnitBookingWidget "Bookings opening soon" banner, second sentence. */
  withoutHostNumber: 'Please contact the host directly to make a reservation.',
  /** GuestDetailsPage WhatsApp CTA label. */
  cta: 'WhatsApp host to confirm',
  /** GuestDetailsPage microcopy under the WhatsApp CTA. */
  reassurance: "You'll be connected directly to the host — no payment taken on this site.",
} as const;

export interface ReserveWhatsAppUrlArgs {
  /** Digits-only host number (TenantInfo.whatsappBookingPhone). Empty/undefined => no link. */
  phone?: string | null;
  listingName?: string | null;
  /** Calendar-basis (local-midnight civil date) values, as held in the widget's state. */
  checkIn?: Date | null;
  checkOut?: Date | null;
  guests?: number;
}

/**
 * wa.me link carrying a pre-filled booking request (same wording as GuestDetailsPage's hand-off).
 * Returns '' when there is no host number - callers must then render NO link, never a recipient-less
 * wa.me URL.
 */
export function buildReserveWhatsAppUrl({
  phone,
  listingName,
  checkIn,
  checkOut,
  guests,
}: ReserveWhatsAppUrlArgs): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return '';

  const name = (listingName ?? '').trim() || 'your property';
  let text = `Hi, I'm interested in booking ${name}`;
  if (checkIn && checkOut) {
    const nights = calculateNights(checkIn, checkOut);
    const guestCount = guests && guests > 0 ? guests : 1;
    text +=
      ` for ${format(checkIn, 'EEE, d MMM yyyy')} → ${format(checkOut, 'EEE, d MMM yyyy')}` +
      ` (${nights} ${nights === 1 ? 'night' : 'nights'}, ${guestCount} guest${guestCount !== 1 ? 's' : ''})`;
  }
  text += '. Can you help me confirm?';

  // buildWaLink normalises a bare 10-digit national number to the international form wa.me needs.
  return buildWaLink({ phoneE164: digits, text });
}
