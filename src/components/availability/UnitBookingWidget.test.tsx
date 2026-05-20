import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AxiosError } from 'axios';
import {
  getOrderCreationGuestErrorMessage,
  PROVIDER_NOT_CONFIGURED_WHATSAPP_HINT,
} from './unitBookingPaymentOrderErrors';

describe('UnitBookingWidget - TASK-2460: order API errors surface body.message', () => {
  it('422 PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT includes API message and WhatsApp hint', () => {
    const apiMessage = 'Online payment is not configured for this property.';
    const err = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 422,
      statusText: 'Unprocessable Entity',
      data: {
        code: 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT',
        message: apiMessage,
      },
      headers: {},
      config: {} as never,
    });
    const text = getOrderCreationGuestErrorMessage(err, 'fallback');
    expect(text).toContain(apiMessage);
    expect(text).toContain(PROVIDER_NOT_CONFIGURED_WHATSAPP_HINT);
  });
});

describe('UnitBookingWidget - TASK-2612: Button text is "Reserve" (two-step flow)', () => {
  it('button text contains "Reserve" and not "Book Now" after TASK-2612 two-step flow', () => {
    const filePath = resolve(__dirname, './UnitBookingWidget.tsx');
    const content = readFileSync(filePath, 'utf-8');

    // TASK-2612: Reserve button — widget only does init-hold, form is on GuestDetailsPage
    expect(content).toContain("'Reserve'");
    expect(content).not.toContain("'Book Now'");

    // Verify the button has disabled conditions including date checks
    expect(content).toContain('!dateRange.startDate');
    expect(content).toContain('!dateRange.endDate');
  });
});
