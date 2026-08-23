type WaveDividerProps = {
  /** Soft coral (default) or lavender, matching Theem mockups */
  tone?: "coral" | "lavender" | "cream";
  className?: string;
  /** Flip vertically for bottom transitions */
  flip?: boolean;
};

const STROKE = {
  coral: "var(--coral, var(--brand-accent, #d4724e))",
  lavender: "var(--lavender-mid, var(--lavender, #d8c0e8))",
  cream: "color-mix(in srgb, var(--coral, var(--brand-accent, #d4724e)) 55%, #fefcf9)",
} as const;

/**
 * Interlocking sine-wave motif from the Stay by City Focus theme mockups.
 * Decorative only — does not affect layout flow beyond its own height.
 */
const WaveDivider = ({ tone = "coral", className = "", flip = false }: WaveDividerProps) => {
  const stroke = STROKE[tone];

  return (
    <div
      className={`stay-wave-divider ${className}`}
      aria-hidden="true"
      style={{
        width: "100%",
        lineHeight: 0,
        overflow: "hidden",
        transform: flip ? "scaleY(-1)" : undefined,
        pointerEvents: "none",
      }}
    >
      <svg
        viewBox="0 0 1440 48"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", width: "100%", height: 36 }}
      >
        <path
          d="M0 24 C120 8, 240 40, 360 24 S600 8, 720 24 S960 40, 1080 24 S1320 8, 1440 24"
          fill="none"
          stroke={stroke}
          strokeWidth="1.75"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M0 30 C120 14, 240 46, 360 30 S600 14, 720 30 S960 46, 1080 30 S1320 14, 1440 30"
          fill="none"
          stroke={stroke}
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.45"
        />
      </svg>
    </div>
  );
};

export default WaveDivider;
