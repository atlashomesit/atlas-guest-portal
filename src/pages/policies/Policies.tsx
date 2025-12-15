import SEO from "../../components/SEO";
import "./policies.css";

const sections = [
  { id: "cancellation", title: "Cancellation Policy" },
  { id: "reschedule", title: "Reschedule Policy" },
  { id: "checkin", title: "Check-in & Check-out" },
  { id: "guests", title: "Guest & Occupancy" },
  { id: "house-rules", title: "House Rules" },
  { id: "damage", title: "Damage & Security" },
  { id: "amenities", title: "Amenities & Services" },
  { id: "payment", title: "Payment Terms" },
  { id: "id", title: "Identification & Verification" },
  { id: "liability", title: "Liability & Disclaimers" },
];

const Policies = () => {
  return (
    <div className="policies-page">
      <SEO
        title="Atlas Homestays Policies | atlashomestays.com"
        description="Review Atlas Homestays booking, cancellation, guest conduct, and house rules before your stay."
        url="https://atlashomestays.com/policies"
      />
      <header className="policies-hero">
        <div className="policies-hero__content">
          <p className="eyebrow">Atlas Homestays</p>
          <h1>Guest Policies & House Rules</h1>
          <p>
            Please review the policies below to understand booking terms, guest responsibilities, and
            how we safeguard your stay at Atlas Homestays.
          </p>
        </div>
      </header>

      <section className="policies-toc" aria-labelledby="toc-heading">
        <div className="policies-section__header">
          <h2 id="toc-heading">Table of Contents</h2>
          <p>Jump to the policy you want to review.</p>
        </div>
        <div className="toc-grid">
          {sections.map((section) => (
            <a key={section.id} className="toc-card" href={`#${section.id}`}>
              <span>{section.title}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="policies-sections">
        {sections.map((section) => (
          <article key={section.id} id={section.id} className="policy-block">
            <div className="policy-block__header">
              <p className="eyebrow">Policy</p>
              <h2>{section.title}</h2>
            </div>
            <div className="policy-block__content">
              <p>
                The full policy wording from the Atlas Homestays Policy document applies here. Please
                refer to the provided policy text for exact terms, including timelines, fees, and any
                exceptions that may apply.
              </p>
            </div>
            <a className="back-to-top" href="#toc-heading">
              Back to top
            </a>
          </article>
        ))}
      </section>

      <section className="policies-help">
        <div className="policies-help__content">
          <h3>Need clarification?</h3>
          <p>
            If you have questions about these policies, contact our team for guidance before confirming
            your stay. We are here to help ensure a smooth visit.
          </p>
          <div className="policies-help__actions">
            <a className="btn-primary" href="mailto:atlashomeskphb@gmail.com">Email Us</a>
            <a className="btn-secondary" href="tel:+917032493290">Call +91-7032493290</a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Policies;
