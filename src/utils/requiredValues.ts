export const assertNonEmpty = (
  value: string | null | undefined,
  name: string,
): string | null => {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    if (import.meta.env.DEV) {
      console.error(`[config] Missing required value: ${name}`);
    }
    return null;
  }

  return trimmed;
};
