import { useMemo, useState } from "react";
import LegalLayout from "../components/legal/LegalLayout";
import SectionNav from "../components/legal/SectionNav";
import SEO from "../components/SEO";
import { paymentDataSharingNote, termsMetadata, termsSections } from "../content/legal/terms";

const Terms = () => {
  const [open, setOpen] = useState<Set<string>>(new Set(termsSections.map((section) => section.id)));

  const sectionNav = useMemo(
    () => termsSections.map((section) => ({ id: section.id, label: section.title })),
    []
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

  return (
    <LegalLayout
      current="terms"
      title={termsMetadata.title}
      description="The definitive legal contract governing bookings, payments, conduct, and liabilities."
      lastUpdated={termsMetadata.lastUpdated}
    >
      <SEO
        title={termsMetadata.title}
        description="Review Atlas Homestays Terms of Service with booking rules, cancellations, conduct, and liability guidance."
        url="/terms"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <SectionNav sections={sectionNav} />

        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={() => setOpen(new Set(termsSections.map((section) => section.id)))}
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
            {termsSections.map((section) => (
              <article
                key={section.id}
                id={section.id}
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
            <p className="mt-2">{paymentDataSharingNote}</p>
          </div>
        </div>
      </div>
    </LegalLayout>
  );
};

export default Terms;
