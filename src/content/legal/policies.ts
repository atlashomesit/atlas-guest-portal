import { REFUND_POLICY_TIMELINE_SENTENCE } from "../../config/refundPolicyTimelines";
import { MARKETPLACE_BRAND_BASELINE } from "../../tenant/displayBrand";
import { termsSections } from "./terms";

type TermsRef = (typeof termsSections)[number]["id"];

export type PolicySection = {
  id: string;
  title: string;
  summary: string;
  details: string[];
  termsRefs: TermsRef[];
  effectiveDate?: string;
};

export const policyMetadata = {
  /** Title is localized in `Policies.tsx` via `getTenantBrandName()`. */
  effectiveDate: "Effective from January 10, 2025",
};

export const policySections: PolicySection[] = [
  {
    id: "cancellation-refunds",
    title: "Cancellation & Refunds",
    summary:
      "The cancellation policy shown on the home's listing for your rate decides what you can be refunded; no-shows and early departures are generally non-refundable once the stay begins.",
    details: [
      "The cancellation policy that applies to your stay is the one shown on the home's listing for the rate you choose, and again on your booking confirmation. Each rate can differ, and some rates are non-refundable.",
      "Where no cancellation policy is shown for your stay, contact the host before you pay.",
      "No-shows and early departures are typically non-refundable once the stay start date has begun, unless required by law.",
      REFUND_POLICY_TIMELINE_SENTENCE,
    ],
    termsRefs: ["cancellations-refunds", "booking-payments"],
  },
  {
    id: "reschedules",
    title: "Reschedules & Date Changes",
    summary:
      "Date changes depend on the host and the listing's policy shown at booking, subject to availability for the revised dates.",
    details: [
      "Date changes depend on the host and the listing's policy shown at booking (as agreed with your host and the listing's policy).",
      "You can request a date change from your booking page or by contacting your host; changes are subject to availability for the requested dates.",
      "Where the revised dates carry a higher nightly tariff, any rate difference applies as agreed with your host and the listing's policy.",
    ],
    termsRefs: ["cancellations-refunds", "booking-payments"],
  },
  {
    id: "checkin-checkout",
    title: "Check-in & Check-out",
    summary:
      "Standard timings apply; early check-in or late check-out requires prior approval and may incur additional charges.",
    details: [
      "Standard check-in/check-out windows vary by unit and are communicated during booking.",
      "Early check-in or late check-out is subject to availability and may attract a half-day or stated fee.",
      "Digital access codes or keys are shared only after ID verification and payment completion for the booking.",
      "Lost keys/fobs may incur replacement costs and a reasonable service charge.",
    ],
    termsRefs: ["checkin-checkout"],
  },
  {
    id: "guests-visitors",
    title: "Guests, Extra Guests & Visitors",
    summary:
      "Only registered guests may stay overnight; additional guests or visitors need prior approval and must follow building rules.",
    details: [
      "Registered guests are those declared at booking. Unregistered overnight stays are not permitted and may result in cancellation without refund.",
      "Additional guests are subject to approval and applicable charges. Visitor access is typically limited to posted hours with prior notice.",
      "Government ID is required for every adult guest; building security rules apply to visitors as well.",
    ],
    termsRefs: ["guests-visitors", "checkin-checkout"],
  },
  {
    id: "house-rules-care",
    title: "House Rules & Community Etiquette",
    summary:
      "Keep noise low, respect neighbours, and avoid prohibited activities to maintain a safe environment.",
    details: [
      "Quiet hours are generally 10:00 PM–7:00 AM; avoid loud music, parties, or decorations without written approval.",
      "No smoking or vaping indoors. Use designated outdoor areas where available.",
      "Commercial activities, illegal substances, and safety device tampering are prohibited and may lead to eviction.",
    ],
    termsRefs: ["house-rules-care"],
  },
  {
    id: "amenities",
    title: "Amenity Usage (Jacuzzi, Lift, Parking, Home Theatre)",
    summary:
      "Amenities may vary by building and can be paused for maintenance; follow posted guidance to keep them available for everyone.",
    details: [
      "Amenity availability (e.g., jacuzzi, lift, parking, home theatre) is shared per unit and may be restricted by building rules or maintenance windows.",
      "Follow posted safety limits, supervise children, and avoid altering wiring or controls. Report malfunctions immediately so we can help.",
      "Parking is limited to the allotted slot where provided; improper parking may result in towing at the vehicle owner’s cost.",
    ],
    termsRefs: ["amenities-safety", "house-rules-care"],
  },
  {
    id: "damages-deposits",
    title: "Damages, Deposits & Incidentals",
    summary:
      "Avoidable damage, missing items, or excessive cleaning may be charged; security deposits may be adjusted against such costs.",
    details: [
      "We expect normal wear and tear. Avoidable damage, deep cleaning, or missing items may be billed at reasonable replacement or service costs.",
      "Security deposits (when collected) can be used against these costs; itemised statements are shared when deductions occur.",
      "Misuse of safety systems or appliances may attract penalties and repair charges.",
    ],
    termsRefs: ["damages-liability"],
  },
  {
    id: "compliance-liability",
    title: "Compliance, Safety & Liability",
    summary:
      `Follow safety instructions and applicable law; ${MARKETPLACE_BRAND_BASELINE} is not liable for personal belongings unless required by law.`,
    details: [
      "Guests must comply with building safety rules, emergency procedures, and reasonable instructions from staff or building management.",
      "Illegal activity is prohibited and may be reported to authorities.",
      `${MARKETPLACE_BRAND_BASELINE} is not liable for personal belongings or service interruptions outside our control unless required by law.`,
    ],
    termsRefs: ["force-majeure-disputes", "damages-liability"],
  },
];
