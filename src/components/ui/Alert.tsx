import React from "react";
import "./ui.css";

type AlertType = "success" | "error" | "warning" | "info";

interface AlertProps {
  type?: AlertType;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
  className?: string;
}

const icons: Record<AlertType, string> = {
  success: "✓",
  error: "⚠",
  warning: "!",
  info: "ℹ",
};

export const Alert: React.FC<AlertProps> = ({
  type = "info",
  title,
  message,
  action,
  onClose,
  className = "",
}) => {
  return (
    <div
      className={`rb-alert rb-alert--${type} ${className}`}
      role="alert"
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <div className="rb-alert__icon" aria-hidden="true">
        {icons[type]}
      </div>
      <div className="rb-alert__content">
        {title && <h3 className="rb-alert__title">{title}</h3>}
        <p className="rb-alert__message">{message}</p>
      </div>
      {(action || onClose) && (
        <div className="rb-alert__actions">
          {action && (
            <button
              className="rb-alert__action-btn"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          )}
          {onClose && (
            <button
              className="rb-alert__close-btn"
              onClick={onClose}
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Alert;
