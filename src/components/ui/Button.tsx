import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import "./ui.css";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

function buildClassName({ variant, size, fullWidth, className }: { variant: ButtonVariant; size: ButtonSize; fullWidth?: boolean; className?: string }) {
  const classes = [
    "rb-button",
    variant !== "primary" ? `rb-button--${variant}` : null,
    size !== "md" ? `rb-button--${size}` : null,
    fullWidth ? "rb-button--block" : null,
    className,
  ];

  return classes.filter(Boolean).join(" ");
}

export function Button({ variant = "primary", size = "md", fullWidth, className, children, ...rest }: ButtonProps) {
  return (
    <button className={buildClassName({ variant, size, fullWidth, className })} {...rest}>
      {children}
    </button>
  );
}
