import { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface FaqItem {
  id: string;
  question: string;
  answer: ReactNode;
  tags?: string[];
}

export interface FaqSection {
  id: string;
  title: string;
  description: string;
  items: FaqItem[];
}

export const faqSections: FaqSection[] = [
  {
    id: "booking-payments",
    title: "Booking & Payments",
    description: "Learn how to reserve your stay and complete payments securely.",
    items: [
      {
        id: "book-directly",
        question: "How do I book directly on Atlas Homestays?",
        answer: (
          <p>
            Browse our apartments, pick your preferred dates, and submit your details on the booking
            form. Our team will confirm availability and share a quick payment link to secure your stay.
          </p>
        ),
        tags: ["booking", "reservation", "direct"],
      },
      {
        id: "payment-methods",
        question: "What payment methods do you accept?",
        answer: (
          <p>
            We accept major UPI apps, bank transfers, and most debit/credit cards. Secure links are
            sent directly by our team so you never share payment details over chat.
          </p>
        ),
        tags: ["upi", "cards", "bank transfer"],
      },
      {
        id: "advance-payment",
        question: "Do you require an advance payment?",
        answer: (
          <p>
            Yes, a partial advance is needed to lock in your reservation. The remaining amount is paid
            before or at check-in based on the apartment and length of stay.
          </p>
        ),
        tags: ["advance", "deposit"],
      },
      {
        id: "booking-confirmation",
        question: "Will I get a confirmation message?",
        answer: (
          <p>
            Absolutely. Once payment is processed, we send a confirmation with your stay dates,
            apartment details, and check-in instructions via email and WhatsApp.
          </p>
        ),
        tags: ["confirmation", "email", "sms"],
      },
    ],
  },
  {
    id: "cancellation-refunds",
    title: "Cancellation & Refunds",
    description: "Understand how cancellations, changes, and refunds work.",
    items: [
      {
        id: "cancellation-policy",
        question: "What is your cancellation policy?",
        answer: (
          <p>
            Cancellations are accepted as per the timelines in our <Link to="/policies">Policies</Link>.
            The closer the check-in date, the higher the applicable charge.
          </p>
        ),
        tags: ["cancellation", "policy", "fees"],
      },
      {
        id: "partial-refunds",
        question: "How are partial refunds calculated?",
        answer: (
          <p>
            Refunds are pro-rated based on notice period and nights already stayed. Please review the
            refund slabs in our <Link to="/policies">Policies</Link> page for exact thresholds.
          </p>
        ),
        tags: ["partial", "refund", "pro-rated"],
      },
      {
        id: "refund-timeline",
        question: "When will I receive my refund?",
        answer: (
          <p>
            Eligible refunds are initiated within 5-7 business days after confirmation. Processing
            times may vary by bank or card issuer.
          </p>
        ),
        tags: ["refund", "timeline", "processing"],
      },
      {
        id: "reschedule-option",
        question: "Can I reschedule instead of cancelling?",
        answer: (
          <p>
            In many cases yes. Reschedules follow the same notice periods outlined in our
            <Link to="/policies">Policies</Link>. Message us with your new dates and we will confirm
            availability.
          </p>
        ),
        tags: ["reschedule", "change dates"],
      },
    ],
  },
  {
    id: "checkin-checkout",
    title: "Check-in & Check-out",
    description: "Arrival guidance, ID requirements, and timing flexibility.",
    items: [
      {
        id: "standard-times",
        question: "What are standard check-in and check-out times?",
        answer: (
          <p>
            Standard check-in is 1:00 PM and check-out is 11:00 AM unless mentioned otherwise in your
            confirmation. We share self check-in steps where available.
          </p>
        ),
        tags: ["check-in", "check-out", "timings"],
      },
      {
        id: "early-late",
        question: "Is early check-in / late check-out possible?",
        answer: (
          <p>
            We try our best. It depends on prior reservations and housekeeping schedules. Share your
            timing preference in advance so we can confirm feasibility.
          </p>
        ),
        tags: ["early", "late", "flexible"],
      },
      {
        id: "id-required",
        question: "What ID is required at check-in?",
        answer: (
          <p>
            A valid government-issued photo ID (passport, Aadhaar, or driver&apos;s license) is required
            for every guest staying overnight. Digital copies are accepted for pre-verification.
          </p>
        ),
        tags: ["id", "verification", "passport"],
      },
    ],
  },
  {
    id: "stay-amenities",
    title: "Stay & Amenities",
    description: "Know what&apos;s included during your stay and how to request extras.",
    items: [
      {
        id: "wifi",
        question: "Do you provide Wi-Fi?",
        answer: (
          <p>
            Yes, high-speed Wi-Fi is available in all apartments. Network details are shared before
            arrival or displayed inside the unit.
          </p>
        ),
        tags: ["wifi", "internet"],
      },
      {
        id: "parking",
        question: "Is parking available?",
        answer: (
          <p>
            Most buildings have limited parking slots. Please check the apartment listing or ask us on
            WhatsApp so we can reserve a spot where possible.
          </p>
        ),
        tags: ["parking", "car"],
      },
      {
        id: "kitchen",
        question: "Do the apartments have a kitchen / utensils?",
        answer: (
          <p>
            Many units include a stocked kitchenette with basic utensils. Amenities may vary by
            apartment, so review the listing details or confirm with our team before arrival.
          </p>
        ),
        tags: ["kitchen", "utensils", "cooking"],
      },
      {
        id: "power-backup",
        question: "Is there power backup / lift?",
        answer: (
          <p>
            Building amenities differ by location. Most premium units have lift access and backup
            power; please refer to the specific apartment page or message us for confirmation.
          </p>
        ),
        tags: ["power", "lift", "elevator"],
      },
    ],
  },
  {
    id: "corporate-longstays",
    title: "Corporate & Long Stays",
    description: "Support for business travel, invoicing, and extended bookings.",
    items: [
      {
        id: "gst-invoices",
        question: "Do you provide GST invoices?",
        answer: (
          <p>
            Yes, GST invoices can be issued for eligible stays. Share your GST details during booking
            so we can prepare the invoice correctly.
          </p>
        ),
        tags: ["gst", "invoice", "business"],
      },
      {
        id: "long-stay-discounts",
        question: "Do you offer monthly/long-stay discounts?",
        answer: (
          <p>
            We offer tiered pricing for multi-week and monthly bookings. Let us know your dates and
            we&apos;ll send a custom quote with available options.
          </p>
        ),
        tags: ["long stay", "monthly", "discount"],
      },
      {
        id: "corporate-bookings",
        question: "Can companies book for employees?",
        answer: (
          <p>
            Absolutely. We regularly host corporate travelers. Our team can coordinate recurring
            bookings, billing preferences, and check-in support for your employees.
          </p>
        ),
        tags: ["corporate", "employees", "company"],
      },
    ],
  },
];
