import { formatDisplayNumber } from '../config/contact';
import { getTenantContext } from '../tenant/tenantContext';
import { getTenantOverrides, shouldHideAtlasBranding } from '../tenant/tenantOverrides'; // TASK-1878

export type FaqHighlight = {
  id: string;
  question: string;
  answer: string;
};

/**
 * Returns FAQ entries for the current tenant.
 * TASK-1878: if tenantOverrides.faq is set for the resolved slug, that takes
 * precedence over the Atlas-Penthouse defaults below.
 */
export function getFaqHighlights(): FaqHighlight[] {
  // TASK-1878: tenant override check
  const slug = getTenantContext()?.slug;
  const overrides = getTenantOverrides(slug);
  if (overrides.faq && overrides.faq.length > 0) {
    return overrides.faq;
  }

  const tenant = getTenantContext();
  const hideAtlasBranding = shouldHideAtlasBranding(tenant, overrides);
  const businessPhone = formatDisplayNumber("business");
  const ownerPhone = formatDisplayNumber("owner");

  return [
    {
      id: "checkin-checkout",
      question: "How do check-in and check-out work?",
      answer: hideAtlasBranding
        ? "Standard check-in is 2:00 PM and check-out is 11:00 AM. Self check-in with ID is supported, and early/late slots depend on availability."
        : "Standard check-in is 2:00 PM (3:00 PM for the penthouse) and check-out is 11:00 AM (12:00 PM for the penthouse). Self check-in with ID is supported, and early/late slots depend on availability.",
    },
    {
      id: "changes-cancellations",
      question: "What is the cancellation and change policy?",
      answer:
        "You can modify dates if the unit is free, and cancellations follow the notice-based policy shown at booking. Refunds are pro-rated for used nights after check-in.",
    },
    {
      id: "extra-guests-fees",
      question: "Can I add extra guests or pay additional fees?",
      answer: hideAtlasBranding
        ? "Base occupancy covers the guests listed for your unit. Extra adults are allowed within the max capacity and incur a per-guest nightly fee as shown during checkout."
        : "Base occupancy covers two guests (four in the penthouse). Extra adults are allowed within the max capacity and incur a per-guest nightly fee as shown during checkout.",
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
      answer:
        `Message us on WhatsApp at ${businessPhone} or call the same number for quick help. For escalations, the owner line is ${ownerPhone}.`,
    },
  ];
}
