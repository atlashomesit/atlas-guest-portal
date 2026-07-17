/**
 * TASK-4907 / ADR-0081 D8 — "coastal" layout's wave-motif section divider.
 *
 * Decorative-only, self-contained within `src/themes/coastal/**` (not a shared-component
 * edit — `src/components/ui/WaveDivider.tsx` already exists for the coral redesign's own
 * coral/lavender/cream tones; per the "Theme ≠ integration" HARD RULE, a genuinely new tone
 * belongs in a separate, theme-agnostic PR, not bundled here, so this layout ships its own
 * small sea-blue variant instead of extending that shared component). `aria-hidden` — never
 * carries text, so it is outside WCAG text-contrast scope.
 */
type CoastalWaveDividerProps = {
  className?: string;
  flip?: boolean;
};

const CoastalWaveDivider = ({ className = "", flip = false }: CoastalWaveDividerProps) => (
  <div
    className={`coastal-wave-divider ${className}`}
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
      viewBox="0 0 1440 56"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", width: "100%", height: 40 }}
    >
      <path
        d="M0 28 C180 4, 360 52, 540 28 S900 4, 1080 28 S1350 4, 1440 28 V56 H0 Z"
        fill="#cdf1f9"
        opacity="0.9"
      />
      <path
        d="M0 34 C160 14, 320 50, 520 30 S880 12, 1080 32 S1320 12, 1440 30"
        fill="none"
        stroke="#22b8d8"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  </div>
);

export default CoastalWaveDivider;
