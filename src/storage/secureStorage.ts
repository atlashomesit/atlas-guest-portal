import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

/** TASK-4198 / epic §3.3 — Preferences on native, localStorage on web. */
export const storage = {
  get: (key: string) =>
    Capacitor.isNativePlatform()
      ? Preferences.get({ key }).then((r) => r.value)
      : Promise.resolve(localStorage.getItem(key)),
  set: (key: string, value: string) =>
    Capacitor.isNativePlatform()
      ? Preferences.set({ key, value })
      : Promise.resolve(localStorage.setItem(key, value)),
  remove: (key: string) =>
    Capacitor.isNativePlatform()
      ? Preferences.remove({ key })
      : Promise.resolve(localStorage.removeItem(key)),
};
