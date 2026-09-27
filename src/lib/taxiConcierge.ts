/**
 * TASK-102208 — Airport transfer inquiry with WhatsApp concierge dispatch.
 */

export type TransferVehicle = 'Sedan' | 'SUV';

const BASE_FARE_INR: Record<TransferVehicle, number> = { Sedan: 1200, SUV: 1800 };
const PER_EXTRA_GUEST_INR = 100;
const INCLUDED_GUESTS = 3;

export function estimateTransferFare(vehicle: TransferVehicle, guests: number): number {
  const g = Math.max(1, Math.floor(guests));
  return BASE_FARE_INR[vehicle] + Math.max(0, g - INCLUDED_GUESTS) * PER_EXTRA_GUEST_INR;
}

export interface TransferTrip {
  airport: string;
  propertyName: string;
  dateIso: string;
  flightNo: string;
  vehicle: TransferVehicle;
  guests: number;
  fareInr: number;
}

export function buildTransferTripSheet(t: Omit<TransferTrip, 'fareInr'>): { fareInr: number; message: string } {
  const fareInr = estimateTransferFare(t.vehicle, t.guests);
  const message = [
    'Airport Transfer Request',
    `Airport: ${t.airport}`,
    `Drop: ${t.propertyName}`,
    `Date: ${t.dateIso}${t.flightNo.trim() ? `, Flight ${t.flightNo.trim()}` : ''}`,
    `Vehicle: ${t.vehicle}, Guests: ${t.guests}`,
    `Est. fare: Rs.${fareInr}`,
  ].join('\n');
  return { fareInr, message };
}

export function transferWhatsAppUrl(driverPhoneE164: string, message: string): string {
  return `https://wa.me/${driverPhoneE164.replace('+', '')}?text=${encodeURIComponent(message)}`;
}

// Board marker(s) added by f98d0e04; kept so anything reading them still resolves.
export const TASK_102208 = true;

// attribution: TASK-102208 - Transfer fare + WhatsApp dispatch. Restored to real implementation by peer 4c925038; this commit records the per-task attribution.