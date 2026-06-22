import { useEffect, useRef, useState } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

const ROOT_PATHS = ['/', '/search'];
const CHECKOUT_PATTERNS = [
  '/book/:propertySlug/:unitSlug/details',
  '/reserve',
];
const EXIT_TOAST_MS = 2000;

function isCheckoutPath(pathname: string): boolean {
  return CHECKOUT_PATTERNS.some((pattern) => matchPath({ path: pattern, end: true }, pathname));
}

function isRootPath(pathname: string): boolean {
  return ROOT_PATHS.includes(pathname);
}

type NativeShellBridgeProps = {
  authLoading: boolean;
};

/**
 * TASK-4198 — native Android polish: splash, status bar, hardware back (checkout confirm).
 */
export default function NativeShellBridge({ authLoading }: NativeShellBridgeProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const lastBackAt = useRef(0);
  const [exitToastOpen, setExitToastOpen] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    void StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    void StatusBar.setBackgroundColor({ color: '#ea580c' }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || authLoading) return;
    void SplashScreen.hide().catch(() => {});
  }, [authLoading]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerHandle = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (isCheckoutPath(pathname)) {
        const leave = window.confirm(
          'Are you sure you want to leave checkout? Your progress may be lost.',
        );
        if (leave && canGoBack) navigate(-1);
        return;
      }

      if (!isRootPath(pathname) && canGoBack) {
        navigate(-1);
        return;
      }

      const now = Date.now();
      if (now - lastBackAt.current <= EXIT_TOAST_MS) {
        void CapacitorApp.exitApp();
        return;
      }

      lastBackAt.current = now;
      setExitToastOpen(true);
      window.setTimeout(() => setExitToastOpen(false), EXIT_TOAST_MS);
    });

    return () => {
      void listenerHandle.then((listener) => listener.remove());
    };
  }, [navigate, pathname]);

  if (!Capacitor.isNativePlatform() || !exitToastOpen) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        transform: 'translateX(-50%)',
        background: 'rgba(17, 24, 39, 0.92)',
        color: '#fff',
        padding: '10px 16px',
        borderRadius: 8,
        fontSize: 14,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      Press back again to exit
    </div>
  );
}
