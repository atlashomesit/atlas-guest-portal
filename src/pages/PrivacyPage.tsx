/* eslint-disable atlas-brand/no-atlas-string-leak -- baseline notice substitutes tenant brand at render time */
import { useMemo, useState } from "react";
import LegalLayout from "../components/legal/LegalLayout";
import LegalSearch from "../components/legal/LegalSearch";
import SectionNav from "../components/legal/SectionNav";
import SEO from "../components/SEO";
import { privacyMetadata, privacySections } from "../content/legal/privacy";
import { CONTACT } from "../config/contact";
import { buildWaLink, defaultPrefill } from "../utils/whatsapp";
import { resetCookieConsent } from "../utils/cookieConsent";
import { MARKETPLACE_BRAND_BASELINE } from "../tenant/displayBrand";
import { getTenantContext } from "../tenant/tenantContext";

/**
 * RA-006 §3.5: substitute the baseline notice's marketplace brand / "atlashomestays.com" /
 * "privacy@atlashomestays.com" tokens with the active tenant's legal pack values.
 * The atlas marketplace tenant keeps the canonical baseline so apex visitors still see Atlas copy.
 */
const legalizeText = (
  source: string,
  pack: { legalName: string; contactEmail: string; shareDomain: string },
): string =>
  source
    .replaceAll(MARKETPLACE_BRAND_BASELINE, pack.legalName)
    .replace(/privacy@atlashomestays\.com/g, pack.contactEmail)
    .replace(/privacy@atlastays\.com/g, pack.contactEmail)
    .replace(/atlashomestays\.com/g, pack.shareDomain)
    .replace(/atlastays\.com/g, pack.shareDomain);

