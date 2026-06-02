import type { HTMLAttributes, PropsWithChildren } from "react";
import "./ui.css";

type CardVariant = "default" | "muted" | "interactive";

interface CardProps extends HTMLAttributes<HTMLDivElement>, PropsWithChildren {
  variant?: CardVariant;
  muted?: boolean;
}

export function Card({ className, children, variant, muted, ...rest }: CardProps) {
  const cardVariant = variant || (muted ? "muted" : "default");
  const classes = [
    "rb-card",
    `rb-card--${cardVariant}`,
    className
  ].filter(Boolean).join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
