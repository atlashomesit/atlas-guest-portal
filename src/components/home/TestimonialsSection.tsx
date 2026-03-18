import Homepage_Testimonial from "../homepage_components/homepage_testimonial/Homepage_Testimonial";
import {
  enableTestimonialsSingleCentered,
  enableTestimonialsStatic3,
  testimonialsCopy,
} from "../../config/homepageUxFlags";

const TestimonialsSection = () => {
  if (enableTestimonialsStatic3) {
    return (
<<<<<<< HEAD
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
                className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm p-6 md:p-8 shadow-[var(--shadow-level-2)] transition-all duration-[180ms] hover:-translate-y-1.5 hover:scale-[1.02] min-w-[280px]"
              >
                <p className="font-display text-xl md:text-2xl font-normal italic text-white leading-relaxed" style={{ fontFamily: 'var(--font-family-display)' }}>
                  “Guests highlight spotless rooms, warm hosts, and easy check-ins.”
                </p>
                <p className="mt-4 text-amber-300" aria-hidden>★★★★★</p>
                <p className="mt-4 font-semibold text-white">Guest name</p>
                <p className="text-[11px] uppercase tracking-[0.08em] text-white/60">Source pending verification</p>
=======
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
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (enableTestimonialsSingleCentered) {
    return (
<<<<<<< HEAD
      <section
        className="py-section-gap md:py-section-gap-md lg:py-section-gap-lg text-white"
        style={{ background: 'linear-gradient(180deg, var(--dark-footer-start) 0%, var(--dark-footer-end) 100%)' }}
      >
        <div className="mx-auto max-w-prose px-[5%]">
          <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm p-8 md:p-12 text-center shadow-[var(--shadow-level-2)]">
            <h2 className="font-display text-[var(--text-h2)] font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>
              {testimonialsCopy.spotlightHeadline}
            </h2>
            <p className="mt-4 text-white/80 text-base md:text-lg">{testimonialsCopy.spotlightSupporting}</p>
            <div className="mt-8">
              <p className="font-display text-xl md:text-2xl font-normal italic text-white leading-relaxed" style={{ fontFamily: 'var(--font-family-display)' }}>
                “Staying at Atlas Homes was seamless from booking to checkout.”
              </p>
              <p className="mt-4 text-amber-300" aria-hidden>★★★★★</p>
              <p className="mt-4 font-semibold text-white">Guest name</p>
              <p className="text-[11px] uppercase tracking-[0.08em] text-white/60">Source pending verification</p>
=======
      <section className="py-12 bg-bg-muted">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-surface p-8 text-center shadow-level1">
            <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">{testimonialsCopy.spotlightHeadline}</h2>
            <p className="mt-2 text-text-muted">{testimonialsCopy.spotlightSupporting}</p>
            <div className="mt-6 text-text-muted">
              <p>“Staying at Atlas Homes was seamless from booking to checkout.”</p>
              <p className="mt-4 font-semibold text-text-primary">Guest name</p>
              <p className="text-sm text-text-muted">Source pending verification</p>
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
            </div>
          </div>
        </div>
      </section>
    );
  }

  return <Homepage_Testimonial />;
};

export default TestimonialsSection;
