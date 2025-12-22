export const getApiBase = (): string => {
  const raw = (import.meta.env.VITE_API_BASE ?? '').trim();
  if (import.meta.env.PROD && /localhost/i.test(raw)) {
    console.warn('getApiBase: blocking localhost API base in production');
    throw new Error('localhost API base not allowed in production');
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
};
