import { Link } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import { FiHelpCircle, FiPhone, FiPhoneCall } from "react-icons/fi";

interface SupportActionGridProps {
  contactPhone: string;
  onCallClick: () => void;
  onFaqClick: () => void;
  onWhatsappClick: () => void;
  whatsappLink: string;
}

const SupportActionGrid = ({ contactPhone, onCallClick, onFaqClick, onWhatsappClick, whatsappLink }: SupportActionGridProps) => (
  <div className="grid grid-cols-2 gap-3 px-4 py-3">
    <a
      href={whatsappLink}
      target="_blank"
      rel="noreferrer"
      onClick={onWhatsappClick}
      className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-3 py-2 text-left text-sm font-semibold shadow-level1 transition hover:-translate-y-0.5 hover:border-accent-primary hover:bg-[color-mix(in_srgb,var(--cta-primary)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--support-success)_15%,transparent)] text-success">
        <FaWhatsapp aria-hidden="true" />
      </span>
      <span>
        WhatsApp
        <span className="block text-[11px] font-normal text-text-muted">Fastest response</span>
      </span>
    </a>

    <a
      href={`tel:+91${contactPhone}`}
      onClick={onCallClick}
      className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-3 py-2 text-left text-sm font-semibold shadow-level1 transition hover:-translate-y-0.5 hover:border-accent-primary hover:bg-[color-mix(in_srgb,var(--cta-primary)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-cta-primary">
        <FiPhone aria-hidden="true" />
      </span>
      <span>
        Call
        <span className="block text-[11px] font-normal text-text-muted">Speak with the team</span>
      </span>
    </a>

    <Link
      to="/faq"
      onClick={onFaqClick}
      className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-3 py-2 text-left text-sm font-semibold shadow-level1 transition hover:-translate-y-0.5 hover:border-accent-primary hover:bg-[color-mix(in_srgb,var(--cta-primary)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cta-secondary)_12%,transparent)] text-cta-secondary">
        <FiHelpCircle aria-hidden="true" />
      </span>
      <span>
        FAQs
        <span className="block text-[11px] font-normal text-text-muted">Instant answers</span>
      </span>
    </Link>

    <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-3 py-2 text-left text-sm font-semibold shadow-level1">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cta-secondary)_12%,transparent)] text-cta-secondary">
        <FiPhoneCall aria-hidden="true" />
      </span>
      <div className="flex-1">
        <span className="block">Request callback</span>
        <span className="block text-[11px] font-normal text-text-muted">We&apos;ll ring you back</span>
      </div>
    </div>
  </div>
);

export default SupportActionGrid;
