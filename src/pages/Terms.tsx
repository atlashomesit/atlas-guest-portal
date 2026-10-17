import { useEffect, useMemo, useState } from "react";
import "./Terms.css";
import LegalLayout from "../components/legal/LegalLayout";
import SectionNav from "../components/legal/SectionNav";
import SEO from "../components/SEO";
import { paymentDataSharingNote, termsMetadata, termsSections } from "../content/legal/terms";
import { getTenantBrandName, MARKETPLACE_BRAND_BASELINE } from "../tenant/displayBrand";

const Terms = () => {
  const brandName = getTenantBrandName();
  const localizedSections = useMemo(
    () =>
      termsSections.map((section) => ({
        ...section,
        body: section.body?.map((p) => p.replaceAll(MARKETPLACE_BRAND_BASELINE, brandName)),
        bullets: section.bullets?.map((p) => p.replaceAll(MARKETPLACE_BRAND_BASELINE, brandName)),
      })),
    [brandName],
  );
  const localizedPaymentNote = useMemo(
    () => paymentDataSharingNote.replaceAll(MARKETPLACE_BRAND_BASELINE, brandName),
    [brandName],
  );

  const [open, setOpen] = useState<Set<string>>(new Set(termsSections.map((section) => section.id)));
  const [desktopTopics, setDesktopTopics] = useState(() => window.matchMedia("(min-width:1024px)").matches);
  const [topicsOpen, setTopicsOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width:1024px)");
    const update = () => { setDesktopTopics(media.matches); setTopicsOpen(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const sectionNav = useMemo(
    () => localizedSections.map((section) => ({ id: section.id, label: section.title })),
    [localizedSections],
  );

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

  const printPage = () => window.print();

  const pageTitle = `Terms of Service | ${brandName}`;

  return (
    <LegalLayout
      current="terms"
      className="terms-page"
      title="Terms of Service"
      description="The definitive legal contract governing bookings, payments, conduct, and liabilities."
      lastUpdated={termsMetadata.lastUpdated}
    >
      <SEO
        title={pageTitle}
        description={`Review ${brandName} Terms of Service with booking rules, cancellations, conduct, and liability guidance.`}
        url="/terms"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <details className="terms-topics" open={desktopTopics || topicsOpen}
          onToggle={(event) => { if (!desktopTopics) setTopicsOpen(event.currentTarget.open); }}
          onClick={(event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
            const target = anchor && document.getElementById(anchor.hash.slice(1));
            if (!target) return;
            if (!desktopTopics) setTopicsOpen(false);
            requestAnimationFrame(() => { target.focus({ preventScroll: true }); target.scrollIntoView({ block: "start" }); });
          }}>
          <summary hidden={desktopTopics}>Terms topics ({sectionNav.length})</summary>
          <SectionNav sections={sectionNav} />
        </details>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={() => setOpen(new Set(localizedSections.map((section) => section.id)))}
              className="min-h-11 px-5 py-3 rounded-full border border-border-subtle text-base font-semibold text-primary hover:border-primary"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={() => setOpen(new Set())}
              className="min-h-11 px-5 py-3 rounded-full border border-border-subtle text-base font-semibold text-primary hover:border-primary"
            >
              Collapse all
            </button>
            <button
              type="button"
              onClick={printPage}
              className="min-h-11 px-5 py-3 rounded-full border border-border-subtle text-base font-semibold text-text-primary hover:border-border-strong"
            >
              Print-friendly view
            </button>
          </div>

          <div className="space-y-4">
            {localizedSections.map((section) => (
              <article
                key={section.id}
                id={section.id}
                tabIndex={-1}
                className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-level1"
              >
                <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-primary">Legal</p>
                    <h2 className="text-2xl font-bold text-text-primary">{section.title}</h2>
                    {section.summary && <p className="text-text-muted mt-1">{section.summary}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(section.id)}
                    className="min-h-11 text-base font-semibold px-4 py-3 rounded-full border border-border-subtle hover:border-cta-primary text-primary"
                    aria-expanded={open.has(section.id)}
                    aria-controls={`${section.id}-body`}
                  >
                    {open.has(section.id) ? "Hide" : "Show"}
                  </button>
                </header>

                {open.has(section.id) && (
                  <div id={`${section.id}-body`} className="mt-4 space-y-3 text-text-primary">
                    {section.body?.map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                    {section.bullets && (
                      <ul className="list-disc pl-5 space-y-2">
                        {section.bullets.map((bullet, idx) => (
                          <li key={idx}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="bg-bg-muted border border-border-subtle rounded-2xl p-6 text-text-primary">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">Payment data sharing</p>
            <p className="mt-2">{localizedPaymentNote}</p>
          </div>
        </div>
      </div>
    </LegalLayout>
  );
};

export default Terms;
