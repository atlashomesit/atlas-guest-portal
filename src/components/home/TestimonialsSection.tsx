import { useMemo } from "react";
import type { CSSProperties } from "react";

import {
  enableTestimonialsSingleCentered,
  enableTestimonialsStatic3,
  testimonialsCopy,
} from "../../config/homepageUxFlags";
import { useTenantListings } from "../../hooks/useTenantListings";
import { useVerifiedReviews } from "../../hooks/useVerifiedReviews";

/* Kind-words band — light peach wash from the Stay by City Focus mockups
   (dark navy band replaced 2026-07: cards are white with alternating
   coral/lavender hairline borders, coral stars, gradient initial avatars). */
const testimonialsBandStyle: CSSProperties = {
  backgroundColor: "var(--bg-secondary, #fdf2e9)",
};

const reviewCardBaseClassName =
  "rounded-2xl p-6 md:p-8 transition-all duration-[180ms] hover:-translate-y-1.5 min-w-[280px] shadow-[0_2px_8px_rgba(74,53,53,0.05)] hover:shadow-[0_12px_32px_rgba(74,53,53,0.09)]";

/**
 * Alternating hairline borders — coral / lavender / coral, per the mockup row.
 *
 * TASK-4952 — `backgroundColor` moved here off a hardcoded `bg-white` utility. The card ground
 * was white while its contents bind to --text-primary / --text-muted, so the dark noir presets
 * painted light text on white: 1.08-1.12:1 for the quote and guest name, 1.77-2.57:1 for
 * "Verified stay". --bg-card with #ffffff as the fallback keeps every light preset
 * byte-identical while dark palettes get their own card surface; the band behind it already
 * resolved --bg-secondary the same way. Set as an inline style rather than a
 * `bg-[var(--bg-card,#ffffff)]` arbitrary utility because this element already carries a style
 * object, and it keeps the value out of Tailwind's arbitrary-value parsing entirely.
 */
const reviewCardBorderStyle = (index: number): CSSProperties => ({
  backgroundColor: "var(--bg-card, #ffffff)",
  border: `1px solid ${index % 2 === 1 ? "var(--lavender, #c5b4f3)" : "color-mix(in srgb, var(--brand-accent, #f08c71) 70%, #ffffff)"}`,
});

/** Gradient initial avatar — peach for even cards, lavender for odd. */
const avatarStyle = (index: number): CSSProperties => ({
  background:
    index % 2 === 1
      ? "linear-gradient(135deg, #d9cdf7 0%, #b6a3ee 100%)"
      : "linear-gradient(135deg, #f7c4ae 0%, #ee9d7f 100%)",
});

const StarRow = ({ stars, label }: { stars: number; label?: string }) => (
  <p
    className="flex items-center gap-1 text-lg leading-none"
    style={{ color: "var(--brand-accent, #f08c71)" }}
    aria-label={label ?? `${stars} out of 5 stars`}
  >
    <span aria-hidden>{"★".repeat(stars)}</span>
    {stars < 5 ? (
      <span aria-hidden style={{ opacity: 0.35 }}>
        {"★".repeat(5 - stars)}
      </span>
    ) : null}
  </p>
);

