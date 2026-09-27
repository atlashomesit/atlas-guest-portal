import { describe, it, expect } from 'vitest';
import { buildTransferTripSheet, estimateTransferFare, transferWhatsAppUrl } from './taxiConcierge';

describe('TASK-102208 taxi concierge dispatch', () => {
  it('calculates transparent fares by vehicle + party size', () => {
    expect(estimateTransferFare('Sedan', 2)).toBe(1200);
    expect(estimateTransferFare('Sedan', 5)).toBe(1400);
    expect(estimateTransferFare('SUV', 2)).toBe(1800);
  });

  it('dispatches a pre-formatted WhatsApp trip sheet link', () => {
    const { fareInr, message } = buildTransferTripSheet({
      airport: 'GOI', propertyName: 'Sunset Villa', dateIso: '2026-10-05', flightNo: '6E 221', vehicle: 'SUV', guests: 4,
    });
    expect(fareInr).toBe(1900);
    const url = transferWhatsAppUrl('+919876543210', message);
    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(decodeURIComponent(url)).toContain('Airport Transfer Request');
  });
});
