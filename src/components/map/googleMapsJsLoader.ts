/** Same script id as LocationPage / MultiPinMap — one SDK load per tab. */
export const MAP_SCRIPT_ID = "atlas-homestays-google-maps-script";

/**
 * Custom event name fired on `window` when Google Maps reports a billing /
 * auth failure (e.g. BillingNotEnabledMapError).  Components subscribe to
 * this so they can switch to the graceful fallback without re-rendering on
 * every frame.
 */
export const MAPS_AUTH_FAILURE_EVENT = "atlas:mapsAuthFailure";

/** True once `gm_authFailure` has fired at least once in this tab. */
export function isMapsAuthFailed(): boolean {
  return Boolean((window as Record<string, unknown>).__atlasMapsAuthFailed);
}

/**
 * Install a one-shot `window.gm_authFailure` interceptor BEFORE the Maps
 * script tag is appended.  Google calls this callback when billing is not
 * enabled (BillingNotEnabledMapError) — without an interceptor the SDK
 * injects its own error banner into every map container.  Our interceptor
 * suppresses the banner, marks `__atlasMapsAuthFailed`, and dispatches
 * `atlas:mapsAuthFailure` so React components can react.
 */
function installAuthFailureGuard(): void {
  if ((window as Record<string, unknown>).__atlasMapsAuthGuardInstalled) return;
  (window as Record<string, unknown>).__atlasMapsAuthGuardInstalled = true;
  (window as Record<string, unknown>).gm_authFailure = () => {
    if (!(window as Record<string, unknown>).__atlasMapsAuthFailed) {
      (window as Record<string, unknown>).__atlasMapsAuthFailed = true;
      window.dispatchEvent(new CustomEvent(MAPS_AUTH_FAILURE_EVENT));
    }
  };
}

export async function loadGoogleMapsJs(apiKey: string): Promise<void> {
  // If a previous load already hit a billing error, fail fast without retrying.
  if (isMapsAuthFailed()) throw new Error("Maps billing not enabled");

  if (window.google?.maps?.Map && window.google.maps.Marker) return;

  // Install the auth-failure guard before any script tag is added.
  installAuthFailureGuard();

  const existing = document.getElementById(MAP_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Maps script failed")), { once: true });
      window.addEventListener(MAPS_AUTH_FAILURE_EVENT, () => reject(new Error("Maps billing not enabled")), {
        once: true,
      });
      if (window.google?.maps?.Map && window.google.maps.Marker) resolve();
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Maps script failed")), { once: true });
    window.addEventListener(MAPS_AUTH_FAILURE_EVENT, () => reject(new Error("Maps billing not enabled")), {
      once: true,
    });
    document.head.appendChild(script);
  });
}
