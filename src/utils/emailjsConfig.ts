const trimmed = (value?: string) => value?.trim();

const readEnvValue = (key: string) => {
  if (typeof import.meta !== "undefined" && typeof import.meta.env !== "undefined") {
    const value = (import.meta.env as Record<string, string | undefined>)[key];
    if (value) return value;
  }

  if (typeof process !== "undefined" && typeof process.env !== "undefined") {
    return process.env[key];
  }

  return undefined;
};

const rawConfig = {
  serviceId: trimmed(readEnvValue("VITE_EMAILJS_SERVICE_ID")),
  templateId: trimmed(readEnvValue("VITE_EMAILJS_TEMPLATE_ID")),
  publicKey: trimmed(readEnvValue("VITE_EMAILJS_PUBLIC_KEY")),
  ownerEmail: trimmed(readEnvValue("VITE_OWNER_EMAIL")),
};

const requiredEnvKeys: Record<string, string | undefined> = {
  VITE_EMAILJS_SERVICE_ID: rawConfig.serviceId,
  VITE_EMAILJS_TEMPLATE_ID: rawConfig.templateId,
  VITE_EMAILJS_PUBLIC_KEY: rawConfig.publicKey,
  VITE_OWNER_EMAIL: rawConfig.ownerEmail,
};

export const emailJsConfig = rawConfig;

export const getMissingEmailJsEnvKeys = () =>
  Object.entries(requiredEnvKeys)
    .filter(([, value]) => !value)
    .map(([key]) => key);

export const isEmailJsConfigured = () => getMissingEmailJsEnvKeys().length === 0;
