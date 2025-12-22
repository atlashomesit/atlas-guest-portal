import Homepage_WhyChoose from "../homepage_components/homepage_whychoose/Homepage_WhyChoose";
import {
  enableWhyChooseAccordion,
  enableWhyChooseConciseBullets,
  enableWhyChooseNoSelectionState,
  enableWhyChooseStatsBadges,
} from "../../config/homepageUxFlags";

const WhyChooseSection = () => {
  if (enableWhyChooseAccordion) {
    return (
      <section className="py-16 lg:py-24 bg-gradient-to-b from-bg-surface to-bg-muted">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 lg:px-20 space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">Why Choose Atlas Homes?</h2>
            <p className="text-text-muted">{/* TODO: Replace with accordion UI once items are verified */}</p>
          </div>
          <div className="rounded-xl border border-dashed border-border-subtle bg-bg-surface p-6 shadow-level1">
            <p className="text-text-muted">
              TODO: Build accordion interaction with concise bullets per item and optional stats badges (4.8+ avg rating, Near Hitech City / KPHB, Fast support on WhatsApp) once data is confirmed.
            </p>
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
          <p className="text-text-muted">{/* TODO: Remove selected/active state and keep cards neutral for usability test */}</p>
          <div className="grid gap-3 rounded-lg border border-dashed border-border-subtle bg-bg-surface p-6 shadow-level1">
            <p className="text-text-muted">Placeholder for non-highlighted feature list.</p>
          </div>
        </div>
      </section>
    );
  }

  if (enableWhyChooseConciseBullets || enableWhyChooseStatsBadges) {
    const highlights = [
      "Comfort Redefined",
      "Unmatched Hospitality",
      "Prime Locations",
      "Value for Money",
      "Memorable Experiences",
    ];
    const stats = ["4.8+ avg rating", "Near Hitech City / KPHB", "Fast support on WhatsApp"];

    return (
      <section className="py-16 lg:py-24 bg-gradient-to-b from-bg-surface to-bg-muted">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 lg:px-20 space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">Why Choose Atlas Homes?</h2>
            <p className="text-text-muted">
              {/* TODO: Convert long paragraphs into concise bullet list once approved by content */}
              Explore headline reasons to pick Atlas Homes.
            </p>
          </div>

          {enableWhyChooseStatsBadges && (
            <div className="flex flex-wrap gap-2">
              {stats.map((stat) => (
                <span
                  key={stat}
                  className="inline-flex items-center rounded-full border border-dashed border-border-subtle bg-bg-surface px-3 py-1 text-sm font-semibold text-text-primary"
                >
                  {/* TODO: Replace with verified metric badges */}
                  {stat}
                </span>
              ))}
            </div>
          )}

          <ul className="space-y-3 rounded-xl border border-dashed border-border-subtle bg-bg-surface p-6 shadow-level1">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-accent-primary" aria-hidden />
                <div>
                  <p className="font-semibold text-text-primary">{item}</p>
                  <p className="text-text-muted text-sm">{/* TODO: Insert concise bullet copy here */}</p>
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
