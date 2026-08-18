/**
 * TASK-8016: choke-point guard for advertised promo codes.
 * Surfaces that hardcode a code (OffersPage DIRECT5 card, DirectDiscountBanner)
 * must confirm it via /api/promo-codes/validate before rendering. Invalid/inactive
 * codes render nothing — never a false promise at checkout.
 */
import { useEffect, useState } from "react";
import { buildApiUrl, getApiHeaders } from "@/api/client";

export type AdvertisedPromoState = "checking" | "active" | "inactive";

export function useAdvertisedPromoActive(code: string): AdvertisedPromoState {
  const [state, setState] = useState<AdvertisedPromoState>("checking");

  useEffect(() => {
    let cancelled = false;
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setState("inactive");
      return;
    }

    setState("checking");
    (async () => {
      try {
        const res = await fetch(buildApiUrl("/api/promo-codes/validate"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getApiHeaders(),
          },
          body: JSON.stringify({ code: normalized, listingId: 0, subtotal: 10000 }),
        });
        const data = (await res.json()) as { valid?: boolean };
        if (!cancelled) setState(data?.valid === true ? "active" : "inactive");
      } catch {
        if (!cancelled) setState("inactive");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return state;
}
