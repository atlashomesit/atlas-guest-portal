/**
 * NOTIF-074: read the booking id and access code of a review link.
 *
 * The review request on WhatsApp opens `https://atlashomestays.com/review/{{1}}`, where `{{1}}` is the button suffix
 * `<bookingId>?t=<code>`. If WhatsApp appends it as written, the code is in the query string (`?t=`). If it percent-encodes the
 * `?` and `=` instead, the router hands us the whole tail as the booking id (`1042?t=<code>`), so the code is read from there too.
 * A booking id that is not a plain number is rejected rather than sent to the API.
 */
export interface ReviewLinkParams {
  bookingId: string | null;
  token: string | null;
}

export function resolveReviewLinkParams(rawBookingId: string | undefined, queryToken: string | null): ReviewLinkParams {
  let id = (rawBookingId ?? "").trim();
  let token = (queryToken ?? "").trim();

  const cut = id.search(/[?&]/);
  if (cut >= 0) {
    const tail = id.slice(cut + 1);
    id = id.slice(0, cut);
    if (!token) {
      const fromTail = new URLSearchParams(tail).get("t");
      if (fromTail) token = fromTail.trim();
    }
  }

  return {
    bookingId: /^\d+$/.test(id) ? id : null,
    token: token || null,
  };
}
