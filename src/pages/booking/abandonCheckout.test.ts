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
