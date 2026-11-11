import { formatDisplayNumber } from '../config/contact';
import { getTenantContext } from '../tenant/tenantContext';
import { isNeutralBrandingMode } from '../tenant/displayBrand';
import { getTenantOverrides } from '../tenant/tenantOverrides'; // TASK-1878
import { isMarketplaceMode } from '../tenant/tenantResolver';

export type FaqHighlight = {
  id: string;
  question: string;
  answer: string;
};

/**
 * TASK-101710: white-label tenants have no owner number (formatDisplayNumber
 * returns "" when the resolved phone is empty) — omit the escalation clause
 * instead of rendering "the owner line is .".
 */
function buildSupportAnswer(businessPhone: string, ownerPhone: string): string {
  const base = `Message us on WhatsApp at ${businessPhone} or call the same number for quick help.`;
  return ownerPhone.trim() ? `${base} For escalations, the owner line is ${ownerPhone}.` : base;
}

/** GUEST-062: the standard times the generic FAQ states; the listing page falls back to the same words. */
export const STANDARD_CHECK_IN_TIME = "2:00 PM";
export const STANDARD_CHECK_OUT_TIME = "11:00 AM";

function usesAtlasDemoFaq(slug: string | undefined): boolean {
  return (
    !isNeutralBrandingMode() &&
    (isMarketplaceMode() || (slug ?? "").trim().toLowerCase() === "atlas")
  );
}

/**
 * GUEST-062: the standard check-in / check-out times for a listing that has none of its own, but ONLY
 * when the FAQ this visitor reads actually states them (the generic FAQ). A tenant with its own FAQ, and
 * the Atlas/marketplace FAQ (which deliberately names no times), get null so the page never shows a time
 * its own FAQ does not back.
 */
export function getStandardStayTimes(): { checkIn: string; checkOut: string } | null {
  const tenantCtx = getTenantContext();
  if (tenantCtx?.faq && tenantCtx.faq.length > 0) return null;
  const overrides = getTenantOverrides(tenantCtx?.slug);
  if (overrides.faq && overrides.faq.length > 0) return null;
  if (usesAtlasDemoFaq(tenantCtx?.slug)) return null;
  return { checkIn: STANDARD_CHECK_IN_TIME, checkOut: STANDARD_CHECK_OUT_TIME };
}

function genericWhiteLabelFaq(businessPhone: string, ownerPhone: string): FaqHighlight[] {
  return [
    {
      id: "checkin-checkout",
      question: "How do check-in and check-out work?",
      answer:
        `Standard check-in is ${STANDARD_CHECK_IN_TIME} and check-out is ${STANDARD_CHECK_OUT_TIME} unless your confirmation says otherwise. Self check-in with ID is supported when offered, and early/late slots depend on availability.`,
    },
    {
      id: "changes-cancellations",
      question: "What is the cancellation and change policy?",
      answer:
        "You can modify dates if the unit is free. Cancellations and refunds follow the notice-based policy shown on the listing at booking — check that policy before you book.",
    },
    {
      id: "extra-guests-fees",
      question: "Can I add extra guests or pay additional fees?",
      answer:
        "Base occupancy is shown on each listing. Extra adults are allowed within the max capacity and incur a per-guest nightly fee as shown during checkout.",
    },
    {
      id: "wifi-parking",
      question: "Is Wi-Fi and parking included?",
      answer:
        "High-speed Wi-Fi is included in all units. Parking availability varies by property; confirm with the host for oversized vehicles.",
    },
    {
      id: "workation-ready",
      question: "Are the units suitable for workations?",
      answer:
        "Many stays include reliable Wi-Fi and a desk or dining table that doubles as a workspace. Check the listing amenities for details.",
    },
    {
      id: "support-contact",
      question: "How do I reach support during my stay?",
      answer: buildSupportAnswer(businessPhone, ownerPhone),
    },
  ];
}

/**
 * Returns FAQ entries for the current tenant.
 * TASK-1878: if tenantOverrides.faq is set for the resolved slug, that takes
 * precedence over defaults.
 * TASK-7194: Atlas demo "penthouse" copy is marketplace/Atlas-only — never on Neutral white-label.
 */
export function getFaqHighlights(): FaqHighlight[] {
  // GUEST-008: API tenant FAQ check first, then fallback to tenantOverrides
  const tenantCtx = getTenantContext();
  if (tenantCtx?.faq && tenantCtx.faq.length > 0) {
    return tenantCtx.faq;
  }

  // TASK-1878: tenant override check
  const slug = tenantCtx?.slug;
  const overrides = getTenantOverrides(slug);
  if (overrides.faq && overrides.faq.length > 0) {
    return overrides.faq;
  }

  const businessPhone = formatDisplayNumber("business");
  const ownerPhone = formatDisplayNumber("owner");

  const useAtlasDemoFaq = usesAtlasDemoFaq(slug);

  if (!useAtlasDemoFaq) {
    return genericWhiteLabelFaq(businessPhone, ownerPhone);
  }

  // Atlas / marketplace defaults (may mention demo units)
  return [
    {
      id: "checkin-checkout",
      question: "How do check-in and check-out work?",
      answer:
        // Founder ruling 2026-10-21: no hard-coded times that can contradict a home's own page.
        "Each home's page shows its check-in and check-out times. Self check-in with ID is supported, and early or late times depend on availability.",
    },
    {
      id: "changes-cancellations",
      question: "What is the cancellation and change policy?",
      answer:
        "You can modify dates if the unit is free. Cancellations and refunds follow the notice-based policy shown on the listing at booking — check that policy before you book.",
    },
    {
      id: "extra-guests-fees",
      question: "Can I add extra guests or pay additional fees?",
      answer:
        // GUEST-058: hosts choose their own included guests and extra-guest rate; do not state one host's numbers here.
        "The price you see covers the guests the host includes in that home; the listing shows how many. Extra guests are welcome up to each home's limit and may cost more per night, and the price updates as soon as you add them.",
    },
    {
      id: "wifi-parking",
      question: "Is Wi-Fi and parking included?",
      answer:
        "High-speed Wi-Fi is included in all units. Parking is available on-site on a first-come basis; confirm with the team for oversized vehicles.",
    },
    {
      id: "workation-ready",
      question: "Are the units suitable for workations?",
      answer:
        "Yes. All apartments include reliable Wi-Fi, desks or dining tables that double as workspaces, and backup power so you can work without interruptions.",
    },
    {
      id: "support-contact",
      question: "How do I reach support during my stay?",
      answer: buildSupportAnswer(businessPhone, ownerPhone),
    },
  ];
}
