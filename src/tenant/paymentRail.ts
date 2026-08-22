/**
 * TASK-7428 (founder-ruled 2026-08-05): single source of truth for "will this guest actually be
 * charged through an online payment gateway on this site?".
 *
 * Why this exists: before this module three surfaces each answered the question differently —
 * `UnitBookingWidget` (`paymentProvider` non-empty && `bookingMode !== 'WHATSAPP'`),
 * `PropertyDetails` (`typeof paymentProvider === 'string' && !== 'MANUAL'`), and the footer MOR
 * disclosure (never asked at all). The result on tenants 45 (`staybycf`) and 55
 * (`millionairesmansion`) — both `paymentProvider: null` / `bookingMode: "WHATSAPP"`, every CTA a
 * `wa.me` handoff — was a quoted "Payment processing (3%)" line and Razorpay trust copy on a site
 * where no payment is ever taken, so the total shown was 3% above what the host asks for on
 * WhatsApp. Founder ruling: no processor, no fee.
 *
 * `bookingMode` is the authoritative signal. `GET /tenants/from-domain` derives it from the SAME
 * `IPaymentRoutingService` resolution the checkout endpoints use (TenantsController.GetFromDomain),
 * so it already accounts for an ACTIVE-but-uncredentialed provider row that would 422 at checkout:
 *   - "ONLINE"   — routing resolves to a gateway/UPI provider; the guest IS charged online.
 *   - "MANUAL"   — pay-on-arrival; booking captured, no gateway, so no gateway fee.
 *   - "WHATSAPP" — routing Blocked, host has a phone; handoff, no payment on this site.
 *   - undefined  — routing Blocked and no phone ("Bookings opening soon"), OR the tenant was
 *                  resolved through the legacy `validateTenant(slug)` fallback in `main.tsx`,
 *                  which does not populate any payment field. Fall back to `paymentProvider`.
 */

import { getTenantContext, type TenantInfo } from '@/tenant/tenantContext';

/** Providers that never produce an online gateway charge for the guest. */
const OFFLINE_PROVIDERS = new Set(['MANUAL']);

/**
 * True when an online payment gateway will actually charge this guest — i.e. when it is honest to
 * quote a payment-processing fee, render the Razorpay pay rail, or credit Razorpay as the
 * processor. Defaults to the resolved tenant context; pass one explicitly to test or to reuse an
 * already-read context.
 */
export function hasOnlinePaymentRail(ctx: TenantInfo | null = getTenantContext()): boolean {
  if (!ctx) return false;
  // Authoritative when present — mirrors the server's own payment-routing resolution.
  if (ctx.bookingMode) return ctx.bookingMode === 'ONLINE';
  const provider = (ctx.paymentProvider ?? '').trim().toUpperCase();
  return provider.length > 0 && !OFFLINE_PROVIDERS.has(provider);
}

/** Shared copy when an online rail exists (TASK-8055). */
export const DIRECT_BOOKING_PRICE_WITH_FEE =
  'The host keeps more when you book direct. Price shown includes room rate, GST, and a 3% payment-processing fee.';

/** Shared copy when there is no online rail — never invent a fee (TASK-8055). */
export const DIRECT_BOOKING_PRICE_NO_FEE =
  'Book direct with the host. The total shown at checkout is what you pay — no surprise OTA markups.';

/**
 * TASK-8055: one helper for the "what does the price include?" claim so homepage / theme /
 * marketplace surfaces cannot re-invent a 3% fee when `bookingMode` is WHATSAPP/MANUAL.
 */
export function directBookingPriceClaim(ctx: TenantInfo | null = getTenantContext()): string {
  return hasOnlinePaymentRail(ctx) ? DIRECT_BOOKING_PRICE_WITH_FEE : DIRECT_BOOKING_PRICE_NO_FEE;
}
