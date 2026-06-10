import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * TASK-4017: Guest authentication context
 * Manages OTP-based guest login and JWT storage
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

const STORAGE_KEY = 'atlas_guest_auth';

const defaultState: GuestAuthState = {
  isAuthenticated: false,
  token: null,
  email: null,
  guestId: null,
};

// eslint-disable-next-line react-refresh/only-export-components
export const GuestAuthContext = createContext<GuestAuthContextValue | undefined>(undefined);

export const GuestAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<GuestAuthState>(defaultState);
  const [isLoading, setIsLoading] = useState(true);

  // Load auth from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as GuestAuthState;
        setAuth(parsed);
      }
    } catch (error) {
      console.error('Failed to load guest auth from storage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((token: string, email: string, guestId?: number) => {
    const newAuth: GuestAuthState = {
      isAuthenticated: true,
      token,
      email,
      guestId: guestId ?? null,
    };
    setAuth(newAuth);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newAuth));
    } catch (error) {
      console.error('Failed to save guest auth to storage:', error);
    }
  }, []);

  const logout = useCallback(() => {
    setAuth(defaultState);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear guest auth from storage:', error);
    }
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
