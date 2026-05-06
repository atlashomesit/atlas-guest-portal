/* eslint-disable atlas-brand/no-atlas-string-leak -- legacy SGH terms stub; marketplace name from displayBrand (CPO-001). */
import { MARKETPLACE_BRAND_BASELINE } from "../tenant/displayBrand";

export type TermsSection = {
  id: string;
  number: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export const termsMetadata = {
  title: `Terms & Conditions – ${MARKETPLACE_BRAND_BASELINE}`,
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
    paragraphs: [
      "No refunds for no-shows or cancellations within 7 days of check-in.",
      "Earlier cancellations may get credit for future booking at our discretion.",
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
    paragraphs: [
      "Property Manager: +91-7032493290.",
      "Owner (escalation): +91-9177773290.",
    ],
  },
];

export const paymentDataSharingNote =
  "You agree to share information entered on this page with ATLAS HOMES (owner of this page) and Razorpay, adhering to applicable laws.";

export const inlinePolicySnippets = {
  guestId: "Govt ID required for all adult guests; guests under 21 must stay with a guardian.",
  extraGuests: "Base stay covers 2 guests. Extra guests are charged \u20b9400–\u20b9600/night depending on the unit.",
  cancellation:
    "No refunds for no-shows or cancellations within 7 days of check-in; earlier cancellations may receive a credit at our discretion.",
  houseRules:
    "Keep quiet hours 10PM–7AM; no parties or decorations without approval; smoke only in balcony/patio/terrace; pets only if pre-approved.",
  damages: "Damage or missing items will be billed; specific penalties may apply.",
  paymentConsent: paymentDataSharingNote,
};
