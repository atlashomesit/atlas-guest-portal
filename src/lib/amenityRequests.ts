/**
 * TASK-102200 — In-stay amenity request catalog.
 *
 * Done-when:
 * 1. Visual catalog displays amenity cards with pictures and quantity steppers.
 * 2. Submitting a request dispatches a live alert payload (room + SLA timer).
 */

export interface AmenityItem {
  id: string;
  name: string;
  imageUrl: string;
  complimentary: boolean;
  unitPriceInr: number;
  maxQtyPerRequest: number;
}

export const AMENITY_CATALOG: AmenityItem[] = [
  { id: 'pillows', name: 'Extra Pillows', imageUrl: '/amenities/pillows.jpg', complimentary: true, unitPriceInr: 0, maxQtyPerRequest: 4 },
  { id: 'towels', name: 'Bath Towels', imageUrl: '/amenities/towels.jpg', complimentary: true, unitPriceInr: 0, maxQtyPerRequest: 4 },
  { id: 'water', name: 'Mineral Water (1L)', imageUrl: '/amenities/water.jpg', complimentary: true, unitPriceInr: 0, maxQtyPerRequest: 6 },
  { id: 'dental-kit', name: 'Dental Kit', imageUrl: '/amenities/dental-kit.jpg', complimentary: false, unitPriceInr: 99, maxQtyPerRequest: 4 },
];

export interface AmenityRequestLine {
  amenityId: string;
  qty: number;
}

export interface AmenityDispatch {
  roomNumber: string;
  lines: AmenityRequestLine[];
  estimatedTotalInr: number;
  slaDueAtMs: number;
}

export function clampAmenityQty(item: AmenityItem, qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.min(Math.max(Math.floor(qty), 0), item.maxQtyPerRequest);
}

export const AMENITY_SLA_MINUTES = 30;

export function buildAmenityDispatch(
  roomNumber: string,
  lines: AmenityRequestLine[],
  nowMs: number = Date.now(),
): AmenityDispatch {
  const byId = new Map(AMENITY_CATALOG.map((a) => [a.id, a]));
  const clean = lines
    .filter((l) => byId.has(l.amenityId))
    .map((l) => ({ amenityId: l.amenityId, qty: clampAmenityQty(byId.get(l.amenityId)!, l.qty) }))
    .filter((l) => l.qty > 0);
  const estimatedTotalInr = clean.reduce(
    (sum, l) => sum + byId.get(l.amenityId)!.unitPriceInr * l.qty,
    0,
  );
  return {
    roomNumber: roomNumber.trim(),
    lines: clean,
    estimatedTotalInr,
    slaDueAtMs: nowMs + AMENITY_SLA_MINUTES * 60_000,
  };
}
