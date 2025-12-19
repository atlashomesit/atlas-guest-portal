import { useMemo, useState } from "react";
import LegalLayout from "../components/legal/LegalLayout";
import LegalSearch from "../components/legal/LegalSearch";
import SectionNav from "../components/legal/SectionNav";
import SEO from "../components/SEO";
import { policyMetadata, policySections } from "../content/legal/policies";
import { termsSections } from "../content/legal/terms";
import { CONTACT } from "../config/contact";
import { buildWaLink, defaultPrefill } from "../utils/whatsapp";

const Policies = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const whatsappLink = useMemo(() => {
    const href = typeof window !== "undefined" ? window.location.href : "";
    const prefill = defaultPrefill({ href, context: "Policies" });
    return buildWaLink({ phoneE164: CONTACT.business.whatsapp, text: prefill });
  }, []);

  const filteredPolicies = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return policySections;

    return policySections.filter((section) => {
      const haystack = `${section.title} ${section.summary} ${section.details.join(" ")}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [search]);

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const sectionNav = filteredPolicies.map((section) => ({ id: section.id, label: section.title }));

  return (
    <LegalLayout
      current="policies"
      title={policyMetadata.title}
      description="Practical rules for bookings, arrivals, conduct, and how we keep stays predictable."
      lastUpdated={policyMetadata.effectiveDate}
    >
      <SEO
        title={policyMetadata.title}
        description="Atlas Homestays guest policies covering booking rules, cancellations, conduct, and amenity usage."
        url="/policies"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <SectionNav sections={sectionNav} />

        <div className="space-y-6">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-level1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <LegalSearch value={search} onChange={setSearch} placeholder="Search policies" />
              <div className="bg-[color:color-mix(in_srgb,var(--accent-soft)_65%,var(--bg-surface))] text-text-primary border border-border-subtle rounded-xl p-4 text-sm">
                <p className="font-semibold">If anything here conflicts with Terms, the Terms apply.</p>
                <p>Policies summarise how we operationalise the Terms for guests.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredPolicies.map((section) => (
              <article
                key={section.id}
                id={section.id}
                className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-level1"
              >
                <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-primary">Policy</p>
                    <h2 className="text-2xl font-bold text-text-primary">{section.title}</h2>
                    <p className="text-text-muted mt-1">{section.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {section.termsRefs.map((ref) => {
                      const term = termsSections.find((t) => t.id === ref);
                      return (
                        <a
                          key={ref}
                          className="text-sm px-3 py-1 rounded-full bg-bg-muted text-primary font-semibold hover:bg-primary/10"
                          href={`/terms#${ref}`}
                        >
                          Terms: {term?.title || ref}
                        </a>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => toggle(section.id)}
                      className="text-sm font-semibold px-3 py-2 rounded-full border border-border-subtle hover:border-cta-primary text-primary"
                      aria-expanded={open.has(section.id)}
                      aria-controls={`${section.id}-details`}
                    >
                      {open.has(section.id) ? "Hide details" : "Read details"}
                    </button>
                  </div>
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

            {filteredPolicies.length === 0 && (
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 text-text-muted shadow-level1">
                No policies match your search yet. Try a different keyword.
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-primary/90 to-primary text-[var(--text-contrast)] rounded-2xl p-6 shadow-level2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Need help?</h3>
                <p className="text-[color-mix(in_srgb,var(--text-contrast)_90%,transparent)]">Chat with us for clarifications before you book.</p>
              </div>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-bg-surface text-primary font-semibold rounded-xl shadow-level1 hover:shadow-level2"
              >
                Message on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </LegalLayout>
  );
};

export default Policies;
