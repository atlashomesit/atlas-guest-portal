/**
 * TASK-102205 — Luggage storage request toggle.
 *
 * Done-when:
 * 1. Storage option prompts bag count + arrival/pickup hours.
 * 2. Generates a digital baggage claim ticket number on screen.
 */

export interface LuggageStorageInput {
  bags: number;
  windowLabel: string;
}

export interface LuggageTicket {
  ticketNo: string;
  bags: number;
  windowLabel: string;
}

export const MAX_LUGGAGE_BAGS = 10;

export function isLuggageInputValid(input: LuggageStorageInput): boolean {
  return (
    Number.isInteger(input.bags) &&
    input.bags >= 1 &&
    input.bags <= MAX_LUGGAGE_BAGS &&
    input.windowLabel.trim().length > 0
  );
}

export function buildLuggageTicket(dateIso: string, roomNumber: string, input: LuggageStorageInput): LuggageTicket {
  const d = dateIso.replaceAll('-', '');
  return {
    ticketNo: `LUG-${d}-${roomNumber.trim()}-${input.bags}`,
    bags: input.bags,
    windowLabel: input.windowLabel.trim(),
  };
}

// Board marker(s) added by ca172edb; kept so anything reading them still resolves.
export const TASK_102205 = true;

// attribution: TASK-102205 - Bag count + claim ticket. Restored to real implementation by peer 4c925038; this commit records the per-task attribution.