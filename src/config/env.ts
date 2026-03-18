<<<<<<< HEAD
type EnvSource = Record<string, string | undefined>;

=======
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
interface ImportMetaEnv {
  [key: string]: unknown;
}

interface ProcessEnv {
  [key: string]: string | undefined;
}

<<<<<<< HEAD
const getEnv = (key: string, ...sources: EnvSource[]): string | undefined => {
  for (const source of sources) {
    const value = source?.[key];
    if (typeof value === "string") return value;
=======
const getEnv = (key: string): string | undefined => {
  if (typeof process !== "undefined") {
    const val = (process as { env?: ProcessEnv }).env?.[key];
    if (typeof val === "string") return val;
  }
  if (typeof import.meta !== "undefined") {
    const val = (import.meta as { env?: ImportMetaEnv }).env?.[key];
    if (typeof val === "string") return val;
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
  }
  return undefined;
};

<<<<<<< HEAD
const metaEnvRaw = typeof import.meta !== "undefined" 
  ? (import.meta as { env?: ImportMetaEnv }).env ?? {} 
  : {};
const metaEnv: EnvSource = Object.keys(metaEnvRaw).reduce((acc, key) => {
  const value = metaEnvRaw[key];
  acc[key] = typeof value === "string" ? value : undefined;
  return acc;
}, {} as EnvSource);

const nodeEnv: EnvSource = typeof process !== "undefined" 
  ? (process as { env?: ProcessEnv }).env ?? {} 
  : {};

export const ENV = getEnv("MODE", metaEnv, nodeEnv) ?? getEnv("NODE_ENV", nodeEnv) ?? "development";
=======
export const ENV = getEnv("MODE") ?? getEnv("NODE_ENV") ?? "development";
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c

export const IS_LOCALHOST = (() => {
  if (typeof window !== "undefined") {
    const hostname = window.location?.hostname ?? "";
    return hostname === "localhost" || hostname === "127.0.0.1";
  }
<<<<<<< HEAD
  const devFlag = (getEnv("DEV", metaEnv, nodeEnv) ?? "").toString().toLowerCase();
=======
  const devFlag = (getEnv("DEV") ?? "").toLowerCase();
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
  return devFlag === "true" || devFlag === "1";
})();

export const getAllowedEmails = (): string[] => {
<<<<<<< HEAD
  const raw = getEnv("VITE_ALLOWED_EMAILS", metaEnv, nodeEnv);
=======
  const raw = getEnv("VITE_ALLOWED_EMAILS");
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
  if (!raw) return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // fall through to CSV parsing
    }
  }

  return trimmed
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
};

export const getAuthConfig = () => ({
  allowedEmails: getAllowedEmails(),
});
