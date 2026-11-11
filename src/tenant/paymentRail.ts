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
import { paymentFeeCopy } from '@/utils/paymentFeeCopy';

/** Providers that never produce an online gateway charge for the guest. */
const OFFLINE_PROVIDERS = new Set(['MANUAL']);

/** TASK-10298791: Canonical guest-facing message when a tenant is in the Blocked lifecycle stage. */
export const NOT_TAKING_BOOKINGS_COPY = 'This property is not taking bookings right now.';

/** TASK-10298790: Canonical guest-facing copy when a tenant is on Trial (pay at property only). */
export const TRIAL_PAY_AT_PROPERTY_COPY =
  'Pay at property only — online guest payments are disabled while this property is on a free trial.';

/**
 * TASK-10298790: True when the tenant is in the 7-day Trial stage (or onlinePaymentsEnabled === false),
 * where online guest payments are hidden and bookings are pay-at-property only.
 */
export function isTenantTrialPayAtPropertyOnly(ctx: TenantInfo | null = getTenantContext()): boolean {
  if (!ctx) return false;
  if (ctx.onlinePaymentsEnabled === false) return true;
  const stage = (ctx.lifecycleStage ?? '').trim();
  return stage === 'Trial' || stage === 'TrialEndedNudge';
}

/**
 * TASK-10298791: True when the tenant is in the Blocked lifecycle stage (day 15+ after trial or renewal lapse)
 * and the public website must show "not taking bookings right now" with checkout disabled.
 */
export function isTenantNotTakingBookings(ctx: TenantInfo | null = getTenantContext()): boolean {
  if (!ctx) return false;
  if (ctx.notTakingBookings === true) return true;
  if ((ctx.websiteStatus ?? '').trim().toLowerCase() === 'not_taking_bookings') return true;
  if ((ctx.lifecycleStage ?? '').trim() === 'Blocked') return true;
  if (ctx.bookingMode === 'BLOCKED_LIFECYCLE') return true;
  return false;
}

/**
 * True when an online payment gateway will actually charge this guest — i.e. when it is honest to
 * quote a payment-processing fee, render the Razorpay pay rail, or credit Razorpay as the
 * processor. Defaults to the resolved tenant context; pass one explicitly to test or to reuse an
 * already-read context.
 */
export function hasOnlinePaymentRail(ctx: TenantInfo | null = getTenantContext()): boolean {
  if (!ctx) return false;
  // TASK-10298790 & TASK-10298791: Never offer online payment on Trial or when Blocked ("not taking bookings right now").
  if (isTenantNotTakingBookings(ctx) || isTenantTrialPayAtPropertyOnly(ctx)) return false;
  // Authoritative when present — mirrors the server's own payment-routing resolution.
  if (ctx.bookingMode) return ctx.bookingMode === 'ONLINE';
  const provider = (ctx.paymentProvider ?? '').trim().toUpperCase();
  return provider.length > 0 && !OFFLINE_PROVIDERS.has(provider);
}

/** Shared copy when an online rail exists (TASK-8055). */
export const DIRECT_BOOKING_PRICE_WITH_FEE =
  'The host keeps more when you book direct. Any payment-processing fee is shown before payment.';

/** Shared copy when there is no online rail — never invent a fee (TASK-8055). */
export const DIRECT_BOOKING_PRICE_NO_FEE =
  'Book direct with the host. The total shown at checkout is what you pay — no surprise OTA markups.';

/**
 * TASK-8055: one helper for the "what does the price include?" claim so homepage / theme /
 * marketplace surfaces cannot re-invent a 3% fee when `bookingMode` is WHATSAPP/MANUAL.
 */
export function directBookingPriceClaim(ctx: TenantInfo | null = getTenantContext(), percent: number | null = null): string {
  return hasOnlinePaymentRail(ctx)
    ? `The host keeps more when you book direct. ${paymentFeeCopy({ percent })}`
    : DIRECT_BOOKING_PRICE_NO_FEE;
}
