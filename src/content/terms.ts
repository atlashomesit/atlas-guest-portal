import { getTenantBrandNameLong } from "../tenant/displayBrand";
import { formatDisplayNumber, isWhiteLabelTenant } from "../config/contact";

export type TermsSection = {
  id: string;
  number: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export const termsMetadata = {
  /** Title is localized on the live Terms page via `getTenantBrandName()`. */
  lastUpdated: "Last updated: January 10, 2025",
};

export const termsSections: TermsSection[] = [
  {
    id: "booking-payment",
    number: "1",
    title: "Booking & Payment",
    paragraphs: [
      "Booking is confirmed only after successful payment. Please provide correct guest details and dates.",
      "Payments are non-refundable unless stated otherwise.",
    ],
  },
  {
    id: "check-in-check-out",
    number: "2",
    title: "Check-in / Check-out",
    paragraphs: [
      "Timings vary by unit (101: 11AM–9AM, 102: 1PM–11AM, 302: 12PM–10AM, Penthouse: 2PM–12PM).",
      "Early/late check-in only with prior approval and may attract charges.",
    ],
  },
  {
    id: "guests",
    number: "3",
    title: "Guests",
    paragraphs: [
      "Base price includes 2 guests. Extra guests \u20b9400–\u20b9600 per night depending on unit.",
      "All guests must show valid Govt. ID at check-in. Guests <21 yrs must be with guardian.",
    ],
  },
  {
    id: "cancellations",
    number: "4",
    title: "Cancellations",
    // TASK-7819 (founder ruling 2026-08-11: the engine is correct, this copy was wrong).
    // The refund is computed by the server from the listing's cancellation tier — see
    // `CancellationRefundCalculator`. A listing with no tier resolves to Flexible, whose late
    // fee is 0%, so it refunds in full at any time. Do not restate percentages or windows here:
    // they belong to the per-listing policy shown on the listing page.
    paragraphs: [
      "Cancellation terms depend on the cancellation policy set for the home you booked. The policy that applies to your stay is shown on the listing page before you pay, and again on your booking confirmation.",
      "Refunds are returned to the original payment method. Where a cancellation fee applies under the home's policy, only that fee is retained and the remainder is refunded.",
    ],
  },
  {
    id: "house-rules",
    number: "5",
    title: "House Rules",
    bullets: [
      "No parties, loud music or decorations without written approval (extra cleaning min \u20b93,000).",
      "Smoking only in balcony/patio/terrace. Alcohol inside rooms only.",
      "Pets not allowed unless approved.",
      "Silence hours: 10PM–7AM.",
    ],
  },
  {
    id: "damages",
    number: "6",
    title: "Damages",
    paragraphs: [
      "Guests liable for damages or missing items. Penalties apply: repainting \u20b910k, jacuzzi/home theatre \u20b920k–\u20b925k.",
      "Damages found after checkout will be billed.",
    ],
  },
  {
    id: "safety",
    number: "7",
    title: "Safety",
    paragraphs: [
      "Guests must follow fire/electrical safety rules.",
      "Illegal activities strictly prohibited and reported to authorities.",
    ],
  },
  {
    id: "force-majeure",
    number: "8",
    title: "Force Majeure",
    paragraphs: [
      "We are not liable for cancellations/disruptions beyond our control (govt. restrictions, natural disasters, technical failures).",
    ],
  },
  {
    id: "contacts",
    number: "9",
    title: "Contacts",
    // RA-006: phone resolved at render time via getContactPhone(); omit the line on a
    // white-label tenant when no tenant number is configured (formatDisplayNumber returns "").
    get paragraphs(): string[] {
      const mgr = formatDisplayNumber("business");
      const rows: string[] = [];
      if (mgr) rows.push(`Property Manager: ${mgr}.`);
      // Owner escalation line is Atlas-only; never show it on a white-label tenant.
      if (!isWhiteLabelTenant()) rows.push("Owner (escalation): contact us via the main number.");
      return rows;
    },
  },
];

/** Razorpay / checkout: data controller name must follow the resolved tenant (RA-006 AC-8). */
export function getPaymentDataSharingNote(): string {
  const controller = getTenantBrandNameLong().toUpperCase();
  return `You agree to share information entered on this page with ${controller} (owner of this page) and Razorpay, adhering to applicable laws.`;
}

export const inlinePolicySnippets = {
  guestId: "Govt ID required for all adult guests; guests under 21 must stay with a guardian.",
  extraGuests: "Base stay covers 2 guests. Extra guests are charged \u20b9400–\u20b9600/night depending on the unit.",
  // TASK-7819: this snippet is rendered as generic inline policy text and has NO listing in
  // scope, so it must not assert any refund outcome — the outcome depends on the listing's tier
  // and is computed server-side. It previously hardcoded "No refunds ... within 7 days", which
  // pre-empted the tier-derived copy and contradicted the engine on every untiered listing.
  // Keep it non-numeric: no percentages, no day/hour windows.
  cancellation:
    "Cancellation terms follow the policy set for this home — see the cancellation policy on the listing page.",
  houseRules:
    "Keep quiet hours 10PM–7AM; no parties or decorations without approval; smoke only in balcony/patio/terrace; pets only if pre-approved.",
  damages: "Damage or missing items will be billed; specific penalties may apply.",
};
