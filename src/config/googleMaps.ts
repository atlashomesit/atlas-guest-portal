import { getGoogleMapsApiKey } from "./getGoogleMapsApiKey";

const googleMapsApiKey = getGoogleMapsApiKey();

export const GOOGLE_MAPS_API_KEY = googleMapsApiKey;
export const IS_GOOGLE_MAPS_CONFIGURED = Boolean(GOOGLE_MAPS_API_KEY);
export { getGoogleMapsApiKey };
