/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CALLBACK_LEADS_ENDPOINT?: string;
  readonly VITE_CHAT_API_URL?: string;
  readonly VITE_ATLAS_AUTH_KEY?: string;
  readonly VITE_ALLOWED_EMAILS?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_RAZORPAY_KEY_ID?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_DATE_MULTIPLIERS_JSON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
