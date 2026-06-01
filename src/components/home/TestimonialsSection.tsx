import { useMemo } from "react";

import {
  enableTestimonialsSingleCentered,
  enableTestimonialsStatic3,
  testimonialsCopy,
} from "../../config/homepageUxFlags";
import { useTenantListings } from "../../hooks/useTenantListings";
import { useVerifiedReviews } from "../../hooks/useVerifiedReviews";

const TestimonialsSection = () => {
  // TASK-2872: drive testimonials from real verified-stay reviews. Hooks run
  // unconditionally (rules of hooks) before any early return below.
  const { properties } = useTenantListings();
  const listingIds = useMemo(
    () =>
      properties
        .map((p) => p.listingId)
        .filter((id): id is number => typeof id === "number" && id > 0),
    [properties],
  );
  const { reviews } = useVerifiedReviews(listingIds);
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
                <p className="text-xs uppercase tracking-[0.08em] text-white/60">Source pending verification</p>              </div>
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
              <p className="text-xs uppercase tracking-[0.08em] text-white/60">Source pending verification</p>            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default: real verified guest reviews only — never fabricated names.
  // Render nothing when there are no real reviews yet (honest empty state).
  if (reviews.length === 0) return null;

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
            What verified guests say
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3 overflow-x-auto md:overflow-visible">
          {reviews.map((r) => {
            const stars = Math.max(1, Math.min(5, Math.round(r.rating)));
            const quote = r.text.length > 220 ? `${r.text.slice(0, 217)}…` : r.text;
            return (
              <div
                key={r.id}
                className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm p-6 md:p-8 transition-all duration-[180ms] hover:-translate-y-1.5 hover:scale-[1.02] min-w-[280px]"
              >
                <p className="font-display text-xl md:text-2xl font-normal italic text-white leading-relaxed" style={{ fontFamily: 'var(--font-family-display)' }}>
                  “{quote}”
                </p>
                <p className="mt-4 text-amber-300" aria-label={`${stars} out of 5 stars`}>
                  {"★".repeat(stars)}{"☆".repeat(5 - stars)}
                </p>
                <p className="mt-4 font-semibold text-white">{r.firstName}</p>
                <p className="text-xs uppercase tracking-[0.08em] text-white/60">Verified stay</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
