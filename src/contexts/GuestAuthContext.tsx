import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  hydrateGuestAuthState,
  getCachedGuestAuthState,
  persistGuestAuthState,
  clearGuestAuthState,
} from '@/storage/guestAuthStorage';

/**
 * TASK-4017: Guest authentication context
 * Manages OTP-based guest login and JWT storage
 * TASK-4198: JWT persisted via Preferences on native Android
 */

export interface GuestAuthState {
  isAuthenticated: boolean;
  token: string | null;
  email: string | null;
  guestId: number | null;
}

type GuestAuthContextValue = {
  auth: GuestAuthState;
  login: (token: string, email: string, guestId?: number) => void;
  logout: () => void;
  isLoading: boolean;
};

const defaultState: GuestAuthState = {
  isAuthenticated: false,
  token: null,
  email: null,
  guestId: null,
};

// eslint-disable-next-line react-refresh/only-export-components
export const GuestAuthContext = createContext<GuestAuthContextValue | undefined>(undefined);

export const GuestAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<GuestAuthState>(() => getCachedGuestAuthState() ?? defaultState);
  const [isLoading, setIsLoading] = useState(Capacitor.isNativePlatform());

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    void (async () => {
      try {
        const stored = await hydrateGuestAuthState();
        if (!cancelled && stored) setAuth(stored);
      } catch (error) {
        console.error('Failed to load guest auth from storage:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((token: string, email: string, guestId?: number) => {
    const newAuth: GuestAuthState = {
      isAuthenticated: true,
      token,
      email,
      guestId: guestId ?? null,
    };
    setAuth(newAuth);
    void persistGuestAuthState(newAuth).catch((error) => {
      console.error('Failed to save guest auth to storage:', error);
    });
  }, []);

  const logout = useCallback(() => {
    setAuth(defaultState);
    void clearGuestAuthState().catch((error) => {
      console.error('Failed to clear guest auth from storage:', error);
    });
  }, []);

  const value: GuestAuthContextValue = {
    auth,
    login,
    logout,
    isLoading,
  };

  return <GuestAuthContext.Provider value={value}>{children}</GuestAuthContext.Provider>;
};

export const useGuestAuth = (): GuestAuthContextValue => {
  const context = useContext(GuestAuthContext);
  if (!context) {
    throw new Error('useGuestAuth must be used within GuestAuthProvider');
  }
  return context;
};
