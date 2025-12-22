const FooterCtaStrip = () => {
  return (
    <div className="bg-bg-muted border-t border-border-subtle py-6 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-3 items-start sm:items-center sm:flex-row sm:justify-between">
        <p className="text-lg font-semibold text-text-primary">Need help choosing a room? WhatsApp us</p>
        {/* TODO: Add WhatsApp deep link button with verified number */}
        <button
          type="button"
          className="rounded-full border border-dashed border-border-subtle px-4 py-2 text-sm font-semibold text-text-muted"
        >
          WhatsApp CTA placeholder
        </button>
      </div>
    </div>
  );
};

export default FooterCtaStrip;
