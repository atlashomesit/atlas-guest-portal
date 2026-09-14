import {
  ACCESSIBILITY_CODE_LABELS,
  ACCESSIBILITY_UNKNOWN_COPY,
  getAccessibilityDeclarations,
} from "../../utils/amenityCodes";

type AccessibilitySectionProps = {
  /** Raw amenity codes declared for the listing (API amenityCodes or legacy icons). */
  codes: readonly string[] | undefined | null;
};

/**
 * TASK-10086 [POD: Discovery/Search]: honest accessibility disclosure for listing detail.
 * Renders only explicitly declared v1 features; when nothing is declared it renders
 * the exact unknown-state copy — never an "accessible" label, verification badge,
 * or medical claim. Host-declared values only, not a certification.
 */
export default function AccessibilitySection({ codes }: AccessibilitySectionProps) {
  const declared = getAccessibilityDeclarations(codes);

  return (
    <section
      className="pp-section"
      aria-label="Accessibility"
      data-testid="property-accessibility-section"
    >
      <div className="pp-section-head">
        <h2>Accessibility</h2>
      </div>
      {declared.length > 0 ? (
        <>
          <div className="pp-amenities" role="list">
            {declared.map((code) => (
              <div key={code} className="pp-amenity" role="listitem">
                <span>{ACCESSIBILITY_CODE_LABELS[code] ?? code}</span>
              </div>
            ))}
          </div>
          <p className="pp-prose">Declared by the host, not verified by Atlas.</p>
        </>
      ) : (
        <p className="pp-prose">{ACCESSIBILITY_UNKNOWN_COPY}</p>
      )}
    </section>
  );
}