const KindWordsHeader = ({ ratingLine, headline }: { ratingLine?: string; headline?: string }) => (
  <div className="text-center max-w-prose mx-auto mb-12">
    <p className="font-semibold tracking-[0.18em] uppercase text-xs md:text-sm mb-3" style={{ color: "var(--accent-text, #a84832)" }}>
      Kind words
    </p>
    <h2
      id="testimonials-heading"
      className="font-display text-[var(--text-h2)] font-semibold tracking-tight text-text-primary"
      style={{ fontFamily: "var(--font-family-display)" }}
    >
      {headline ?? testimonialsCopy.headline}
    </h2>
    {ratingLine ? (
      <p className="mt-3 flex items-center justify-center gap-2 text-sm md:text-base font-semibold text-text-primary">
        <span aria-hidden style={{ color: "var(--brand-accent, #f08c71)" }}>★</span>
        {ratingLine}
      </p>
    ) : (
      <p className="mt-4 text-text-muted text-base md:text-lg">{testimonialsCopy.supporting}</p>
    )}
  </div>
);

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
        className="py-section-gap md:py-section-gap-md lg:py-section-gap-lg isolate relative"
        style={testimonialsBandStyle}
        aria-labelledby="testimonials-heading"
      >
        <div className="mx-auto max-w-luxury px-[5%]">
          <KindWordsHeader />
          <div className="grid gap-6 md:grid-cols-3 overflow-x-auto md:overflow-visible">
            {[1, 2, 3].map((card, index) => (
              <div key={card} className={reviewCardBaseClassName} style={reviewCardBorderStyle(index)}>
                <StarRow stars={5} />
                <p className="mt-4 font-display text-xl md:text-2xl font-normal text-text-primary leading-relaxed" style={{ fontFamily: 'var(--font-family-display)' }}>
                  “Guests highlight spotless rooms, warm hosts, and easy check-ins.”
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <span
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={avatarStyle(index)}
                    aria-hidden
                  >
                    G
                  </span>
                  <div>
                    <p className="font-semibold text-text-primary leading-tight">Guest name</p>
                    <p className="text-xs text-text-muted">Source pending verification</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (enableTestimonialsSingleCentered) {
    return (
      <section
        className="py-section-gap md:py-section-gap-md lg:py-section-gap-lg isolate relative"
        style={testimonialsBandStyle}
      >
        <div className="mx-auto max-w-prose px-[5%]">
          <div className={`${reviewCardBaseClassName} p-8 md:p-12 text-center`} style={reviewCardBorderStyle(0)}>
            <h2 className="font-display text-[var(--text-h2)] font-semibold text-text-primary tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>
              {testimonialsCopy.spotlightHeadline}
            </h2>
            <p className="mt-4 text-text-muted text-base md:text-lg">{testimonialsCopy.spotlightSupporting}</p>
            <div className="mt-8">
              <p className="font-display text-xl md:text-2xl font-normal text-text-primary leading-relaxed" style={{ fontFamily: 'var(--font-family-display)' }}>
                “Staying here was seamless from booking to checkout.”
              </p>
              <div className="mt-4 flex justify-center">
                <StarRow stars={5} />
              </div>
              <p className="mt-4 font-semibold text-text-primary">Guest name</p>
              <p className="text-xs text-text-muted">Source pending verification</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default: real verified guest reviews only — never fabricated names.
  // Render nothing when there are no real reviews yet (honest empty state).
  if (reviews.length === 0) return null;

  const averageRating =
    Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 100) / 100;
  const ratingLine = `${averageRating} · ${reviews.length} verified ${reviews.length === 1 ? "stay" : "stays"}`;

  return (
    <section
      className="py-section-gap md:py-section-gap-md lg:py-section-gap-lg isolate relative"
      style={testimonialsBandStyle}
      aria-labelledby="testimonials-heading"
      data-testid="homepage-verified-testimonials"
    >
      <div className="mx-auto max-w-luxury px-[5%]">
        <KindWordsHeader ratingLine={ratingLine} headline="What verified guests say" />
        <div className="grid gap-6 md:grid-cols-3 overflow-x-auto md:overflow-visible">
          {reviews.map((r, index) => {
            const stars = Math.max(1, Math.min(5, Math.round(r.rating)));
            const quote = r.text.length > 220 ? `${r.text.slice(0, 217)}…` : r.text;
            const initials = r.firstName.trim().charAt(0).toUpperCase() || "G";
            return (
              <div key={r.id} className={reviewCardBaseClassName} style={reviewCardBorderStyle(index)}>
                <StarRow stars={stars} label={`${stars} out of 5 stars`} />
                <p className="mt-4 font-display text-xl md:text-2xl font-normal text-text-primary leading-relaxed" style={{ fontFamily: 'var(--font-family-display)' }}>
                  “{quote}”
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <span
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={avatarStyle(index)}
                    aria-hidden
                  >
                    {initials}
                  </span>
                  <div>
                    <p className="font-semibold text-text-primary leading-tight">{r.firstName}</p>
                    <p className="text-xs text-text-muted">Verified stay</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
