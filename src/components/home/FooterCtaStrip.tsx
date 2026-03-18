import { footerMiniCtaCopy } from "../../config/homepageUxFlags";
import { getWhatsAppLink } from "../../config/contact";

const FooterCtaStrip = () => {
  const whatsappLink = getWhatsAppLink();

  return (
<<<<<<< HEAD
    <div className="bg-bg-secondary border-t border-[var(--border)] py-10 px-[5%]">
      <div className="mx-auto max-w-luxury flex flex-col gap-4 items-start sm:items-center sm:flex-row sm:justify-between">
        <p className="text-base md:text-lg font-semibold text-[var(--text-primary)]">{footerMiniCtaCopy.headline}</p>
        <a
          href={whatsappLink}
          className="rounded-full inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold text-white transition-all duration-250 hover:scale-[1.03] hover:shadow-[0_0_24px_rgba(255,107,53,0.25)]"
          style={{ background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-level-2)' }}
=======
    <div className="bg-bg-muted border-t border-border-subtle py-6 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-3 items-start sm:items-center sm:flex-row sm:justify-between">
        <p className="text-lg font-semibold text-text-primary">{footerMiniCtaCopy.headline}</p>
        <a
          href={whatsappLink}
          className="rounded-full border border-dashed border-border-subtle px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent-primary hover:text-accent-primary transition-colors"
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
        >
          {footerMiniCtaCopy.buttonLabel}
        </a>
      </div>
    </div>
  );
};

export default FooterCtaStrip;
