/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Admin PMS URL for host signup CTAs (e.g. https://app.atlaspms.in). */
  readonly VITE_ADMIN_PORTAL_URL?: string;
  /** Capacitor native build only: full runtime config JSON baked at build time, since the
   *  .well-known/ config file is stripped from the APK (see runtime-config/loader.ts:loadNativeConfig). */
  readonly VITE_NATIVE_RUNTIME_CONFIG?: string;
  /** Secondary build-time API base fallback (runtime config is the primary source on web). */
  readonly VITE_API_BASE_URL?: string;
  /** Canonical origin for JSON-LD when not running in a browser (e.g. https://guest.example.com). */
  readonly VITE_PUBLIC_SITE_ORIGIN?: string;
  readonly VITE_ALLOWED_EMAILS?: string;
  readonly VITE_SENTRY_DSN?: string;
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
