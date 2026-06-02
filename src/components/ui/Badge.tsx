import React from "react";
import "./ui.css";

type BadgeVariant = "primary" | "secondary" | "success" | "error" | "warning" | "info";
type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "primary",
  size = "md",
  icon,
  className = "",
}) => {
  return (
    <span className={`rb-badge rb-badge--${variant} rb-badge--${size} ${className}`}>
      {icon && <span className="rb-badge__icon">{icon}</span>}
      {label}
    </span>
  );
};

export default Badge;
