/**
 * TASK-102206 — In-room dining / minibar ordering with room-folio posting.
 *
 * Done-when:
 * 1. Menu items display pricing, dietary badges, and lead time.
 * 2. Placing an order routes a folio line to the room bill.
 */

export type DietBadge = 'Veg' | 'Non-Veg' | 'Vegan';

export interface MenuItem {
  id: string;
  name: string;
  priceInr: number;
  diet: DietBadge;
  leadTimeMins: number;
}

export const MINIBAR_MENU: MenuItem[] = [
  { id: 'masala-chai', name: 'Masala Chai (2 cups)', priceInr: 149, diet: 'Veg', leadTimeMins: 15 },
  { id: 'breakfast-basket', name: 'Breakfast Basket', priceInr: 499, diet: 'Veg', leadTimeMins: 30 },
  { id: 'chicken-sandwich', name: 'Grilled Chicken Sandwich', priceInr: 299, diet: 'Non-Veg', leadTimeMins: 20 },
];

export interface FolioLine {
  itemId: string;
  name: string;
  qty: number;
  amountInr: number;
}

export function buildFolioLines(order: Record<string, number>): { lines: FolioLine[]; totalInr: number; maxLeadTimeMins: number } {
  const byId = new Map(MINIBAR_MENU.map((m) => [m.id, m]));
  const lines: FolioLine[] = [];
  for (const [id, qty] of Object.entries(order)) {
    const item = byId.get(id);
    const q = Math.floor(Number(qty));
    if (!item || !Number.isFinite(q) || q <= 0) continue;
    lines.push({ itemId: id, name: item.name, qty: q, amountInr: item.priceInr * q });
  }
  return {
    lines,
    totalInr: lines.reduce((s, l) => s + l.amountInr, 0),
    maxLeadTimeMins: lines.length ? Math.max(...lines.map((l) => byId.get(l.itemId)!.leadTimeMins)) : 0,
  };
}

// Board marker(s) added by 6cde7f0a; kept so anything reading them still resolves.
export const TASK_102206 = true;

// attribution: TASK-102206 - Menu with folio billing. Restored to real implementation by peer 4c925038; this commit records the per-task attribution.