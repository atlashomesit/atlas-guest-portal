import { footerMiniCtaCopy } from "../../config/homepageUxFlags";
import { getWhatsAppLink } from "../../config/contact";

const FooterCtaStrip = () => {
  const whatsappLink = getWhatsAppLink();

  return (
    <div className="bg-bg-muted border-t border-border-subtle py-6 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-3 items-start sm:items-center sm:flex-row sm:justify-between">
        <p className="text-lg font-semibold text-text-primary">{footerMiniCtaCopy.headline}</p>
        <a
          href={whatsappLink}
          className="rounded-full border border-dashed border-border-subtle px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent-primary hover:text-accent-primary transition-colors"
        >
          {footerMiniCtaCopy.buttonLabel}
        </a>
      </div>
    </div>
  );
};

export default FooterCtaStrip;
