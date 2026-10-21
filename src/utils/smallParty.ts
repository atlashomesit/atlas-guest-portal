/** GUEST-033: a "group home" sleeps 5+; a 1-2 guest search gets right-sized homes first and a hint on big ones. */
export const GROUP_HOME_MIN_GUESTS = 5;
export const isSmallParty = (guests: number | null | undefined): boolean => guests != null && guests >= 1 && guests <= 2;
export const isGroupHome = (u: { maxGuests: number }): boolean => u.maxGuests >= GROUP_HOME_MIN_GUESTS;

/** Stable partition: homes sized for a 1-2 guest party first. Other guest counts: order untouched. */
export function sizedForPartyFirst<T extends { maxGuests: number }>(list: T[], guests: number | null | undefined): T[] {
  return isSmallParty(guests) ? [...list.filter((u) => !isGroupHome(u)), ...list.filter(isGroupHome)] : list;
}
