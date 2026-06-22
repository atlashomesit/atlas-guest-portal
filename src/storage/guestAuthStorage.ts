import { Capacitor } from '@capacitor/core';
import { storage } from '@/storage/secureStorage';

export const GUEST_AUTH_STORAGE_KEY = 'atlas_guest_auth';

export type StoredGuestAuthState = {
  isAuthenticated: boolean;
  token: string | null;
  email: string | null;
  guestId: number | null;
};

let cachedAuth: StoredGuestAuthState | null = null;
let nativeHydrated = !Capacitor.isNativePlatform();

if (!Capacitor.isNativePlatform()) {
  try {
    const raw = localStorage.getItem(GUEST_AUTH_STORAGE_KEY);
    cachedAuth = raw ? (JSON.parse(raw) as StoredGuestAuthState) : null;
  } catch {
    cachedAuth = null;
  }
}

export async function hydrateGuestAuthState(): Promise<StoredGuestAuthState | null> {
  if (!Capacitor.isNativePlatform()) {
    return cachedAuth;
  }
  try {
    const raw = await storage.get(GUEST_AUTH_STORAGE_KEY);
    cachedAuth = raw ? (JSON.parse(raw) as StoredGuestAuthState) : null;
  } catch {
    cachedAuth = null;
  }
  nativeHydrated = true;
  return cachedAuth;
}

export function isGuestAuthHydrated(): boolean {
  return nativeHydrated;
}

export function getCachedGuestAuthState(): StoredGuestAuthState | null {
  return cachedAuth;
}

export async function persistGuestAuthState(state: StoredGuestAuthState): Promise<void> {
  cachedAuth = state;
  await storage.set(GUEST_AUTH_STORAGE_KEY, JSON.stringify(state));
}

export async function clearGuestAuthState(): Promise<void> {
  cachedAuth = null;
  await storage.remove(GUEST_AUTH_STORAGE_KEY);
}
