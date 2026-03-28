/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CALLBACK_LEADS_ENDPOINT?: string;
  readonly VITE_CHAT_API_URL?: string;
  readonly VITE_ATLAS_AUTH_KEY?: string;
  readonly VITE_EMAILJS_PUBLIC_KEY?: string;
  readonly VITE_EMAILJS_SERVICE_ID?: string;
  readonly VITE_EMAILJS_TEMPLATE_ID?: string;
  readonly VITE_ALLOWED_EMAILS?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_OWNER_EMAIL?: string;
  readonly VITE_RAZORPAY_KEY_ID?: string;
  readonly NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
