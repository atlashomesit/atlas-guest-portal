import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import "./ui.css";

interface TrustBadgeProps extends HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  label: string;
}

export function TrustBadge({ icon: Icon, label, className, ...rest }: TrustBadgeProps) {
  const classes = ["rb-trust-badge", className].filter(Boolean).join(" ");

  return (
    <div className={classes} tabIndex={0} {...rest}>
      <span className="rb-trust-badge__icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2.1} />
      </span>
      <span className="rb-trust-badge__label">{label}</span>
    </div>
  );
}