const PrivacyPage = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [revoked, setRevoked] = useState(false);

  // Build the active legal pack from server-provided values, falling back to the
  // Baseline notice names MARKETPLACE_BRAND_BASELINE. Empty/missing fields can't be
  // substituted in — we keep the baseline string so guests don't see a blank.
  const tenant = getTenantContext();
  const pack = useMemo(() => {
    const lp = tenant?.legalContactPack;
    return {
      legalName: lp?.legalName?.trim() || privacyMetadata.dataFiduciary,
      contactEmail: lp?.contactEmail?.trim() || privacyMetadata.grievanceOfficer.email,
      shareDomain: (lp?.legalName ? `${lp.legalName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com` : 'atlashomestays.com'),
      grievanceName: privacyMetadata.grievanceOfficer.name, // not yet on the server pack
      grievancePhone: lp?.contactPhone?.trim() || privacyMetadata.grievanceOfficer.phone,
    };
  }, [tenant]);
  const legalize = (s: string) => legalizeText(s, pack);
  const tenantTitle = `Privacy Notice | ${pack.legalName}`;

  const whatsappLink = useMemo(() => {
    const href = typeof window !== "undefined" ? window.location.href : "";
    const prefill = defaultPrefill({ href, context: "Privacy", brandName: pack.legalName });
    return buildWaLink({ phoneE164: CONTACT.business.whatsapp, text: prefill });
  }, [pack.legalName]);

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
      title={tenantTitle}
      description="How we collect, use, store, and share your personal data — and the rights you have under India's Digital Personal Data Protection Act, 2023."
      lastUpdated={privacyMetadata.effectiveDate}
    >
      <SEO
        title={tenantTitle}
        description={`${pack.legalName} DPDPA 2023 privacy notice: what data we collect, why, and how to exercise your rights as a Data Principal.`}
        url="/privacy"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <SectionNav sections={sectionNav} />

        <div className="space-y-6">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-level1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <LegalSearch value={search} onChange={setSearch} placeholder="Search privacy notice" />
              <div className="bg-[color:color-mix(in_srgb,var(--accent-soft)_65%,var(--bg-surface))] text-text-primary border border-border-subtle rounded-xl p-4 text-sm">
                <p className="font-semibold">Data Fiduciary: {pack.legalName}</p>
                <p>Grievance Officer: {pack.grievanceName} ({pack.contactEmail})</p>
              </div>
            </div>
          </div>

          <section
            id="dpdp-at-a-glance"
            className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-level1 space-y-8"
            aria-labelledby="dpdp-glance-heading"
          >
            <div>
              <h2 id="dpdp-glance-heading" className="text-xl font-bold text-text-primary">
                Digital Personal Data Protection Act, 2023 (DPDP) — summary
              </h2>
              <p className="text-text-muted text-sm mt-2">
                The sections below highlight how {pack.legalName} meets core DPDP notice expectations. For full detail,
                expand the topic areas further down this page or jump to the linked sections.
              </p>
            </div>

            <div id="dpdp-lawful-purposes" className="space-y-2">
              <h3 className="text-lg font-semibold text-text-primary">Lawful purposes</h3>
              <p className="text-text-primary text-sm leading-relaxed">
                We process your personal data only for specified purposes and on a lawful basis under the DPDP Act.
                Where we rely on your consent (for example, non-essential cookies or marketing messages), you may
                withdraw it at any time without affecting the lawfulness of earlier processing. Where the Act permits
                processing without consent—such as taking steps at your request before a booking, performing a
                contract, complying with Indian law, or protecting safety and security—we limit use to what is
                necessary for that purpose. A fuller itemised list of data categories and purposes appears under{" "}
                <a className="text-primary font-semibold underline" href="#purposes-of-processing">
                  Why we process your personal data
                </a>
                .
              </p>
            </div>

            <div id="dpdp-retention" className="space-y-2">
              <h3 className="text-lg font-semibold text-text-primary">Retention period</h3>
              <p className="text-text-primary text-sm leading-relaxed">
                We retain personal data only as long as needed for the purpose collected or as required by applicable
                Indian law, whichever is longer. In practice, booking and tax-related records are kept for the period
                described under{" "}
                <a className="text-primary font-semibold underline" href="#retention">
                  How long we keep your personal data
                </a>{" "}
                (including GST and income-tax record-keeping). Communications logs and cookie lifetimes are shorter.
                When retention ends, we delete or irreversibly de-identify data except where a narrow legal carve-out
                applies, and we explain that to you if you ask.
              </p>
            </div>

            <div id="dpdp-rights" className="space-y-2">
              <h3 className="text-lg font-semibold text-text-primary">
                Your rights — access, correction, erasure, and withdrawal of consent
              </h3>
              <p className="text-text-primary text-sm leading-relaxed">
                As a Data Principal you may request access to a summary of your personal data and information about how
                it is processed; request correction of inaccurate or incomplete data; request erasure where the Act
                allows (we will retain minimum fields where statute requires, and tell you why); and withdraw consent
                where processing is consent-based—including cookie preferences via the footer link or the reset control
                on this page. You may also nominate another person to exercise certain rights on your behalf as
                permitted under the Act. Step-by-step guidance is under{" "}
                <a className="text-primary font-semibold underline" href="#your-rights">
                  Your rights as a Data Principal
                </a>
                .
              </p>
            </div>

            <div id="dpdp-grievance" className="space-y-2">
              <h3 className="text-lg font-semibold text-text-primary">Grievance contact</h3>
              <p className="text-text-primary text-sm leading-relaxed">
                Questions or complaints about personal data should first go to our Grievance Officer at{" "}
                <a className="text-primary font-semibold underline" href={`mailto:${pack.contactEmail}`}>
                  {pack.contactEmail}
                </a>{" "}
                (phone / WhatsApp: {pack.grievancePhone}). We acknowledge grievances promptly and work to resolve them
                within the timelines set out under{" "}
                <a className="text-primary font-semibold underline" href="#grievance-redressal">
                  Grievance Officer and how to complain
                </a>
                . If you remain dissatisfied after our response, you may escalate to the Data Protection Board of India
                when its complaint channel is available.
              </p>
            </div>
          </section>

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
                    <h2 className="text-2xl font-bold text-text-primary">{legalize(section.title)}</h2>
                    <p className="text-text-muted mt-1">{legalize(section.summary)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(section.id)}
                    className="min-h-11 text-base font-semibold px-4 py-3 rounded-full border border-border-subtle hover:border-cta-primary text-primary self-start"
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
                        <li key={idx}>{legalize(detail)}</li>
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
                  href={`mailto:${pack.contactEmail}`}
                  aria-label={`Email ${pack.legalName} Grievance Officer at ${pack.contactEmail}`}
                  className="inline-flex min-h-11 items-center gap-2 px-4 py-3 bg-bg-surface text-primary font-semibold rounded-xl shadow-level1 hover:shadow-level2"
                >
                  Email Grievance Officer
                </a>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Contact ${pack.legalName} on WhatsApp`}
                  className="inline-flex min-h-11 items-center gap-2 px-4 py-3 bg-bg-surface text-primary font-semibold rounded-xl shadow-level1 hover:shadow-level2"
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
