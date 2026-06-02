import React from "react";
import { Button } from "./ui/Button";

export type ErrorSeverity = "error" | "warning" | "info";

interface ErrorBannerProps {
  message?: string;
  severity?: ErrorSeverity;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message = "Something went wrong. Please try again shortly.",
  severity = "error",
  onRetry,
  onDismiss,
  className = "",
}) => {
  const severityStyles: Record<ErrorSeverity, string> = {
    error: "bg-[color:color-mix(in_srgb,var(--support-error)_10%,var(--bg-surface))] border-border-strong text-text-primary",
    warning: "bg-[color:color-mix(in_srgb,var(--support-warning)_10%,var(--bg-surface))] border-border-subtle text-text-primary",
    info: "bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,var(--bg-surface))] border-border-subtle text-text-primary",
  };

  const icons: Record<ErrorSeverity, string> = {
    error: "⚠️",
    warning: "⚡",
    info: "ℹ️",
  };

  return (
    <div
      role="alert"
      className={`rounded-xl border ${severityStyles[severity]} px-4 py-3 text-sm flex items-start gap-3 ${className}`}
    >
      <span className="flex-shrink-0 text-lg" aria-hidden="true">
        {icons[severity]}
      </span>
      <div className="flex-1">
        <p className="font-medium">{message}</p>
      </div>
      {(onRetry || onDismiss) && (
        <div className="flex-shrink-0 flex gap-2 ml-4">
          {onRetry && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onRetry}
              className="whitespace-nowrap"
            >
              Retry
            </Button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorBanner;
