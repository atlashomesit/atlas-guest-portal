/* eslint-disable atlas-brand/no-atlas-string-leak -- TODO Task 16: replace with per-tenant content */
import { useMemo, useState } from "react";
import LegalLayout from "../components/legal/LegalLayout";
import LegalSearch from "../components/legal/LegalSearch";
import SectionNav from "../components/legal/SectionNav";
import SEO from "../components/SEO";
import { faqItems } from "../content/legal/faqs";
import { policySections } from "../content/legal/policies";
import { termsSections } from "../content/legal/terms";
import { useScrollToHash } from "../hooks/useScrollToHash";
import { CONTACT } from "../config/contact";
import { buildWaLink, defaultPrefill } from "../utils/whatsapp";
import FaqHighlights from "../components/faq/FaqHighlights";
import { getFaqHighlights } from "../content/faqHighlights";
import { getTenantBrandName } from "../tenant/displayBrand";

const FaqPage = () => {
  const brandName = getTenantBrandName();
  useScrollToHash();
  const [search, setSearch] = useState("");
  const whatsappLink = useMemo(() => {
    const href = typeof window !== "undefined" ? window.location.href : "";
    const prefill = defaultPrefill({ href, context: "FAQs", brandName });
    return buildWaLink({ phoneE164: CONTACT.business.whatsapp, text: prefill });
  }, [brandName]);

  const grouped = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? faqItems.filter((item) =>
          `${item.question} ${item.answer} ${(item.tags || []).join(" ")}`
            .toLowerCase()
            .includes(query)
        )
      : faqItems;

    const byCategory = filtered.reduce<Record<string, typeof filtered>>((acc, item) => {
      acc[item.category] = acc[item.category] ? [...acc[item.category], item] : [item];
      return acc;
    }, {});

    return Object.entries(byCategory).map(([category, items]) => ({ category, items }));
  }, [search]);

  const sectionNav = grouped.map(({ category }) => ({ id: category.toLowerCase().replace(/\s+/g, "-"), label: category }));

  const faqHighlights = getFaqHighlights();
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqHighlights.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  } as const;

  const resolveTitle = (link: { type: "policy" | "terms"; id: string }) => {
    if (link.type === "policy") {
      return policySections.find((p) => p.id === link.id)?.title ?? link.id;
    }
    return termsSections.find((t) => t.id === link.id)?.title ?? link.id;
  };

  return (
    <LegalLayout
      current="faq"
      title="Frequently Asked Questions"
      description="Quick answers that link directly to the underlying policy and terms sections."
    >
      <SEO
        title={`FAQs | ${brandName}`}
        description="Common questions about bookings, payments, check-in, guests, amenities, and deposits."
        url="/faq"
        jsonLd={faqStructuredData}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <SectionNav sections={sectionNav} />

        <div className="space-y-6">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-level1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <LegalSearch value={search} onChange={setSearch} placeholder="Search FAQs" />
              <div className="bg-[color:color-mix(in_srgb,var(--accent-soft)_65%,var(--bg-surface))] text-text-primary border border-border-subtle rounded-xl p-4 text-sm">
                <p className="font-semibold">If anything here conflicts with Terms, the Terms apply.</p>
              </div>
            </div>
          </div>

          <FaqHighlights />

          <div className="space-y-6">
            {grouped.map(({ category, items }) => (
              <section
                key={category}
                id={category.toLowerCase().replace(/\s+/g, "-")}
                className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-level1 space-y-4"
              >
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-text-primary">{category}</h2>
                  <p className="text-sm text-text-muted">Search within this category or expand answers below.</p>
                </div>

                <div className="divide-y divide-border-subtle">
                  {items.map((item) => (
                    <details key={item.id} className="py-3 group" id={item.id} open>
                      <summary className="flex items-center justify-between cursor-pointer">
                        <h3 className="text-lg font-semibold text-text-primary">{item.question}</h3>
                        <span className="text-primary text-sm">Toggle</span>
                      </summary>
                      <div className="mt-2 space-y-2 text-text-primary">
                        <p>{item.answer}</p>
                        <div className="flex flex-wrap gap-2">
                          {item.linksTo.map((link) => (
                            <a
                              key={`${item.id}-${link.id}`}
                              className="text-xs uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-bg-muted text-primary font-semibold"
                              href={`/${link.type === "policy" ? "policies" : "terms"}#${link.id}`}
                            >
                              Related: {link.type === "policy" ? "Policy" : "Terms"} – {resolveTitle(link)}
                            </a>
                          ))}
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}

            {grouped.length === 0 && (
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 text-text-muted shadow-level1">
                No FAQs match your search yet. Try a different keyword.
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-primary/90 to-primary text-[var(--text-contrast)] rounded-2xl p-6 shadow-level2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Need help?</h3>
                <p className="text-[color-mix(in_srgb,var(--text-contrast)_90%,transparent)]">Message us with your question and we will direct you to the right section.</p>
              </div>
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
    </LegalLayout>
  );
};

export default FaqPage;
