import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import "./ui.css";

type FeatureBadgeTone = "surface" | "linen";

interface FeatureBadgeProps extends HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  label: string;
  tone?: FeatureBadgeTone;
}

export function FeatureBadge({ icon: Icon, label, tone = "surface", className, ...rest }: FeatureBadgeProps) {
  const classes = ["rb-feature-badge", tone === "linen" ? "rb-feature-badge--linen" : null, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} tabIndex={0} {...rest}>
      <span className="rb-feature-badge__icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2.1} />
      </span>
      <span className="rb-feature-badge__label">{label}</span>
    </div>
  );
}
