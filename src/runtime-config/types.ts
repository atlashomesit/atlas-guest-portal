export type AtlasRuntimeConfig = {
  apiBaseUrl: string;
  globalDiscountPercent?: number;
  environment?: string;
  tenantKey?: string;
  googleMapsApiKey?: string;
  /** Wave 9 #86: VAPID public key for web push (optional; feature-flagged). */
  webPushPublicKey?: string;
};
