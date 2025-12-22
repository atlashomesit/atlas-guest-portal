const readEnv = (key: string): string | undefined => {
  const procValue = typeof process !== "undefined" ? (process as any).env?.[key] : undefined;
  const metaValue = typeof import.meta !== "undefined" ? (import.meta as any).env?.[key] : undefined;
  return (procValue ?? metaValue) as string | undefined;
};

export const getApiBase = (): string => {
  const raw = (readEnv("VITE_API_BASE") ?? "").trim();
  if (!raw) {
    throw new Error("API base is not configured");
  }
  if (/localhost/i.test(raw)) {
    console.warn("getApiBase: blocking localhost API base");
    throw new Error("localhost API base not allowed");
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};
