/**
 * TASK-4924 / ADR-0081 D8 — "editorial" layout's pull-quote-style callout.
 *
 * Founder-specified visual direction (ATLAS-DEVELOPER-TASKS.md TASK-4924): "long-form copy
 * blocks, pull-quote-style callouts, narrative section ordering." This is a small,
 * presentational-only component scoped entirely within `src/themes/editorial/**` — it does
 * not touch booking/payment/listing-fetch logic, so per this task's own stop-and-ask it does
 * not need extraction into the shared component library (the stop-and-ask only requires that
 * for a primitive multiple themes would need; `coastal/CoastalWaveDivider.tsx`, TASK-4907, is
 * the established precedent for a theme-scoped decorative component built the same way
 * instead of extending/forking a shared one).
 *
 * WCAG AA binding discipline (see `defaultColorTokens.ts`'s header comment for the ratio
 * table this depends on): the quote text itself is always `--text-primary` (verified ≥8.9:1
 * across editorial's own default palette and every curated color preset this layout declares
 * — see `registry.ts`). The large serif quotation-mark glyph is `aria-hidden` and purely
 * decorative (never conveys text content), so it is not held to a text-contrast minimum —
 * same convention `noir`'s value-strip icons and `coastal`'s wave divider already establish.
 */
type EditorialPullQuoteProps = {
  quote: string;
  attribution?: string;
};

const EditorialPullQuote = ({ quote, attribution }: EditorialPullQuoteProps) => (
  <blockquote className="editorial-pull-quote" data-testid="editorial-pull-quote">
    <span className="editorial-pull-quote-mark" aria-hidden="true">
      &ldquo;
    </span>
    <p className="editorial-pull-quote-text">{quote}</p>
    {attribution && <cite className="editorial-pull-quote-attribution">{attribution}</cite>}
  </blockquote>
);

export default EditorialPullQuote;
