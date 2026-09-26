/**
 * TASK-102204 — Mid-stay cleaning request scheduler.
 *
 * Done-when:
 * 1. Time slot picker books mid-stay turnover on the housekeeping board.
 * 2. Confirmation payload carries the assigned cleaning window.
 */

export const CLEANING_SLOTS = ['10:00-12:00', '14:00-16:00'] as const;
export type CleaningSlot = (typeof CLEANING_SLOTS)[number];

export interface CleaningRequest {
  roomNumber: string;
  dateIso: string;
  slot: CleaningSlot;
  instructions: string;
}

export function isCleaningSlot(slot: string): slot is CleaningSlot {
  return (CLEANING_SLOTS as readonly string[]).includes(slot);
}

export function isCleaningDateEligible(dateIso: string, checkInIso: string, checkOutIso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
  return dateIso >= checkInIso && dateIso < checkOutIso;
}

export function buildCleaningConfirmation(req: CleaningRequest): string {
  const extra = req.instructions.trim() ? ` (${req.instructions.trim()})` : '';
  return `Room ${req.roomNumber} cleaning booked ${req.dateIso}, ${req.slot}${extra}.`;
}

// Board marker(s) added by dcbafc55; kept so anything reading them still resolves.
export const TASK_102204 = true;
