import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { FEE_INFO_COPY } from '@/components/ui/FeeInfoTip';

/**
 * TASK-102113 — price breakdown fee lines carry (?) tooltips.
 * Source-level integration bar: both guest-facing breakdown surfaces must wire
 * the shared FeeInfoTip (hover on desktop, tap popover on mobile) into every
 * fee line instead of bare icons / title-only attributes.
 *
 * NOTE on Extra Guest Charge: the widget's extra-guest breakdown row was
 * deliberately removed by TASK-4725 (the server-authoritative Razorpay charge
 * never included that component, so the row never matched the billed total).
 * This task therefore does NOT resurrect that row — it tooltips every fee line
 * that actually renders. See the TASK-4725 comment in UnitBookingWidget.tsx.
 */
const widgetPath = resolve(__dirname, './UnitBookingWidget.tsx');
const detailsPath = resolve(
  __dirname,
  '../../pages/booking/GuestDetailsPage.tsx',
);

describe('TASK-102113 fee tooltips wired into guest price breakdowns (source)', () => {
  it('widget service-fee row uses FeeInfoTip (not a bare icon)', () => {
    const content = readFileSync(widgetPath, 'utf-8');
    expect(content).toContain('bw-bd-service-fee-row');
    expect(content).toContain('fee-info-payment-processing');
    expect(content).toContain("<FeeInfoTip fee=\"paymentProcessing\"");
    // The old bare <HelpCircle> icon (aria-label only, undiscoverable on touch) is gone.
    expect(content).not.toContain('<HelpCircle');
  });

  it('widget tourist-tax row uses FeeInfoTip', () => {
    const content = readFileSync(widgetPath, 'utf-8');
    expect(content).toContain('bw-bd-tourist-tax-row');
    expect(content).toContain("<FeeInfoTip fee=\"touristTax\"");
  });

  it('checkout (GuestDetailsPage) fee rows use FeeInfoTip', () => {
    const content = readFileSync(detailsPath, 'utf-8');
    expect(content).toContain("<FeeInfoTip fee=\"cleaning\"");
    expect(content).toContain("<FeeInfoTip fee=\"touristTax\"");
    expect(content).toContain("<FeeInfoTip fee=\"paymentProcessing\"");
    expect(content).toContain("<FeeInfoTip fee=\"addOns\"");
  });

  it('tooltip copy is generic — no invented host policy amounts or rules', () => {
    for (const copy of Object.values(FEE_INFO_COPY)) {
      expect(copy).not.toMatch(/₹|Rs\.?|\d+\s*%|\d+\s*per\s*night/i);
    }
  });
});
