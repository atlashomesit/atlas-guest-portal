import React from "react";
import { useLocation } from "react-router-dom";

import { useCurrency } from "../contexts/CurrencyContext";
import { isHostelDorm } from "../components/hostel/HostelDormBadge";
import { getTenantContext } from "../tenant/tenantContext";
import { hasOnlinePaymentRail } from "../tenant/paymentRail";
import { SIMILAR_STAY_PRICE_HINT } from "../utils/marketplaceBackHref";
import {
  marketplaceStayNights,
  toMarketplaceDateOnly,
  useMarketplaceCardPrices,
  type MarketplaceCardPriceItem,
  type MarketplaceStay,
} from "./useMarketplaceCardPrices";
import { useHomeSearchSelections } from "./useHomeSearchSelections";

/**
 * GUEST-065 item 1 (founder ruling 2026-11-19): the guest home page shows the live price for the dates the guest picked,
 * or "See the price for your dates" when no dates are picked, and no cached or hard-coded number anywhere on that page.
 * One wording, shared with the Similar stays cards (SIMILAR_STAY_PRICE_HINT).
 */
export const HOME_CARD_PRICE_HINT = SIMILAR_STAY_PRICE_HINT;

export type HomeCardPriceLine =
  | { kind: "hint"; text: string; testId: "home-card-price-hint" }
  | { kind: "loading"; text: string; testId: "home-card-price-loading" }
  | { kind: "sold-out"; text: string; testId: "home-card-sold-out" }
  | { kind: "price"; text: string; amount: string; unit: string; testId: "home-card-real-price" };

type HomeCardProperty = {
  id: number | string;
  listingId?: number;
  accommodationType?: string | null;
};

/**
 * What a home card says about price, for the layouts that print one line (coastal gallery, editorial featured stays,
 * photo-first stack). With dates in the URL it is the same quote the default grid, the booking box and checkout use
 * (GET /api/pricing/guest-breakdown for exactly those dates and guests, through useMarketplaceCardPrices); with no dates it
 * is the hint and nothing is asked. Returns a function so a layout asks per property.
 */
export function useHomeCardPriceLines(
  properties: ReadonlyArray<HomeCardProperty>,
): (property: HomeCardProperty) => HomeCardPriceLine {
  const location = useLocation();
  const { format: formatCurrency } = useCurrency();
  const tenant = getTenantContext();
  const paymentFeeCharged = hasOnlinePaymentRail(tenant);
  const { checkIn, checkOut, guests } = useHomeSearchSelections(location.search);

  const stay = React.useMemo<MarketplaceStay>(
    () => ({
      checkIn: toMarketplaceDateOnly(checkIn),
      checkOut: toMarketplaceDateOnly(checkOut),
      guests,
    }),
    [checkIn, checkOut, guests],
  );
  const hasStayDates = Boolean(stay.checkIn && stay.checkOut && marketplaceStayNights(stay.checkIn, stay.checkOut) != null);

  const idOf = React.useCallback((property: HomeCardProperty): number => {
    const raw = property.listingId ?? Number(property.id);
    return Number(raw);
  }, []);

  const items = React.useMemo<MarketplaceCardPriceItem[]>(() => {
    if (!hasStayDates) return [];
    return properties
      .map((property): MarketplaceCardPriceItem | null => {
        const id = idOf(property);
        if (!Number.isFinite(id) || id <= 0) return null;
        return { id, tenantSlug: tenant?.slug ?? "", chargesOnlinePaymentFee: paymentFeeCharged };
      })
      .filter((item): item is MarketplaceCardPriceItem => item !== null);
  }, [hasStayDates, properties, idOf, tenant?.slug, paymentFeeCharged]);

  const prices = useMarketplaceCardPrices(items, hasStayDates ? stay : { checkIn: null, checkOut: null, guests: null });

  return React.useCallback(
    (property: HomeCardProperty): HomeCardPriceLine => {
      if (!hasStayDates) return { kind: "hint", text: HOME_CARD_PRICE_HINT, testId: "home-card-price-hint" };
      const price = prices.get(idOf(property));
      if (!price || price.status === "loading") {
        return { kind: "loading", text: "Checking price…", testId: "home-card-price-loading" };
      }
      if (price.status === "unavailable") {
        return { kind: "sold-out", text: "Sold out for your dates", testId: "home-card-sold-out" };
      }
      // A dorm is sold by the bed (TASK-1040089): its line says "bed / night", the same as the default grid.
      const unit = isHostelDorm({ accommodationType: property.accommodationType }) ? "bed / night" : "night";
      const amount = formatCurrency(price.display.realNightly);
      return { kind: "price", text: `${amount} / ${unit}`, amount, unit, testId: "home-card-real-price" };
    },
    [hasStayDates, prices, idOf, formatCurrency],
  );
}
