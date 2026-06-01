import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import "./ui.css";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

function buildClassName({ variant, size, fullWidth, loading, className }: { variant: ButtonVariant; size: ButtonSize; fullWidth?: boolean; loading?: boolean; className?: string }) {
  const classes = [
    "rb-button",
    variant !== "primary" ? `rb-button--${variant}` : null,
    size !== "md" ? `rb-button--${size}` : null,
    fullWidth ? "rb-button--block" : null,
    loading ? "rb-button--loading" : null,
    className,
  ];

  return classes.filter(Boolean).join(" ");
}

export function Button({ variant = "primary", size = "md", fullWidth, loading = false, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={buildClassName({ variant, size, fullWidth, loading, className })}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading && (
        <>
          <span className="rb-button__spinner" aria-hidden="true" />
          <span className="sr-only">Loading…</span>
        </>
      )}
      {children}
    </button>
  );
}
