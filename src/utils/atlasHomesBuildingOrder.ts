/**
 * Sort key for Atlas KPHB units: penthouse on top, then higher floors first,
 * ascending room number within the same floor (501 → 301,302 → 201,202 → 101,102).
 */
export function atlasHomesBuildingSortKey(roomId: number): [number, number] {
  if (roomId === 501) return [0, 0];
  if (roomId >= 100 && roomId < 600) {
    const floor = Math.floor(roomId / 100);
    const unit = roomId % 100;
    return [100 - floor, unit];
  }
  return [200, roomId];
}

export function compareAtlasHomesBuildingOrder(aId: string | number, bId: string | number): number {
  const a = Number(aId);
  const b = Number(bId);
  const ka = atlasHomesBuildingSortKey(Number.isFinite(a) ? a : 999);
  const kb = atlasHomesBuildingSortKey(Number.isFinite(b) ? b : 999);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  return ka[1] - kb[1];
}
