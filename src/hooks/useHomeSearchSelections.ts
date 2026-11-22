import React from "react";

/**
 * The stay a guest picked on the home page, read from the URL (`checkIn`, `checkOut`, `adults`, `children`, `guests`).
 * Moved out of HomePage_Locations unchanged (GUEST-065 item 1) so the three alternate "our homes" layouts read the dates the
 * same way the default grid does.
 */
export const useHomeSearchSelections = (search: string) => {
  return React.useMemo(() => {
    const params = new URLSearchParams(search);

    const parseDate = (value: string | null) => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    };

    const parseGuests = (value: string | null) => {
      if (!value) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };

    const checkIn = parseDate(params.get("checkIn") ?? params.get("checkin"));
    const checkOut = parseDate(params.get("checkOut") ?? params.get("checkout"));
    const adults = parseGuests(params.get("adults"));
    const children = parseGuests(params.get("children"));
    const guestsParam = parseGuests(params.get("guests"));
    const guestTotal = Math.max((adults ?? 0) + (children ?? 0), guestsParam ?? 0);
    const guests = guestTotal > 0 ? guestTotal : null;

    const normalizedCheckOut =
      checkOut && checkIn && new Date(checkOut) <= new Date(checkIn) ? null : checkOut;

    const nextSearch = new URLSearchParams();
    if (checkIn) nextSearch.set("checkIn", checkIn);
    if (normalizedCheckOut) nextSearch.set("checkOut", normalizedCheckOut);
    if (guests) nextSearch.set("guests", String(guests));

    return {
      checkIn,
      checkOut: normalizedCheckOut,
      guests,
      searchString: nextSearch.toString(),
    };
  }, [search]);
};
