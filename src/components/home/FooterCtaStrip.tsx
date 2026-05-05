import { footerMiniCtaCopy } from "../../config/homepageUxFlags";
import { getWhatsAppLink } from "../../config/contact";

const FooterCtaStrip = () => {
  const whatsappLink = getWhatsAppLink();

  return (
    <div className="bg-bg-secondary border-t border-[var(--border)] py-10 px-[5%]">
      <div className="mx-auto max-w-luxury flex flex-col gap-4 items-start sm:items-center sm:flex-row sm:justify-between">
        <p className="text-base md:text-lg font-semibold text-[var(--text-primary)]">{footerMiniCtaCopy.headline}</p>
        <a
          href={whatsappLink}
          className="rounded-full inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold text-white transition-all duration-250 hover:scale-[1.03]"
          style={{ background: 'var(--gradient-cta)' }}        >
          {footerMiniCtaCopy.buttonLabel}
        </a>
      </div>
    </div>
  );
};

export default FooterCtaStrip;
