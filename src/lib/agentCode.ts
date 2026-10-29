/**
 * PRICE-016: the travel-agent access code a guest arrives with (`?agent=CODE` on the booking page).
 *
 * The code unlocks an agent-only net rate that the HOST priced; it is held for the browser tab only
 * (sessionStorage), sent to the API as `agentCode` / `bookingDraft.agentAccessCode`, and never rendered,
 * logged or put in analytics. A wrong or stale code is harmless: the API silently serves the normal public rate.
 */

const STORAGE_KEY = 'atlas.agentCode';
const URL_PARAMS = ['agent', 'agentCode'] as const;
const CODE_PATTERN = /^[A-Z0-9-]{8,32}$/;

let memoryCode: string | null = null;

function normalize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** Reads `?agent=` from a query string and, when it is a well-formed code, remembers it for this tab. */
export function captureAgentCodeFromUrl(search?: string): string | null {
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!query) return null;
  const params = new URLSearchParams(query);
  for (const name of URL_PARAMS) {
    const code = normalize(params.get(name));
    if (code) {
      memoryCode = code;
      try {
        window.sessionStorage.setItem(STORAGE_KEY, code);
      } catch {
        // storage blocked (private mode): the in-memory copy still serves this page load
      }
      return code;
    }
  }
  return null;
}

/** The remembered agent code for this tab, or null for an ordinary guest. */
export function getAgentCode(): string | null {
  if (memoryCode) return memoryCode;
  try {
    const stored = normalize(window.sessionStorage.getItem(STORAGE_KEY));
    if (stored) memoryCode = stored;
    return stored;
  } catch {
    return null;
  }
}

export function clearAgentCode(): void {
  memoryCode = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

/** Removes the agent code from the address bar (history replaced, no navigation) so it is not read by analytics. */
export function stripAgentCodeFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const name of URL_PARAMS) {
      if (url.searchParams.has(name)) {
        url.searchParams.delete(name);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // leave the URL as it is
  }
}
