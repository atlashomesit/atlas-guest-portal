import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type PushNotificationSchema,
  type ActionPerformed,
} from '@capacitor/push-notifications';
import { buildApiUrl, getApiHeaders } from '@/api/client';

const APP_BUNDLE = 'com.atlastays.app';

/**
 * TASK-4198 — register FCM token post-login on native Android.
 * POST is best-effort until TASK-4199 ships the API endpoint.
 */
export function usePushNotifications(isAuthenticated: boolean, token: string | null): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isAuthenticated || !token) return;

    let cancelled = false;
    const listenerHandles: Array<Promise<{ remove: () => void }>> = [];

    const registerToken = async (fcmToken: string) => {
      try {
        await fetch(buildApiUrl('/api/device-tokens'), {
          method: 'POST',
          headers: {
            ...getApiHeaders(),
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: fcmToken,
            platform: 'android',
            appBundle: APP_BUNDLE,
          }),
        });
      } catch (err) {
        console.warn('[push] device token registration failed (endpoint may be unavailable)', err);
      }
    };

    void (async () => {
      const permission = await PushNotifications.requestPermissions();
      if (cancelled || permission.receive !== 'granted') return;

      listenerHandles.push(
        PushNotifications.addListener('registration', ({ value }) => {
          void registerToken(value);
        }),
      );
      listenerHandles.push(
        PushNotifications.addListener('registrationError', (error) => {
          console.warn('[push] FCM registration error', error);
        }),
      );
      listenerHandles.push(
        PushNotifications.addListener('pushNotificationReceived', (_notification: PushNotificationSchema) => {
          // Deep-link routing is handled in TASK-4199 follow-up.
        }),
      );
      listenerHandles.push(
        PushNotifications.addListener('pushNotificationActionPerformed', (_action: ActionPerformed) => {
          // Deep-link routing is handled in TASK-4199 follow-up.
        }),
      );

      await PushNotifications.register();
    })();

    return () => {
      cancelled = true;
      void Promise.all(listenerHandles).then((listeners) => {
        listeners.forEach((listener) => listener.remove());
      });
    };
  }, [isAuthenticated, token]);
}
