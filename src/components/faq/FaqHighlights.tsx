import { faqHighlights } from "../../content/faqHighlights";

const FaqHighlights = () => {
  return (
    <section className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-level1 space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Fast answers</p>
        <h2 className="text-2xl font-bold text-text-primary">Need-to-know FAQs</h2>
        <p className="text-text-muted text-sm">
          Check-in basics, cancellations, extra guests, Wi-Fi, parking, work-friendly setups, and how to reach us.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {faqHighlights.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border-subtle bg-bg-muted p-4 space-y-2 shadow-level1"
          >
            <h3 className="text-lg font-semibold text-text-primary">{item.question}</h3>
            <p className="text-sm text-text-primary leading-relaxed">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FaqHighlights;
