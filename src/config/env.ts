interface ImportMetaEnv {
  [key: string]: unknown;
}

interface ProcessEnv {
  [key: string]: string | undefined;
}

const getEnv = (key: string): string | undefined => {
  if (typeof process !== "undefined") {
    const val = (process as { env?: ProcessEnv }).env?.[key];
    if (typeof val === "string") return val;
  }
  if (typeof import.meta !== "undefined") {
    const val = (import.meta as { env?: ImportMetaEnv }).env?.[key];
    if (typeof val === "string") return val;
  }
  return undefined;
};

export const ENV = getEnv("MODE") ?? getEnv("NODE_ENV") ?? "development";

export const IS_LOCALHOST = (() => {
  if (typeof window !== "undefined") {
    const hostname = window.location?.hostname ?? "";
    return hostname === "localhost" || hostname === "127.0.0.1";
  }
  const devFlag = (getEnv("DEV") ?? "").toLowerCase();
  return devFlag === "true" || devFlag === "1";
})();

export const getAllowedEmails = (): string[] => {
  const raw = getEnv("VITE_ALLOWED_EMAILS");
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
