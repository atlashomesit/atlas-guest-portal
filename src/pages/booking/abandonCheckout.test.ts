import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * TASK-5183 — source ratchet: GuestDetailsPage must call abandon-checkout on
 * dismiss / payment.failed / back-to-property. The helper is module-private so
 * we assert the wiring via the source file (same pattern as UnitBookingWidget GST ratchets).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('GuestDetailsPage TASK-5183 abandon-checkout wiring', () => {
  const filePath = resolve(__dirname, './GuestDetailsPage.tsx');
  const content = readFileSync(filePath, 'utf-8');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defines abandonPaymentPendingCheckout with keepalive POST', () => {
    expect(content).toContain('function abandonPaymentPendingCheckout');
    expect(content).toContain('abandon-checkout');
    expect(content).toContain('keepalive: true');
  });

  it('calls abandon on Razorpay dismiss and back-to-property (not on payment.failed — resume needs the hold)', () => {
    const calls = content.match(/abandonPaymentPendingCheckout\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(content).toContain('handleBackToProperty');
    expect(content).toMatch(/const handleClose = \(\) => \{[\s\S]{0,300}abandonPaymentPendingCheckout/);
    expect(content).toMatch(/handleBackToProperty = useCallback\(\(\) => \{[\s\S]{0,300}abandonPaymentPendingCheckout/);
    // payment.failed must keep the draft for TASK-2906 resume
    expect(content).not.toMatch(/payment\.failed[\s\S]{0,500}abandonPaymentPendingCheckout/);
  });
});

describe('GuestDetailsPage TASK-5179 cancellation deadline wiring', () => {
  const filePath = resolve(__dirname, './GuestDetailsPage.tsx');
  const content = readFileSync(filePath, 'utf-8');

  it('resolves the deadline from the shared policy helper instead of a hardcoded 48h offset', () => {
    // TASK-7012: the page delegates to `resolveFreeCancellationTrustCopy`, which internally calls
    // `computeEffectiveCancellationDeadline`/`formatCancellationDeadline` AND applies the server's
    // grace-void rule. Asserting the low-level names here would force the page back off the helper.
    expect(content).toContain('resolveFreeCancellationTrustCopy');
    expect(content).not.toMatch(/48 \* 60 \* 60 \* 1000/);
    expect(content).not.toContain('48 hours before check-in');
  });

  it('never renders an unqualified free-cancellation claim once a check-in date is known (TASK-7012)', () => {
    // The bare "Free cancellation policy applies." fallback is legitimate ONLY with no booking
    // context. With dates in scope the helper always yields either a live deadline, the
    // standard-policy sentence, or an applicable grace window — all three must be rendered.
    expect(content).toContain('applicableGraceHours');
    expect(content).toMatch(/freeCancellationCopy\?\.trustMessage/);
    expect(content).toMatch(/freeCancellationCopy\?\.deadlineFormatted/);
  });
});
