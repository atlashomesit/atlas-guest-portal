import { getGoogleMapsApiKey as getKeyFromRuntime } from "@/runtime-config";

const missingConfigMessage =
  "Google Maps API key is not configured. Add googleMapsApiKey to /.well-known/atlas-runtime-config.json. Falling back to the static map preview.";

export const getGoogleMapsApiKey = (): string | undefined => {
  try {
    const key = getKeyFromRuntime();
    if (key && key.trim()) return key.trim();
  } catch {
    // Runtime config not loaded (e.g. tests without setRuntimeConfig)
  }
  console.warn(missingConfigMessage);
  return undefined;
};
