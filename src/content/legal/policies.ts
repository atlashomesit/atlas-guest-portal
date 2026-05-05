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
  title: "Guest Policies | Atlas Guest Portal",
  effectiveDate: "Effective from January 10, 2025",
};

export const policySections: PolicySection[] = [
  {
    id: "cancellation-refunds",
    title: "Cancellation & Refunds",
    summary:
      "Notice periods determine eligibility for refunds or credits; no-shows and early departures are generally non-refundable once the stay begins.",
    details: [
      "100% refund (minus non-recoverable processing fees) for cancellations received more than 15 days before check-in, where stated.",
      "50% refund or equivalent credit for cancellations received 7–15 days before check-in, if applicable to your rate plan.",
      "Within 7 days of arrival, cancellations, no-shows, and early departures are typically non-refundable once the stay start date has begun unless required by law.",
      "Refunds (when applicable) are initiated to the original payment method within 7–10 business days after confirmation.",
    ],
    termsRefs: ["cancellations-refunds", "booking-payments"],
  },
  {
    id: "reschedules",
    title: "Reschedules & Date Changes",
    summary:
      "Date changes depend on availability and may incur fees or rate differences; new tariffs apply to the revised dates.",
    details: [
      "One complimentary date change may be available when requested more than 15 days before arrival, subject to availability within 90 days of the original date.",
      "Date changes 7–15 days before arrival may incur a reschedule fee up to 25% of the booking value, plus any higher tariff differences.",
      "Within 7 days of arrival, date changes are treated as cancellations and follow the cancellation policy.",
      "Higher tariff dates (weekends/holidays) are charged at prevailing rates; lower tariff differences are not refunded unless mandated by law.",
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
