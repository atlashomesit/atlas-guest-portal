/** Same script id as LocationPage / MultiPinMap — one SDK load per tab. */
export const MAP_SCRIPT_ID = "atlas-homestays-google-maps-script";

export async function loadGoogleMapsJs(apiKey: string): Promise<void> {
  if (window.google?.maps?.Map && window.google.maps.Marker) return;
  const existing = document.getElementById(MAP_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Maps script failed")), { once: true });
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
    document.head.appendChild(script);
  });
}
