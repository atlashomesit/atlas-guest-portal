import { useMemo, useState } from "react";
import SEO from "../components/SEO";
import "./policies.css";

interface PolicySection {
  id: string;
  title: string;
  body: JSX.Element;
}

const Policies = () => {
  const sections: PolicySection[] = useMemo(
    () => [
      {
        id: "cancellation-refund-policy",
        title: "Cancellation & Refund Policy",
        body: (
          <div className="policy-body">
            <p>
              We understand plans can change. To keep things fair for guests and our team, the following timelines and
              charges apply:
            </p>
            <ul>
              <li><strong>Free cancellation</strong>: 100% refund for cancellations received more than 15 days before check-in.</li>
              <li>
                <strong>Partial refund</strong>: 50% refund for cancellations received 7–15 days before check-in. The remainder
                is retained to cover committed housekeeping and scheduling costs.
              </li>
              <li>
                <strong>No refund</strong>: Cancellations within 7 days of arrival are non-refundable due to last-minute
                occupancy loss.
              </li>
              <li>
                <strong>Early departures & no-shows</strong>: Treated as same-day cancellations and are non-refundable once the
                booking start date has begun.
              </li>
            </ul>
            <p>
              Refunds (when applicable) are processed to the original payment method within 7–10 business days after a
              written request is acknowledged by our team.
            </p>
          </div>
        ),
      },
      {
        id: "reschedule-date-change-policy",
        title: "Reschedule / Date Change Policy",
        body: (
          <div className="policy-body">
            <p>We accommodate reasonable date changes based on availability.</p>
            <ul>
              <li><strong>15+ days before arrival</strong>: One complimentary date change within 90 days of the original check-in.</li>
              <li>
                <strong>7–15 days before arrival</strong>: Date changes allowed with a reschedule fee equal to 25% of the
                booking value.
              </li>
              <li>
                <strong>Within 7 days</strong>: Date changes are treated as cancellations. A new booking will be required for the
                revised dates.
              </li>
              <li>
                <strong>Tariff differences</strong>: If your new dates fall on higher tariff periods (weekends/holidays), the rate
                difference applies. Lower tariffs do not receive credits or refunds.
              </li>
            </ul>
            <p>All reschedule requests must be made in writing (email/WhatsApp) by the primary guest on the reservation.</p>
          </div>
        ),
      },
      {
        id: "check-in-check-out-policy",
        title: "Check-In & Check-Out Policy",
        body: (
          <div className="policy-body">
            <ul>
              <li><strong>Standard check-in</strong>: 2:00 PM | <strong>Standard check-out</strong>: 11:00 AM.</li>
              <li>
                <strong>Early check-in / late check-out</strong>: Subject to availability and may incur a half-day charge. Please
                request in advance so we can accommodate you.
              </li>
              <li>
                <strong>Self check-in</strong>: Government ID verification is required before we share digital access codes or keys.
              </li>
              <li>
                <strong>Key handling</strong>: Lost keys/fobs will be charged at actual replacement cost plus service fees if
                applicable.
              </li>
            </ul>
            <p>Please respect the stated times to allow housekeeping to prepare the apartment for the next guest.</p>
          </div>
        ),
      },
      {
        id: "extra-guests-visitors-policy",
        title: "Extra Guests & Visitors Policy",
        body: (
          <div className="policy-body">
            <ul>
              <li>
                <strong>Registered guests only</strong>: The booking covers the guests declared at reservation. All guests must
                submit valid government ID prior to arrival.
              </li>
              <li>
                <strong>Additional guests</strong>: Subject to approval and additional charges. Unregistered overnight stays are
                not permitted and may result in cancellation without refund.
              </li>
              <li>
                <strong>Visitors</strong>: Day visitors are allowed between 10:00 AM and 8:00 PM with prior notice. Visitors must
                follow house rules and may be asked to present ID.
              </li>
              <li>
                <strong>Parties & events</strong>: Gatherings, loud music, and parties are strictly prohibited unless expressly
                approved in writing.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: "house-rules",
        title: "House Rules",
        body: (
          <div className="policy-body">
            <ul>
              <li>No smoking or vaping inside the apartment. Use designated outdoor areas only.</li>
              <li>Maintain quiet hours between 10:00 PM and 7:00 AM out of respect for neighbors.</li>
              <li>Use furniture, appliances, and linens responsibly. Do not move heavy furniture.</li>
              <li>No illegal substances, contraband, or commercial activities on the premises.</li>
              <li>Pets are allowed only in units marked pet-friendly and must be declared at booking.</li>
              <li>Dispose of garbage in designated bins; avoid food waste in sinks to prevent blockages.</li>
            </ul>
            <p>Violation of house rules can lead to penalties, immediate eviction, and forfeiture of the security deposit.</p>
          </div>
        ),
      },
      {
        id: "damage-penalties-security-deposit",
        title: "Damage, Penalties & Security Deposit",
        body: (
          <div className="policy-body">
            <p>
              We expect normal wear and tear, but any avoidable damage or policy breach will be chargeable. A security deposit
              may be collected for select bookings or long stays.
            </p>
            <ul>
              <li>
                <strong>Security deposit use</strong>: Covers breakage, deep cleaning, missing items, or rule violations. Itemized
                deductions will be shared when applicable.
              </li>
              <li>
                <strong>Excessive cleaning</strong>: Stains on linens, upholstery, or walls, and littering common areas may incur
                additional cleaning fees.
              </li>
              <li>
                <strong>Facility misuse</strong>: Tampering with fire safety devices, unauthorized rewiring, or misuse of
                appliances will attract penalties and repair costs.
              </li>
              <li>
                <strong>Settlement timeline</strong>: Refundable deposits (if any) are returned within 7 business days after
                post-check-out inspection.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: "amenity-usage-policy-jacuzzi-home-theater-lift-parking",
        title: "Amenity Usage Policy (Jacuzzi / Home Theater / Lift / Parking)",
        body: (
          <div className="policy-body">
            <ul>
              <li>
                <strong>Jacuzzi</strong>: Shower before use. Oils, bath salts, or dyes are not permitted. Please switch off
                controls after use and observe posted time limits.
              </li>
              <li>
                <strong>Home theater</strong>: Keep volume at community-friendly levels. Do not alter wiring or mount additional
                devices without permission.
              </li>
              <li>
                <strong>Elevators</strong>: Follow weight limits and keep doors clear. Children must be accompanied by an adult at
                all times.
              </li>
              <li>
                <strong>Parking</strong>: Park only in the allotted slot. Improper parking or obstruction of common driveways may
                lead to towing at the vehicle owner’s cost.
              </li>
            </ul>
            <p>
              Report any malfunction immediately so we can arrange assistance. Some amenities may be temporarily unavailable for
              maintenance or building guidelines.
            </p>
          </div>
        ),
      },
      {
        id: "payment-terms",
        title: "Payment Terms",
        body: (
          <div className="policy-body">
            <ul>
              <li><strong>Booking confirmation</strong>: Reservations are confirmed only after receipt of the advance payment noted on the invoice.</li>
              <li><strong>Balance payment</strong>: Payable before check-in. Access instructions are shared after balance settlement and ID verification.</li>
              <li><strong>Accepted modes</strong>: UPI, major credit/debit cards, and bank transfers. Cash is accepted where legally permitted.</li>
              <li>
                <strong>Taxes & fees</strong>: GST and applicable platform/processing fees apply. Currency conversions may be
                handled by your bank or card issuer.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: "id-verification-local-law-compliance",
        title: "ID Verification & Local Law Compliance",
        body: (
          <div className="policy-body">
            <ul>
              <li>
                All adult guests must submit valid government-issued photo ID (Aadhaar/Passport/Driver’s License) prior to
                arrival as mandated by local regulations.
              </li>
              <li>
                Foreign nationals must present a valid passport with visa. We comply with all police/intimation requirements
                where applicable.
              </li>
              <li>
                The lead guest is responsible for ensuring all accompanying guests provide accurate details for building and
                security records.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: "liability-disclaimer",
        title: "Liability & Disclaimer",
        body: (
          <div className="policy-body">
            <ul>
              <li>
                Atlas Homestays is not liable for loss of personal belongings, valuables, or cash. Use provided lockers or keep
                valuables with you.
              </li>
              <li>
                Guests are responsible for their own safety and must follow building and house safety instructions at all times.
              </li>
              <li>
                Service interruptions (power/water/common amenities) due to municipal or association controls are beyond our
                direct control, though we will coordinate prompt resolution.
              </li>
              <li>
                Booking a stay indicates acceptance of these policies and agreement to cooperate with reasonable requests from
                our staff and building management.
              </li>
            </ul>
          </div>
        ),
      },
    ],
    []
  );

  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(sections.map((section) => section.id))
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => setOpenSections(new Set(sections.map((s) => s.id)));
  const collapseAll = () => setOpenSections(new Set());

  return (
    <div className="policies-shell">
      <SEO
        title="ATLAS HOMESTAYS – POLICIES"
        description="Hyderabad Homestay Policies – Atlas Homestays Rules, Cancellation Policy Hyderabad Homestay, refund and house rules guidance."
        url="https://atlashomestays.com/policies"
      />

      <header className="policies-hero">
        <div className="policies-hero__content">
          <p className="eyebrow">Atlas Homestays</p>
          <h1>ATLAS HOMESTAYS – POLICIES</h1>
          <p className="lead">
            Please review these policies before confirming your stay. They outline booking terms, cancellations, guest conduct,
            and amenity guidelines for our Hyderabad homestays.
          </p>
          <div className="policies-actions">
            <button type="button" className="pill" onClick={expandAll} aria-label="Expand all policy sections">
              Expand all
            </button>
            <button type="button" className="pill" onClick={collapseAll} aria-label="Collapse all policy sections">
              Collapse all
            </button>
          </div>
        </div>
      </header>

      <section className="policies-toc" aria-labelledby="toc-heading">
        <div className="section-heading">
          <h2 id="toc-heading">Table of Contents</h2>
          <p className="muted">Jump to a specific policy section.</p>
        </div>
        <nav className="toc-grid" aria-label="Policies table of contents">
          {sections.map((section) => (
            <a key={section.id} className="toc-card" href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
        </nav>
      </section>

      <section className="policies-content" aria-label="Policy details">
        {sections.map((section) => (
          <article key={section.id} id={section.id} className="policy-section">
            <header className="policy-header">
              <div>
                <p className="eyebrow">Policy</p>
                <h2>{section.title}</h2>
              </div>
              <button
                type="button"
                className="pill"
                onClick={() => toggleSection(section.id)}
                aria-expanded={openSections.has(section.id)}
                aria-controls={`${section.id}-content`}
              >
                {openSections.has(section.id) ? "Collapse" : "Expand"}
              </button>
            </header>

            {openSections.has(section.id) && (
              <div id={`${section.id}-content`} className="policy-copy">
                {section.body}
              </div>
            )}

            <a className="back-to-top" href="#toc-heading">
              Back to top
            </a>
          </article>
        ))}
      </section>
    </div>
  );
};

export default Policies;
