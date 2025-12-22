import { cloneElement } from "react";
import { Link } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import { FiHelpCircle, FiPhone, FiPhoneCall } from "react-icons/fi";

type SupportActionId = "whatsapp" | "call" | "faq" | "callback";

export const RECOMMENDED_ACTION_ID: SupportActionId = "whatsapp";

interface SupportActionGridProps {
  contactPhone: string;
  enableCtaHierarchy?: boolean;
  enableRecommendedWhatsAppPrimary?: boolean;
  onCallClick: () => void;
  onFaqClick: () => void;
  onCallbackClick?: () => void;
  onWhatsappClick: () => void;
  primaryActionIds?: SupportActionId[];
  secondaryActionIds?: SupportActionId[];
  tertiaryActionIds?: SupportActionId[];
  whatsappLink: string;
}

const ACTION_STYLES =
  "flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-3 py-2 text-left text-sm font-semibold shadow-level1 transition hover:-translate-y-0.5 hover:border-accent-primary hover:bg-[color-mix(in_srgb,var(--cta-primary)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary";

const SupportActionGrid = ({
  contactPhone,
  enableCtaHierarchy,
  enableRecommendedWhatsAppPrimary,
  onCallClick,
  onCallbackClick,
  onFaqClick,
  onWhatsappClick,
  primaryActionIds,
  secondaryActionIds,
  tertiaryActionIds,
  whatsappLink,
}: SupportActionGridProps) => {
  const allActions: Record<SupportActionId, JSX.Element> = {
    whatsapp: (
      <a
        href={whatsappLink}
        target="_blank"
        rel="noreferrer"
        onClick={onWhatsappClick}
        className={`${ACTION_STYLES} ${enableRecommendedWhatsAppPrimary ? "min-h-[76px]" : ""}`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--support-success)_15%,transparent)] text-success">
          <FaWhatsapp aria-hidden="true" />
        </span>
        <span>
          WhatsApp
          <span className="block text-[11px] font-normal text-text-muted">Fastest response</span>
        </span>
      </a>
    ),
    call: (
      <a href={`tel:+91${contactPhone}`} onClick={onCallClick} className={ACTION_STYLES}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-cta-primary">
          <FiPhone aria-hidden="true" />
        </span>
        <span>
          Call
          <span className="block text-[11px] font-normal text-text-muted">Speak with the team</span>
        </span>
      </a>
    ),
    faq: (
      <Link to="/faq" onClick={onFaqClick} className={ACTION_STYLES}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cta-secondary)_12%,transparent)] text-cta-secondary">
          <FiHelpCircle aria-hidden="true" />
        </span>
        <span>
          FAQs
          <span className="block text-[11px] font-normal text-text-muted">Instant answers</span>
        </span>
      </Link>
    ),
    callback: onCallbackClick ? (
      <button type="button" onClick={onCallbackClick} className={ACTION_STYLES}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cta-secondary)_12%,transparent)] text-cta-secondary">
          <FiPhoneCall aria-hidden="true" />
        </span>
        <div className="flex-1">
          <span className="block">Request callback</span>
          <span className="block text-[11px] font-normal text-text-muted">We&apos;ll ring you back</span>
        </div>
      </button>
    ) : (
      <div className={ACTION_STYLES}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cta-secondary)_12%,transparent)] text-cta-secondary">
          <FiPhoneCall aria-hidden="true" />
        </span>
        <div className="flex-1">
          <span className="block">Request callback</span>
          <span className="block text-[11px] font-normal text-text-muted">We&apos;ll ring you back</span>
        </div>
      </div>
    ),
  };

  const shouldApplyHierarchy = Boolean(enableCtaHierarchy);
  const configuredPrimary =
    primaryActionIds ??
    (shouldApplyHierarchy
      ? ([RECOMMENDED_ACTION_ID] as SupportActionId[])
      : enableRecommendedWhatsAppPrimary
        ? [RECOMMENDED_ACTION_ID]
        : undefined);
  const primaryIds = configuredPrimary ?? (Object.keys(allActions) as SupportActionId[]);
  const primarySet = new Set(primaryIds);

  const configuredSecondary =
    secondaryActionIds ??
    (shouldApplyHierarchy
      ? (["call", "callback"].filter((id) => allActions[id as SupportActionId]) as SupportActionId[])
      : enableRecommendedWhatsAppPrimary
        ? (Object.keys(allActions).filter((id) => !primarySet.has(id as SupportActionId)) as SupportActionId[])
        : []);
  const secondaryIds = configuredSecondary.filter((id) => !primarySet.has(id));
  const secondarySet = new Set(secondaryIds);

  const tertiaryIds =
    (shouldApplyHierarchy
      ? tertiaryActionIds ?? (["faq"].filter((id) => allActions[id as SupportActionId]) as SupportActionId[])
      : tertiaryActionIds) ?? [];

  const renderSecondary = (enableRecommendedWhatsAppPrimary || shouldApplyHierarchy) && secondaryIds.length > 0;
  const renderTertiary = shouldApplyHierarchy && tertiaryIds.length > 0;

  const renderAction = (id: SupportActionId) => cloneElement(allActions[id], { key: id });

  if (!enableRecommendedWhatsAppPrimary) {
    const prioritizedIds = shouldApplyHierarchy
      ? [...primaryIds, ...secondaryIds, ...tertiaryIds.filter((id) => !secondarySet.has(id) && !primarySet.has(id))]
      : primaryIds;

    return <div className="grid grid-cols-2 gap-3 px-4 py-3">{prioritizedIds.map(renderAction)}</div>;
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-col gap-2">{primaryIds.map(renderAction)}</div>

      {renderSecondary ? (
        <div className="rounded-2xl border border-border-subtle bg-bg-muted/60 p-2">
          <p className="px-1 pb-1 text-[13px] font-medium text-text-muted">
            {shouldApplyHierarchy ? "Next best options" : "Other ways to reach us"}
          </p>
          <div className="flex flex-col gap-2">{secondaryIds.map(renderAction)}</div>
        </div>
      ) : null}

      {renderTertiary ? (
        <div className="rounded-2xl border border-border-subtle bg-[color-mix(in_srgb,var(--bg-muted)_50%,transparent)] p-2">
          <p className="px-1 pb-1 text-[13px] font-medium text-text-muted">Self-serve</p>
          <div className="flex flex-col gap-2">
            {tertiaryIds.filter((id) => !primarySet.has(id) && !secondarySet.has(id)).map((id) => renderAction(id))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SupportActionGrid;
