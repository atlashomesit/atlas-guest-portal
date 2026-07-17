import { getFaqHighlights } from "../../content/faqHighlights";

const FaqHighlights = () => {
  const faqHighlights = getFaqHighlights();

  return (
    <section className="max-w-5xl mx-auto">
      <div className="max-w-2xl mx-auto mb-8 md:mb-10 text-center">
        <h2
          className="font-display text-2xl md:text-3xl font-semibold text-[var(--text-primary)] tracking-tight"
          style={{ fontFamily: "var(--font-family-display)" }}
        >
          Frequently Asked Questions
        </h2>
        <p className="mt-3 text-[var(--text-secondary)] text-sm md:text-base leading-relaxed">
          Check-in basics, cancellations, extra guests, Wi-Fi, parking, work-friendly setups, and how to reach us.
        </p>
      </div>
      <div className="grid gap-4 md:gap-5 md:grid-cols-2">
        {faqHighlights.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface,#fff)] p-5 md:p-6 space-y-2 transition-all duration-300 hover:shadow-level2 h-full"
          >
            <h3 className="text-base md:text-lg font-semibold text-[var(--text-primary)]">{item.question}</h3>
            <p className="text-sm md:text-base text-[var(--text-muted)] leading-relaxed">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FaqHighlights;
