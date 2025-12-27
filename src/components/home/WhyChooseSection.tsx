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
  if (enableWhyChooseAccordion) {
    return (
      <section className="py-16 lg:py-24 bg-gradient-to-b from-bg-surface to-bg-muted">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 lg:px-20 space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">Why Choose Atlas Homes?</h2>
            <p className="text-text-muted">Accordion layout in progress. Highlights stay current here.</p>
          </div>
          <div className="rounded-xl border border-dashed border-border-subtle bg-bg-surface p-6 shadow-level1">
            <p className="text-text-muted">Upcoming accordion variant with verified stats and bullet copy.</p>
          </div>
        </div>
      </section>
    );
  }

  if (enableWhyChooseNoSelectionState) {
    return (
      <section className="py-16 lg:py-24 bg-gradient-to-b from-bg-surface to-bg-muted">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 lg:px-20 space-y-4">
          <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">Why Choose Atlas Homes?</h2>
          <p className="text-text-muted">Neutral card test state to keep all highlights equally weighted.</p>
          <div className="grid gap-3 rounded-lg border border-dashed border-border-subtle bg-bg-surface p-6 shadow-level1">
            <p className="text-text-muted">Placeholder for non-highlighted feature list.</p>
          </div>
        </div>
      </section>
    );
  }

  if (enableWhyChooseConciseBullets || enableWhyChooseStatsBadges) {
    return (
      <section className="py-16 lg:py-24 bg-gradient-to-b from-bg-surface to-bg-muted">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 lg:px-20 space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">Why Choose Atlas Homes?</h2>
            <p className="text-text-muted">
              Explore headline reasons to pick Atlas Homes.
            </p>
          </div>

          {enableWhyChooseStatsBadges && (
            <div className="flex flex-wrap gap-2">
              {whyChooseStatsBadges.map((stat) => (
                <span
                  key={stat}
                  className="inline-flex items-center rounded-full border border-dashed border-border-subtle bg-bg-surface px-3 py-1 text-sm font-semibold text-text-primary"
                >
                  {stat}
                </span>
              ))}
            </div>
          )}

          <ul className="space-y-3 rounded-xl border border-dashed border-border-subtle bg-bg-surface p-6 shadow-level1">
            {whyChooseHighlights.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-accent-primary" aria-hidden />
                <div>
                  <p className="font-semibold text-text-primary">{item.title}</p>
                  <p className="text-text-muted text-sm">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return <Homepage_WhyChoose />;
};

export default WhyChooseSection;
