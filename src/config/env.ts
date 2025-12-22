type EnvSource = Record<string, string | undefined>;

const getEnv = (key: string, ...sources: EnvSource[]): string | undefined => {
  for (const source of sources) {
    const value = source?.[key];
    if (typeof value === "string") return value;
  }
  return undefined;
};

const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any).env ?? {} : {};
const nodeEnv = typeof process !== "undefined" ? (process as any).env ?? {} : {};

export const ENV = getEnv("MODE", metaEnv, nodeEnv) ?? getEnv("NODE_ENV", nodeEnv) ?? "development";

export const IS_LOCALHOST = (getEnv("DEV", metaEnv, nodeEnv) ?? "").toString() === "true";

export const getAllowedEmails = (): string[] => {
  const raw = getEnv("VITE_ALLOWED_EMAILS", metaEnv, nodeEnv);
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
