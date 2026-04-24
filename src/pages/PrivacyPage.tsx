import { useMemo, useState } from "react";
import LegalLayout from "../components/legal/LegalLayout";
import LegalSearch from "../components/legal/LegalSearch";
import SectionNav from "../components/legal/SectionNav";
import SEO from "../components/SEO";
import { privacyMetadata, privacySections } from "../content/legal/privacy";
import { CONTACT } from "../config/contact";
import { buildWaLink, defaultPrefill } from "../utils/whatsapp";
import { resetCookieConsent } from "../utils/cookieConsent";

const PrivacyPage = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [revoked, setRevoked] = useState(false);

  const whatsappLink = useMemo(() => {
    const href = typeof window !== "undefined" ? window.location.href : "";
    const prefill = defaultPrefill({ href, context: "Privacy" });
    return buildWaLink({ phoneE164: CONTACT.business.whatsapp, text: prefill });
  }, []);

  const filteredSections = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return privacySections;
    return privacySections.filter((section) => {
      const haystack = `${section.title} ${section.summary} ${section.details.join(" ")}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [search]);

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRevokeConsent = () => {
    resetCookieConsent();
    setRevoked(true);
    setTimeout(() => setRevoked(false), 4000);
  };

  const sectionNav = filteredSections.map((section) => ({ id: section.id, label: section.title }));

  return (
    <LegalLayout
      current="privacy"
      title={privacyMetadata.title}
      description="How we collect, use, store, and share your personal data — and the rights you have under India's Digital Personal Data Protection Act, 2023."
      lastUpdated={privacyMetadata.effectiveDate}
    >
      <SEO
        title={privacyMetadata.title}
        description="Atlas Homestays DPDPA 2023 privacy notice: what data we collect, why, and how to exercise your rights as a Data Principal."
        url="/privacy"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <SectionNav sections={sectionNav} />

        <div className="space-y-6">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-level1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <LegalSearch value={search} onChange={setSearch} placeholder="Search privacy notice" />
              <div className="bg-[color:color-mix(in_srgb,var(--accent-soft)_65%,var(--bg-surface))] text-text-primary border border-border-subtle rounded-xl p-4 text-sm">
                <p className="font-semibold">Data Fiduciary: {privacyMetadata.dataFiduciary}</p>
                <p>Grievance Officer: {privacyMetadata.grievanceOfficer.name} ({privacyMetadata.grievanceOfficer.email})</p>
              </div>
            </div>
          </div>

          <section
            id="cookie-consent-revocation"
            className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-level1 space-y-3"
          >
            <h2 className="text-xl font-bold text-text-primary">Cookie &amp; consent settings</h2>
            <p className="text-text-muted text-sm">
              Under Rule 3 of the DPDP Rules 2025 and Section 6(4) of the DPDP Act, withdrawing consent must be as
              easy as giving it. Click the button below to reset your cookie consent. The banner will reappear on
              your next page load so you can choose again.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleRevokeConsent}
                className="px-4 py-3 bg-primary text-[var(--text-contrast)] font-semibold rounded-xl shadow-level1 hover:shadow-level2"
              >
                Reset my cookie consent
              </button>
              {revoked && (
                <span className="text-sm text-primary font-semibold" role="status" aria-live="polite">
                  Consent reset. Refresh the page to see the banner again.
                </span>
              )}
            </div>
          </section>

          <div className="space-y-4">
            {filteredSections.map((section) => (
              <article
                key={section.id}
                id={section.id}
                className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-level1"
              >
                <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-primary">Privacy</p>
                    <h2 className="text-2xl font-bold text-text-primary">{section.title}</h2>
                    <p className="text-text-muted mt-1">{section.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(section.id)}
                    className="text-sm font-semibold px-3 py-2 rounded-full border border-border-subtle hover:border-cta-primary text-primary self-start"
                    aria-expanded={open.has(section.id)}
                    aria-controls={`${section.id}-details`}
                  >
                    {open.has(section.id) ? "Hide details" : "Read details"}
                  </button>
                </header>

                {open.has(section.id) && (
                  <div id={`${section.id}-details`} className="mt-4 space-y-3 text-text-primary">
                    <ul className="list-disc pl-5 space-y-2">
                      {section.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}

            {filteredSections.length === 0 && (
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 text-text-muted shadow-level1">
                No sections match your search. Try a different keyword.
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-primary/90 to-primary text-[var(--text-contrast)] rounded-2xl p-6 shadow-level2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Have a privacy question?</h3>
                <p className="text-[color-mix(in_srgb,var(--text-contrast)_90%,transparent)]">
                  Contact our Grievance Officer — we respond within 72 hours.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`mailto:${privacyMetadata.grievanceOfficer.email}`}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-bg-surface text-primary font-semibold rounded-xl shadow-level1 hover:shadow-level2"
                >
                  Email Grievance Officer
                </a>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 bg-bg-surface text-primary font-semibold rounded-xl shadow-level1 hover:shadow-level2"
                >
                  Message on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LegalLayout>
  );
};

export default PrivacyPage;
