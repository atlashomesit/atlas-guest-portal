import Homepage_WhyChoose from "../homepage_components/homepage_whychoose/Homepage_WhyChoose";
import {
  enableWhyChooseAccordion,
  enableWhyChooseConciseBullets,
  enableWhyChooseNoSelectionState,
  enableWhyChooseStatsBadges,
  whyChooseHighlights,
  whyChooseStatsBadges,
} from "../../config/homepageUxFlags";

const WhyChooseSection = () => {
  const useExperimentalLayout =
    enableWhyChooseAccordion ||
    enableWhyChooseConciseBullets ||
    enableWhyChooseStatsBadges ||
    enableWhyChooseNoSelectionState;

  if (!useExperimentalLayout) {
    return <Homepage_WhyChoose />;
  }

  if (enableWhyChooseAccordion) {
    return (
      <section className="py-16 lg:py-24 bg-gradient-to-b from-bg-surface to-bg-muted" aria-labelledby="why-choose-heading">
        <div className="max-w-3xl mx-auto px-6">
          <h2 id="why-choose-heading" className="text-3xl font-bold text-text-primary mb-2">
            Why choose Atlas Homes
          </h2>
          <p className="text-text-muted mb-6">
            Accordion layout: tap each item to expand details — a compact alternative to the carousel selector.
          </p>
          <div className="space-y-2">
            {whyChooseHighlights.map((item) => (
              <details key={item.title} className="rounded-lg border border-border-subtle bg-bg-surface p-4">
                <summary className="cursor-pointer font-semibold text-text-primary">{item.title}</summary>
                <p className="mt-2 text-sm text-text-muted">{item.description}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-bg-surface to-bg-muted">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">Why choose Atlas Homes</h2>
          <p className="mt-4 text-text-muted">
            Serviced apartments in Hyderabad with responsive hosts and work-friendly spaces.
          </p>
        </div>
        {enableWhyChooseStatsBadges && (
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {whyChooseStatsBadges.map((label) => (
              <span
                key={label}
                role="presentation"
                className="rounded-full border border-border-subtle bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary"
              >
                {label}
              </span>
            ))}
          </div>
        )}
        <ul className={`grid gap-6 ${enableWhyChooseConciseBullets ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-1 max-w-2xl mx-auto"}`}>
          {whyChooseHighlights.map((item) => (
            <li
              key={item.title}
              className={`rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-level1 ${
                enableWhyChooseNoSelectionState ? "" : "hover:border-accent-primary/40 transition-colors"
              }`}
            >
              <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default WhyChooseSection;
