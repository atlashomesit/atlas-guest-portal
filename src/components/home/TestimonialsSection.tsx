import Homepage_Testimonial from "../homepage_components/homepage_testimonial/Homepage_Testimonial";
import {
  enableTestimonialsSingleCentered,
  enableTestimonialsStatic3,
} from "../../config/homepageUxFlags";

const TestimonialsSection = () => {
  if (enableTestimonialsStatic3) {
    return (
      <section className="py-12 bg-bg-muted">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">What guests are saying</h2>
            <p className="text-text-muted">{/* TODO: Swap in louder social proof and verified source labels */}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((card) => (
              <div
                key={card}
                className="rounded-xl border border-dashed border-border-subtle bg-bg-surface p-6 shadow-level1"
              >
                <p className="text-text-muted">Static testimonial placeholder {card}</p>
                <p className="mt-4 font-semibold text-text-primary">Guest name</p>
                <p className="text-sm text-text-muted">{/* TODO: Add clearer source label once data is verified */}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (enableTestimonialsSingleCentered) {
    return (
      <section className="py-12 bg-bg-muted">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-surface p-8 text-center shadow-level1">
            <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">Guest spotlight</h2>
            <p className="mt-2 text-text-muted">{/* TODO: One centered testimonial with bigger stars */}</p>
            <div className="mt-6 text-text-muted">
              <p>“TODO: Add single featured quote once selected.”</p>
              <p className="mt-4 font-semibold text-text-primary">Guest name</p>
              <p className="text-sm text-text-muted">{/* TODO: Source label (Google/Airbnb) */}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return <Homepage_Testimonial />;
};

export default TestimonialsSection;
