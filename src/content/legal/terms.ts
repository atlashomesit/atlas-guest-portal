import { MARKETPLACE_BRAND_BASELINE } from "../../tenant/displayBrand";

export type TermsSection = {
  id: string;
  title: string;
  summary?: string;
  body?: string[];
  bullets?: string[];
};

export const termsMetadata = {
  /** Title is localized in `Terms.tsx` via `getTenantBrandName()`. */
  lastUpdated: "Last updated: January 10, 2025",
};

export const termsSections: TermsSection[] = [
  {
    id: "booking-payments",
    title: "Booking, Pricing & Payments",
    summary:
      "Reservations are confirmed only after payment is received; pricing and taxes are disclosed during checkout or on the invoice.",
    body: [
      "Bookings are confirmed after the communicated advance is received. Balances are due before check-in unless stated otherwise.",
      "Rates, taxes, and fees (including GST and payment gateway charges) are shared transparently on the invoice or booking link.",
      "We reserve the right to correct clear pricing errors prior to confirming a booking.",
    ],
  },
  {
    id: "cancellations-refunds",
    title: "Cancellations, Refunds & Credits",
    summary:
      "Notice windows impact refunds; once the stay begins, unused nights are generally non-refundable unless mandated by law.",
    body: [
      "Cancellations received more than 15 days before check-in may be eligible for a full refund, less non-recoverable processing fees.",
      "Cancellations received 7–15 days before check-in may be eligible for a partial refund or credit, as communicated at booking time.",
      "Cancellations within 7 days of arrival, no-shows, and early departures are typically non-refundable once the stay start date has begun unless required by law.",
    ],
  },
  {
    id: "checkin-checkout",
    title: "Check-in, Check-out & Access",
    summary:
      "Standard timing guidance with flexibility subject to availability; ID verification is mandatory before access codes are shared.",
    body: [
      "Standard check-in and check-out times are communicated per unit; early check-in or late check-out requires prior approval and may include an additional fee.",
      "Government-issued photo ID is required for every adult guest. Foreign nationals must present a valid passport and visa.",
      "Digital access codes or keys are shared only after ID verification and payment completion.",
    ],
  },
  {
    id: "guests-visitors",
    title: "Guests, Visitors & Conduct",
    summary:
      "Only registered guests may stay overnight; visitors must follow house rules and approved timings.",
    body: [
      "The booking covers the guests declared at reservation. Unregistered overnight guests are not permitted without written approval and may incur charges or cancellation without refund.",
      "Day visitors are allowed during stated hours with prior notice and must comply with building and house rules.",
      "Events, loud music, or commercial activity require written approval. Violations may lead to cancellation and recovery of costs.",
    ],
  },
  {
    id: "house-rules-care",
    title: "House Rules & Care of Property",
    summary:
      "Careful use of the property keeps common areas peaceful and safe for everyone.",
    bullets: [
      "No smoking or vaping indoors; use designated outdoor spaces only.",
      "Quiet hours are typically 10:00 PM–7:00 AM; respect neighbours and building guidelines.",
      "Handle furniture, appliances, and linens responsibly; do not tamper with safety devices.",
      "Dispose of waste in designated bins; avoid food waste in sinks to prevent blockages.",
    ],
  },
  {
    id: "amenities-safety",
    title: "Amenities, Safety & Maintenance",
    summary:
      "Amenity availability can vary by unit; follow posted safety instructions and report issues promptly.",
    body: [
      "Amenity access (e.g., jacuzzi, lift, parking, home theatre) may differ by building and can be paused for maintenance or association rules.",
      "Follow all posted safety instructions and reasonable usage limits; children should be supervised around water features and lifts.",
      "Report malfunctions immediately so we can coordinate assistance or maintenance.",
    ],
  },
  {
    id: "damages-liability",
    title: "Damages, Deposits & Liability",
    summary:
      "Guests are responsible for damages or losses they cause; refundable deposits may be used to cover costs.",
    body: [
      "We may charge for repair, replacement, or deep cleaning caused by avoidable damage, missing items, or violation of house rules.",
      "Security deposits (when collected) may be applied toward such costs; itemised statements are shared when deductions occur.",
      `${MARKETPLACE_BRAND_BASELINE} is not liable for personal belongings unless required by law. Please safeguard valuables and use available lockers where provided.`,
    ],
  },
  {
    id: "force-majeure-disputes",
    title: "Force Majeure & Governing Law",
    summary:
      "Service disruptions outside our control are not liable; disputes follow applicable local law.",
    body: [
      "We are not liable for interruptions caused by events outside our control (natural events, government actions, utility outages).",
      "We will make reasonable efforts to notify guests and provide alternatives when feasible.",
      "These Terms are governed by applicable laws of the property location; venue and jurisdiction follow those laws unless mandated otherwise.",
    ],
  },
];

export const paymentDataSharingNote =
  `You agree to share booking and payment details with ${MARKETPLACE_BRAND_BASELINE} and our payment providers, in line with applicable laws and privacy notices.`;
