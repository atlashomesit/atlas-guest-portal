import type { HTMLAttributes, PropsWithChildren } from "react";
import "./ui.css";

interface CardProps extends HTMLAttributes<HTMLDivElement>, PropsWithChildren {
  muted?: boolean;
}

export function Card({ className, children, muted, ...rest }: CardProps) {
  const classes = ["rb-card", muted ? "rb-card--muted" : null, className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
