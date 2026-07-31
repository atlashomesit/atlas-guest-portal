import { policySections } from "./policies";
import { REFUND_POLICY_TIMELINE_SENTENCE } from "../../config/refundPolicyTimelines";
import { termsSections } from "./terms";

type PolicyRef = (typeof policySections)[number]["id"];
type TermsRef = (typeof termsSections)[number]["id"];

type LegalLink = { type: "policy"; id: PolicyRef } | { type: "terms"; id: TermsRef };

export type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  linksTo: LegalLink[];
  tags?: string[];
};

export const faqItems: FaqItem[] = [
  {
    id: "advance-and-confirmation",
    category: "Booking & Payments",
    question: "Do I need to pay in advance to confirm my booking?",
    answer:
      "Yes. Your reservation is locked only after we receive the communicated advance. Remaining balances are due before check-in unless stated otherwise.",
    linksTo: [
      { type: "terms", id: "booking-payments" },
      { type: "policy", id: "checkin-checkout" },
    ],
    tags: ["payment", "advance"],
  },
  {
    id: "refund-timelines",
    category: "Cancellations & Refunds",
    question: "How long do refunds take if I cancel?",
    answer: REFUND_POLICY_TIMELINE_SENTENCE,
    linksTo: [
      { type: "policy", id: "cancellation-refunds" },
      { type: "terms", id: "cancellations-refunds" },
    ],
    tags: ["refund", "timeline"],
  },
  {
    id: "reschedule-options",
    category: "Cancellations & Refunds",
    question: "Can I reschedule instead of cancelling?",
    answer:
      "Reschedules are possible subject to availability. Notice windows may include a fee or tariff difference, and changes close to arrival follow the cancellation policy.",
    linksTo: [
      { type: "policy", id: "reschedules" },
      { type: "terms", id: "cancellations-refunds" },
    ],
    tags: ["reschedule", "change"],
  },
  {
    id: "id-requirements",
    category: "Check-in & Access",
    question: "What ID is required at check-in?",
    answer:
      "Government-issued photo ID is required for every adult guest. Foreign nationals need a valid passport and visa. We verify IDs before sharing access instructions.",
    linksTo: [
      { type: "policy", id: "checkin-checkout" },
      { type: "terms", id: "checkin-checkout" },
    ],
    tags: ["id", "check-in"],
  },
  {
    id: "early-late-checkin",
    category: "Check-in & Access",
    question: "Is early check-in or late check-out available?",
    answer:
      "Often yes, depending on housekeeping schedules and prior reservations. Early or late access may involve an additional fee and always requires prior approval.",
    linksTo: [
      { type: "policy", id: "checkin-checkout" },
      { type: "terms", id: "checkin-checkout" },
    ],
    tags: ["timing", "arrival"],
  },
  {
    id: "visitors",
    category: "Guests & Visitors",
    question: "Can I host visitors during my stay?",
    answer:
      "Yes, day visitors are usually allowed during stated hours with prior notice. Visitors must follow building rules, and unregistered overnight stays are not permitted.",
    linksTo: [
      { type: "policy", id: "guests-visitors" },
      { type: "terms", id: "guests-visitors" },
    ],
    tags: ["visitors", "guests"],
  },
  {
    id: "house-rules",
    category: "House Rules",
    question: "What house rules should I know before arriving?",
    answer:
      "Keep noise low during quiet hours (typically 10:00 PM–7:00 AM), no smoking indoors, and avoid parties or decorations without written approval.",
    linksTo: [
      { type: "policy", id: "house-rules-care" },
      { type: "terms", id: "house-rules-care" },
    ],
    tags: ["rules", "noise"],
  },
  {
    id: "amenities-availability",
    category: "Amenities & Safety",
    question: "Are all amenities available in every unit?",
    answer:
      "Amenity availability differs by building. Some features like jacuzzi, lift access, parking, or home theatre may be paused for maintenance or association guidelines.",
    linksTo: [
      { type: "policy", id: "amenities" },
      { type: "terms", id: "amenities-safety" },
    ],
    tags: ["amenities", "parking"],
  },
  {
    id: "damages-and-deposits",
    category: "Damages & Deposits",
    question: "When are deposits used or damages charged?",
    answer:
      "If avoidable damage, deep cleaning, or missing items occur, we may use the security deposit or invoice reasonable costs with an itemised statement.",
    linksTo: [
      { type: "policy", id: "damages-deposits" },
      { type: "terms", id: "damages-liability" },
    ],
    tags: ["deposit", "damages"],
  },
];
