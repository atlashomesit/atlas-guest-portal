/**
 * GUEST-072: the "same hands" sentence under the owner-run homes count, true for one home and for many. One home reads "it", several read "them"
 * (it used to say "1 owner-run home. Same hands clean them").
 */
export function sameHands(homeCount: number): string {
  return homeCount === 1
    ? 'Same hands clean it, restock it, and answer the door.'
    : 'Same hands clean them, restock them, and answer the door.';
}
