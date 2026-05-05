import { getFaqHighlights } from "../../content/faqHighlights";

const FaqHighlights = () => {
  const faqHighlights = getFaqHighlights();

  return (
    <section className="bg-bg-card border)] rounded-2xl p-6 md:p-8 shadow-level1">
      <div className="max-w-prose mb-8">
        <h2 className="font-display text-xl md:text-2xl font-semibold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>
          Frequently Asked Questions
        </h2>
        <p className="mt-3 text-[var(--text-secondary)] text-sm md:text-base leading-relaxed">
          Check-in basics, cancellations, extra guests, Wi-Fi, parking, work-friendly setups, and how to reach us.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {faqHighlights.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border)] bg-bg-secondary p-5 md:p-6 space-y-2 transition-all duration-300 hover:shadow-level2"
          >
            <h3 className="text-base md:text-lg font-semibold text-[var(--text-primary)]">{item.question}</h3>
            <p className="text-sm md:text-base text-[var(--text-primary)] leading-relaxed">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FaqHighlights;
