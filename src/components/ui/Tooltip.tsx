import React, { useState } from "react";
import "./ui.css";

type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: string;
  placement?: TooltipPlacement;
  children: React.ReactNode;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  placement = "top",
  children,
  delay = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  return (
    <div
      className="rb-tooltip__wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div className={`rb-tooltip rb-tooltip--${placement}`} role="tooltip">
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
