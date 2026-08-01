/**
 * TASK-5181 — the guest-facing "note from your host" panel, factored out of
 * Homepage_PropertyDetails.tsx and themes/heritage/PropertyDetails.tsx so both layouts share one
 * gating rule instead of duplicating it.
 *
 * Prior state (the defect this fixes): both layouts rendered a hardcoded first-person quote for
 * EVERY listing, signed "— {hostName}, your host" whenever a real host name was on file — words no
 * host ever wrote, attributed to a real person. TASK-4987 (2026-07-19) later swapped in
 * `data.hostAbout` when present but kept a synthetic fallback sentence ("Your host has not added a
 * personal note for this listing yet.") so the panel still rendered unconditionally.
 *
 * Fix: render NOTHING — no fallback string, no default copy — unless `hostAbout` is a real,
 * non-empty, per-listing/host field. Matches the Airbnb precedent named in the task: host blurbs
 * render only from host-authored content; an empty field renders nothing.
 *
 * This component does NOT carry the cross-layout contrast-gate canary (role="note" +
 * data-testid="pp-host-note") anymore — that contract moved to each layout's always-rendered
 * "What verified means" panel (founder ruling 2026-07-30), because a canary that depends on a
 * per-listing field which is routinely empty is not a reliable "the page painted" signal. See the
 * comment above the `pp-verified-panel` div in each layout file for the re-pointed contract.
 */

export interface HostAboutNoteProps {
  /** Real, per-listing, host-authored note. Absent/empty/whitespace-only -> renders null. */
  hostAbout?: string | null;
  /** True only when the listing has an actual host name on file (not a tenant/brand fallback
   *  label) — gates the "— {name}, your host" attribution so it never signs invented or
   *  brand-fallback text with a person's name. */
  hasRealHost: boolean;
  hostDisplayName: string;
  /** Layout-specific eyebrow/heading copy, e.g. "A note from your host" (classic) vs
   *  "From your hosts" (heritage) — kept distinct per TASK-4987's layout-differentiation intent. */
  heading: string;
  ariaLabel: string;
  /** Optional testid override; defaults to "pp-host-about-note" (distinct from the retired
   *  "pp-host-note" canary testid, which now lives on the verified-trust panel). */
  testId?: string;
}

export default function HostAboutNote({
  hostAbout,
  hasRealHost,
  hostDisplayName,
  heading,
  ariaLabel,
  testId = 'pp-host-about-note',
}: HostAboutNoteProps) {
  const note = hostAbout?.trim() ?? '';
  if (!note) return null;

  return (
    <div
      role="note"
      data-testid={testId}
      aria-label={ariaLabel}
      style={{
        margin: '20px 0 4px',
        borderRadius: 16,
        padding: '22px 26px',
        background: 'var(--lavender-soft, #f0eafd)',
        borderLeft: '4px solid var(--lavender-deep, #8e7cc3)',
      }}
    >
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: 'var(--lavender-text, #6f5aa8)',
          margin: '0 0 10px',
        }}
      >
        {heading}
      </p>
      <blockquote
        style={{
          fontFamily: 'var(--font-family-display)',
          fontSize: 'clamp(18px, 2vw, 22px)',
          lineHeight: 1.55,
          color: 'var(--text-primary, #4a3535)',
          margin: 0,
        }}
      >
        {note}
      </blockquote>
      {hasRealHost ? (
        <p style={{ marginTop: 10, fontSize: 13, color: 'var(--lavender-text, #6f5aa8)' }}>
          — {hostDisplayName}, your host
        </p>
      ) : null}
    </div>
  );
}
