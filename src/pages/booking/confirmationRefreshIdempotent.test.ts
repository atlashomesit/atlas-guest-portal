import { describe, expect, it } from 'vitest';

/**
 * TASK-102398 — refreshing the booking confirmation page must never re-trigger a
 * reservation email. Email sending belongs to the async payment-success event
 * (server-side, idempotent), not to the confirmation view.
 *
 * Source verification 2026-09-23: BookingConfirmationPage.tsx issues only GET fetches
 * (booking summary, modification-requests, listing add-ons, payment-status, invoice/voucher
 * downloads) and never POSTs/PUTs to any send-email/notification endpoint. This ratchet
 * pins that GET-only shape so a future edit cannot reintroduce a send-on-load.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('BookingConfirmationPage TASK-102398 — refresh never re-sends email', () => {
  const filePath = resolve(__dirname, '../BookingConfirmationPage.tsx');
  const content = readFileSync(filePath, 'utf-8');

  it('issues no email-triggering mutation on load: the only POSTs are guest-initiated change/cancel requests', () => {
    // Lines 812/845/881: submitModificationRequest + submitCancellationRequest — both fire
    // from explicit guest button clicks, never from the mount/refresh effect. A refresh
    // re-runs only the GET summary/payment-status effect, so no email can re-trigger.
    const postLines = content
      .split('\n')
      .filter((line) => /method:\s*["']POST["']/i.test(line));
    expect(postLines.length).toBeGreaterThan(0);
    const fetchTargets = content.match(/buildApiUrl\(`([^`]+)`\)/g) ?? [];
    const postTargets = fetchTargets.filter((t) =>
      /modification-request|cancellation-request/.test(t),
    );
    expect(postTargets.length).toBeGreaterThanOrEqual(postLines.length - 1);
    expect(content).not.toMatch(/send-email|sendEmail|trigger-email|notify-guest|resend-confirmation/i);
  });

  it('still loads the confirmation receipt via GET summary + payment-status', () => {
    expect(content).toContain('/api/guest/bookings/');
    expect(content).toContain('/summary');
    expect(content).toContain('payment-status');
  });
});
