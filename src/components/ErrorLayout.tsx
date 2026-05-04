import type { ReactNode } from "react";
import { Button } from "./ui/Button";
import { getTenantContext } from "@/tenant/tenantContext";

interface ErrorLayoutAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

interface ErrorLayoutProps {
  title: string;
  description: string;
  primaryAction?: ErrorLayoutAction;
  secondaryAction?: ErrorLayoutAction;
  children?: ReactNode;
}

const actionClassNames = (variant: ErrorLayoutAction["variant"]) =>
  ["rb-button", variant === "secondary" ? "rb-button--secondary" : null]
    .filter(Boolean)
    .join(" ");

export const ErrorLayout = ({
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
}: ErrorLayoutProps) => {
  const renderAction = (action: ErrorLayoutAction, fallbackVariant: "primary" | "secondary") => {
    const variant = action.variant ?? fallbackVariant;

    if (action.href) {
      return (
        <a className={actionClassNames(variant)} href={action.href} data-testid={`${variant}-action`}>
          {action.label}
        </a>
      );
    }

    return (
      <Button
        type="button"
        variant={variant}
        onClick={action.onClick}
        disabled={action.disabled}
        data-testid={`${variant}-action`}
      >
        {action.label}
      </Button>
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-bg-muted text-center p-6 gap-4"
      data-testid="error-layout"
    >
      <div className="max-w-2xl space-y-4">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{getTenantContext()?.name ?? 'Our Platform'}</p>
          <h1 className="text-3xl font-bold text-text-primary sm:text-4xl">{title}</h1>
          <p className="text-text-muted text-base sm:text-lg">{description}</p>
        </header>
        {children}
        <div className="flex gap-3 flex-wrap justify-center">
          {primaryAction ? renderAction(primaryAction, "primary") : null}
          {secondaryAction ? renderAction(secondaryAction, "secondary") : null}
        </div>
      </div>
    </div>
  );
};

export default ErrorLayout;
