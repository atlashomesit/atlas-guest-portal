/* eslint-disable atlas-brand/no-atlas-string-leak -- baseline marketplace privacy notice; all platform emails/names are substituted at render time by PrivacyPage.tsx:legalizeText() before displaying to any tenant guest */
import { MARKETPLACE_BRAND_BASELINE } from "../../tenant/displayBrand";

// DPDPA 2023 notice content for the marketplace data fiduciary (see MARKETPLACE_BRAND_BASELINE).
//
// Sourced from:
//   - Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023) — Section 5 (Notice),
//     Sections 6 (Consent), 11 (Access), 12 (Correction & Erasure), 13 (Grievance), 14 (Nomination)
//     https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf
//   - Digital Personal Data Protection Rules, 2025 — Rule 3 (Notice given by Data Fiduciary)
//     https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa
//
// Rule 3 requires: (a) notice is understandable independently of other documents,
// (b) clear and plain language with an itemised description of personal data + specified purposes,
// (c) a communication link for withdrawal, rights exercise, and complaints to the Data Protection Board.
//
// TODO(CPO-001-followup): tenant-specific counsel review for white-label domains.
// IMPORTANT: This notice must be reviewed and signed off by the data fiduciary's Grievance Officer
// (legal counsel) before the first paying customer. Content below is drafted to meet the statutory
// minimum, not to serve as a substitute for legal review.

export type PrivacySection = {
  id: string;
  title: string;
  summary: string;
  details: string[];
};

export const privacyMetadata = {
  title: `Privacy Notice | ${MARKETPLACE_BRAND_BASELINE}`,
  effectiveDate: "Effective from April 22, 2026",
  dataFiduciary: MARKETPLACE_BRAND_BASELINE,
  grievanceOfficer: {
    name: "Sreekar Atla",
    email: "privacy@atlastays.com",
    phone: "+91-70324-93290",
  },
};

