/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Admin PMS URL for host signup CTAs (e.g. https://app.atlaspms.in). */
  readonly VITE_ADMIN_PORTAL_URL?: string;
  /** Canonical origin for JSON-LD when not running in a browser (e.g. https://guest.example.com). */
  readonly VITE_PUBLIC_SITE_ORIGIN?: string;
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

interface Window {
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}
