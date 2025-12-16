import SEO from "../components/SEO";
import { inlinePolicySnippets, paymentDataSharingNote, termsMetadata, termsSections } from "../content/terms";
import "./terms.css";

const Terms = () => {
  const anchorLinks = termsSections.map((section) => ({
    href: `#${section.id}`,
    label: `${section.number}. ${section.title}`,
  }));

  return (
    <div className="terms-shell">
      <SEO
        title={termsMetadata.title}
        description="Review Atlas Homestays booking terms, check-in rules, cancellations, damages, and guest responsibilities."
        url="/terms"
      />

      <header className="terms-hero">
        <div className="terms-hero__content">
          <p className="eyebrow">Atlas Homestays</p>
          <h1>{termsMetadata.title}</h1>
          <p className="lead">
            Please review these Terms & Conditions before reserving your stay. They summarize booking and payment rules,
            guest requirements, cancellation timelines, house expectations, and safety standards.
          </p>
          <p className="last-updated">{termsMetadata.lastUpdated}</p>
        </div>
      </header>

      <section className="terms-toc" aria-labelledby="toc-heading">
        <div className="section-heading">
          <h2 id="toc-heading">Quick navigation</h2>
          <p className="muted">Jump to any section or skim the key policies below.</p>
        </div>
        <nav className="toc-grid" aria-label="Terms table of contents">
          {anchorLinks.map((item) => (
            <a key={item.href} className="toc-card" href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </section>

      <section className="inline-highlights" aria-label="Key policy highlights">
        <div className="highlight-card">
          <p className="eyebrow">Guest verification</p>
          <p>{inlinePolicySnippets.guestId}</p>
        </div>
        <div className="highlight-card">
          <p className="eyebrow">Cancellation</p>
          <p>{inlinePolicySnippets.cancellation}</p>
        </div>
        <div className="highlight-card">
          <p className="eyebrow">House rules</p>
          <p>{inlinePolicySnippets.houseRules}</p>
        </div>
        <div className="highlight-card">
          <p className="eyebrow">Damages</p>
          <p>{inlinePolicySnippets.damages}</p>
        </div>
      </section>

      <section className="terms-content" aria-label="Terms & Conditions content">
        {termsSections.map((section) => (
          <article key={section.id} id={section.id} className="terms-section">
            <header className="terms-section__header">
              <div>
                <p className="eyebrow">Section {section.number}</p>
                <h2>
                  {section.number}. {section.title}
                </h2>
              </div>
              <a className="back-to-top" href="#toc-heading">
                Back to top
              </a>
            </header>

            <div className="terms-section__body">
              {section.paragraphs?.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}

              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="consent-note" aria-label="Payment data sharing">
        <p className="eyebrow">Payment data sharing</p>
        <p>{paymentDataSharingNote}</p>
      </section>
    </div>
  );
};

export default Terms;
