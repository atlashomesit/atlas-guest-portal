import Homepage_Testimonial from "../homepage_components/homepage_testimonial/Homepage_Testimonial";
import {
  enableTestimonialsSingleCentered,
  enableTestimonialsStatic3,
  testimonialsCopy,
} from "../../config/homepageUxFlags";

const TestimonialsSection = () => {
  if (enableTestimonialsStatic3) {
    return (
      <section className="py-12 bg-bg-muted">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">{testimonialsCopy.headline}</h2>
            <p className="text-text-muted">{testimonialsCopy.supporting}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((card) => (
              <div
                key={card}
                className="rounded-xl border border-dashed border-border-subtle bg-bg-surface p-6 shadow-level1"
              >
                <p className="text-text-muted">Guests highlight spotless rooms, warm hosts, and easy check-ins.</p>
                <p className="mt-4 font-semibold text-text-primary">Guest name</p>
                <p className="text-sm text-text-muted">Source pending verification</p>
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
            <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">{testimonialsCopy.spotlightHeadline}</h2>
            <p className="mt-2 text-text-muted">{testimonialsCopy.spotlightSupporting}</p>
            <div className="mt-6 text-text-muted">
              <p>“Staying at Atlas Homes was seamless from booking to checkout.”</p>
              <p className="mt-4 font-semibold text-text-primary">Guest name</p>
              <p className="text-sm text-text-muted">Source pending verification</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return <Homepage_Testimonial />;
};

export default TestimonialsSection;