export const privacySections: PrivacySection[] = [
  {
    id: "about-this-notice",
    title: "About this notice",
    summary:
      `${MARKETPLACE_BRAND_BASELINE} is a Data Fiduciary under India's Digital Personal Data Protection Act, 2023 (DPDP Act). This notice explains what personal data we collect, why we collect it, and how you can exercise your rights.`,
    details: [
      "This notice is given to you under Section 5 of the DPDP Act, 2023 and Rule 3 of the DPDP Rules, 2025, at or before we process your personal data.",
      "It is written to be understood on its own. If any other document conflicts with this notice, the statutory rights under the DPDP Act prevail.",
      "We will give you a fresh notice if the purposes for which we process your personal data change in a way that affects your consent.",
      "On request, we will make this notice available in any of the 22 languages listed in the Eighth Schedule to the Constitution of India.",
    ],
  },
  {
    id: "personal-data-we-collect",
    title: "Personal data we collect (itemised)",
    summary:
      "We collect only the data needed to take, fulfil, and service your booking, and to comply with law. Each item below is matched to a specific purpose in the next section.",
    details: [
      "Identity: full name, date of birth (where required for ID verification), government-issued photo ID (Aadhaar, passport, driving licence, or voter ID) — required by Indian hospitality regulations.",
      "Contact: phone number, WhatsApp number, email address, postal address.",
      "Booking: check-in / check-out dates, property and unit selected, number of guests, guest names declared at booking, special requests.",
      "Payment: payment method, transaction ID, amount, last four digits of card / UPI handle (full card numbers are handled by our payment gateway Razorpay and never stored by us).",
      "Communications: messages you send us on WhatsApp, SMS, email, or in-portal chat; recordings of support calls when you are informed at the start of the call.",
      "Device & usage: IP address, device type, browser, pages visited, referring URL — collected via cookies and server logs to keep the site secure and to understand how it is used.",
      "Location: approximate city-level location derived from IP address; precise location only when you explicitly enable it in the booking flow.",
      "Reviews & photos: content you submit about your stay.",
    ],
  },
  {
    id: "purposes-of-processing",
    title: "Why we process your personal data",
    summary:
      "Each purpose below is paired with a lawful basis under the DPDP Act — either your consent (Section 6) or one of the 'legitimate uses' specified in Section 7.",
    details: [
      "Take and fulfil your booking, issue confirmations and invoices, and communicate with you about your stay — lawful basis: performance of a service you have requested (Section 7(a)).",
      "Verify your identity and comply with Indian hospitality, tax, and anti-money-laundering regulations — lawful basis: compliance with law (Section 7(b)).",
      "Process payments, refunds, and chargebacks through Razorpay — lawful basis: performance of service (Section 7(a)).",
      "Send transactional WhatsApp / SMS / email messages (booking confirmation, check-in instructions, check-out reminders, invoice, refund updates) — lawful basis: performance of service (Section 7(a)).",
      "Send non-transactional marketing messages (offers, new properties, seasonal updates) — lawful basis: your consent (Section 6). You can opt out at any time at /communication-preferences.",
      "Keep the site secure, detect fraud and abuse, and maintain audit logs — lawful basis: legitimate use (Section 7(h)).",
      "Respond to your complaints and grievances, and improve our service — lawful basis: performance of service and legitimate use.",
      "Analytics and aggregated reporting to improve the product — performed on de-identified data wherever possible; where identifiable, your consent applies.",
    ],
  },
  {
    id: "sharing-and-processors",
    title: "Who we share your personal data with",
    summary:
      "We share personal data only with Data Processors we have engaged under written contract to act on our instructions, and with authorities when required by law.",
    details: [
      "Razorpay Software Private Limited — payment processing. Razorpay is a RBI-regulated payment aggregator.",
      "Interakt (Haptik Inc.) — WhatsApp Business API provider for transactional and consented marketing messages.",
      "Microsoft Azure — cloud hosting (Azure App Service, Azure SQL) in the Central India region.",
      "Cloudflare, Inc. — content delivery and DDoS protection for our websites.",
      "Auth0 (Okta, Inc.) — identity provider for the admin portal (hosts, not guests).",
      "Online Travel Agencies (Airbnb, Booking.com, Vrbo, MakeMyTrip, Agoda) — only when you book through them and only the booking data necessary to fulfil your reservation.",
      "Government authorities, courts, and regulators — when we are required to share data by law (for example, police verification under local hospitality rules).",
      "We do not sell your personal data. We do not share it with advertising networks for profiling.",
    ],
  },
  {
    id: "cross-border-transfer",
    title: "Transfer of personal data outside India",
    summary:
      "Most of your personal data is stored on servers physically located in India (Microsoft Azure Central India). Some processors operate from other countries.",
    details: [
      "Primary database: Azure SQL, Central India region (Pune).",
      "All data is stored in India (Azure Central India). No secondary region backup is currently configured.",
      `Cloudflare and Auth0 operate global networks and may process request metadata outside India. They are bound by contractual data-protection terms with ${MARKETPLACE_BRAND_BASELINE}.`,
      "We do not transfer personal data to any country notified as restricted under Section 16 of the DPDP Act.",
    ],
  },
  {
    id: "retention",
    title: "How long we keep your personal data",
    summary:
      "We keep personal data only as long as the purpose it was collected for requires, or as long as Indian law requires — whichever is longer.",
    details: [
      "Booking and invoice records: 8 years from the end of the financial year in which the booking occurred, per Rule 6A of the Income-tax Rules, 1962 and the Central Goods and Services Tax Act, 2017.",
      "Guest identity documents: retained as long as the booking record is retained, stored with restricted access.",
      "Communication logs (WhatsApp / SMS / email): 2 years, then archived in aggregate form.",
      "Website cookies: session cookies expire at browser close; persistent cookies expire after 12 months unless you clear them sooner.",
      "After the retention period, personal data is either deleted or irreversibly anonymised.",
      "When you exercise your right to erasure (Section 12), we remove identifying fields immediately from active systems, retaining only the minimum required for legal, tax, and audit compliance.",
    ],
  },
  {
    id: "your-rights",
    title: "Your rights as a Data Principal",
    summary:
      "The DPDP Act gives you rights over your personal data. You can exercise any of them by writing to our Grievance Officer at privacy@atlastays.com.",
    details: [
      "Right to access (Section 11): ask for a summary of the personal data we hold about you and how we are processing it.",
      "Right to correction (Section 12): ask us to correct inaccurate or outdated data, or to complete incomplete data.",
      "Right to erasure (Section 12): ask us to delete your personal data. We will comply unless a specific law requires us to retain it — in which case we will tell you which law and for how long.",
      "Right to grievance redressal (Section 13): raise a complaint with our Grievance Officer. We will respond within 90 days.",
      "Right to nominate (Section 14): nominate another person to exercise these rights on your behalf in the event of your death or incapacity.",
      "Right to withdraw consent (Section 6(4)): withdraw consent at any time. Withdrawal will not affect lawfulness of processing before withdrawal, and some processing may continue under a different lawful basis (for example, tax-record retention).",
      "Withdrawing consent is as easy as giving it — use the 'Cookie & consent settings' link in the footer, or email privacy@atlastays.com.",
    ],
  },
  {
    id: "grievance-redressal",
    title: "Grievance Officer and how to complain",
    summary:
      "If you have any question or complaint about how we handle your personal data, contact our Grievance Officer first. You also have the right to complain to the Data Protection Board of India.",
    details: [
      `Grievance Officer: ${privacyMetadata.grievanceOfficer.name}`,
      `Email: ${privacyMetadata.grievanceOfficer.email}`,
      `Phone / WhatsApp: ${privacyMetadata.grievanceOfficer.phone}`,
      `Postal address: ${MARKETPLACE_BRAND_BASELINE}, Hyderabad, Telangana, India.`,
      "We will acknowledge complaints within 72 hours and resolve them within 90 days, as required by Section 13 of the DPDP Act.",
      "If you are not satisfied with our response, you can file a complaint with the Data Protection Board of India through the Board's official portal once it becomes operational. Guidance is at https://www.meity.gov.in/data-protection-framework.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies and similar technologies",
    summary:
      "We use cookies only after you have given consent, except for strictly necessary cookies needed to keep the site working.",
    details: [
      "Strictly necessary cookies: session cookies used to keep you logged in and to remember items in your booking cart. These cannot be disabled and do not require consent.",
      "Analytics cookies: we use first-party analytics to measure page performance. These are loaded only after you accept the cookie banner.",
      "Marketing cookies: we do not currently use third-party marketing or advertising cookies.",
      "You can accept or reject non-essential cookies on first visit, and change your choice any time from the 'Cookie & consent settings' link in the footer.",
      "Rejecting non-essential cookies does not block access to any public section of the website.",
    ],
  },
  {
    id: "children",
    title: "Children's personal data",
    summary:
      "We do not knowingly collect personal data from a child (a person under 18 years) without verifiable consent from a parent or lawful guardian.",
    details: [
      "Bookings must be made by an adult (18+). Child guest names and ages are collected only as part of a parent's booking record, with the parent's consent.",
      "We do not use children's personal data for tracking, profiling, or targeted advertising, as required by Section 9 of the DPDP Act.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this notice",
    summary:
      "If we change the purposes for which we process your personal data, we will issue a fresh notice and, where required, seek fresh consent.",
    details: [
      "This notice is versioned by its effective date (shown at the top). Material changes will be highlighted on the home page for 30 days after the change.",
      "Non-material changes (typos, wording improvements, added contact channels) may be made without notice.",
    ],
  },
];
