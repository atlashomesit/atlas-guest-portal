import React from "react";

interface ErrorBannerProps {
  message?: string;
  className?: string;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message = "Service temporarily unavailable. Please try again shortly.",
  className = "",
}) => (
  <div
    role="status"
    className={`rounded-xl border border-border-subtle bg-[color:color-mix(in_srgb,var(--support-warning)_10%,var(--bg-surface))] px-4 py-3 text-sm text-text-primary ${className}`}
  >
    {message}
  </div>
);

export default ErrorBanner;
