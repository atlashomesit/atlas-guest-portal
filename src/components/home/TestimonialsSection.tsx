import Homepage_Testimonial from "../homepage_components/homepage_testimonial/Homepage_Testimonial";
import {
  enableTestimonialsSingleCentered,
  enableTestimonialsStatic3,
  testimonialsCopy,
} from "../../config/homepageUxFlags";

const TestimonialsSection = () => {
  if (enableTestimonialsStatic3) {
    return (
      <section
        className="py-section-gap md:py-section-gap-md lg:py-section-gap-lg text-white"
        style={{ background: 'linear-gradient(180deg, var(--dark-footer-start) 0%, var(--dark-footer-end) 100%)' }}
        aria-labelledby="testimonials-heading"
      >
        <div className="mx-auto max-w-luxury px-[5%]">
          <div className="text-center max-w-prose mx-auto mb-12">
            <p className="text-[var(--primary-gradient-end)] font-semibold tracking-[0.08em] uppercase text-xs md:text-sm mb-2">
              Guest reviews
            </p>
            <h2 id="testimonials-heading" className="font-display text-[var(--text-h2)] font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>
              {testimonialsCopy.headline}
            </h2>
            <p className="mt-4 text-white/80 text-base md:text-lg">{testimonialsCopy.supporting}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 overflow-x-auto md:overflow-visible">
            {[1, 2, 3].map((card) => (
              <div
                key={card}
                className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm p-6 md:p-8 transition-all duration-[180ms] hover:-translate-y-1.5 hover:scale-[1.02] min-w-[280px]"
              >
                <p className="font-display text-xl md:text-2xl font-normal italic text-white leading-relaxed" style={{ fontFamily: 'var(--font-family-display)' }}>
                  “Guests highlight spotless rooms, warm hosts, and easy check-ins.”
                </p>
                <p className="mt-4 text-amber-300" aria-hidden>★★★★★</p>
                <p className="mt-4 font-semibold text-white">Guest name</p>
                <p className="text-[11px] uppercase tracking-[0.08em] text-white/60">Source pending verification</p>              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (enableTestimonialsSingleCentered) {
    return (
      <section
        className="py-section-gap md:py-section-gap-md lg:py-section-gap-lg text-white"
        style={{ background: 'linear-gradient(180deg, var(--dark-footer-start) 0%, var(--dark-footer-end) 100%)' }}
      >
        <div className="mx-auto max-w-prose px-[5%]">
          <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm p-8 md:p-12 text-center">
            <h2 className="font-display text-[var(--text-h2)] font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>
              {testimonialsCopy.spotlightHeadline}
            </h2>
            <p className="mt-4 text-white/80 text-base md:text-lg">{testimonialsCopy.spotlightSupporting}</p>
            <div className="mt-8">
              <p className="font-display text-xl md:text-2xl font-normal italic text-white leading-relaxed" style={{ fontFamily: 'var(--font-family-display)' }}>
                “Staying here was seamless from booking to checkout.”
              </p>
              <p className="mt-4 text-amber-300" aria-hidden>★★★★★</p>
              <p className="mt-4 font-semibold text-white">Guest name</p>
              <p className="text-[11px] uppercase tracking-[0.08em] text-white/60">Source pending verification</p>            </div>
          </div>
        </div>
      </section>
    );
  }

  return <Homepage_Testimonial />;
};

export default TestimonialsSection;
