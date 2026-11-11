import { useTenantProcessingFee } from "../hooks/useTenantProcessingFee";
import { getTenantBrandName } from "../tenant/displayBrand";
import { paymentFeeCopy } from "../utils/paymentFeeCopy";

interface OwnerShareBadgeProps {
  /** Retained for callers; a room tariff cannot establish the host's actual settlement. */
  nightlyPrice?: number | null;
  className?: string;
  /** Marketplace callers must supply the listing's own fee, never the platform tenant's fee. */
  processingFeePercent?: number | null;
}

export default function OwnerShareBadge({ className = "", processingFeePercent }: OwnerShareBadgeProps) {
  const brandName = getTenantBrandName();
  const tenantFee = useTenantProcessingFee(processingFeePercent === undefined);
  const percent = processingFeePercent === undefined ? tenantFee : processingFeePercent;
  const label = "Book direct — host keeps more";
  const tooltip = `Direct booking via ${brandName} has no OTA commission. ${paymentFeeCopy({ percent })}`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 cursor-default ${className}`}
      title={tooltip}
      aria-label={`${label}. ${tooltip}`}
    >
      🏦 {label}
    </span>
  );
}
