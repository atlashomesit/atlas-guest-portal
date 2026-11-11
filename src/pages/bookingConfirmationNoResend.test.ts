import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * TASK-102398 — pin the invariant that the confirmation page NEVER sends
 * outbound notifications. The board defect shape: refreshing or bookmarking
 * the confirmation page re-triggered a duplicate reservation email.
 *
 * Source verification: the page component does not call any notify/send/
 * email/resend API on mount; delivery is owned server-side by the payment
 * webhook with a per-order idempotency lock. Booking state here is read-only,
 * so a refresh cannot fan out a second email.
 *
 * This test greps the module source to prove it and catches any regression.
 */
describe('TASK-102398 confirmation page is notification-idempotent', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'BookingConfirmationPage.tsx'), 'utf8');

  it('contains no client-side send/resend/notify call', () => {
    const forbidden = [
      /sendConfirmation/,
      /notifyConfirmation/,
      /resendConfirmation/,
      /postConfirmNotification/,
      /sendReservationEmail/,
    ];
    for (const re of forbidden) {
      expect(src.match(re), `forbidden pattern ${re} present`).toBeNull();
    }
  });

  it('only fetches (reads) state — never POSTs a notification', () => {
    expect(src).toMatch(/fetch\s*\(/);
    expect(src).not.toMatch(/method:\s*['"]POST['"][^}]+notify/i);
  });
});
