/**
 * TASK-102201 — Villa WiFi card: 1-click copy + scannable QR.
 *
 * Done-when:
 * 1. WiFi card renders SSID, password, and dynamically generated WiFi QR code.
 * 2. 1-click 'Copy Password' affordance with success toast (copy payload helper).
 */

export type WifiAuth = 'WPA' | 'WEP' | 'nopass';

export interface VillaWifi {
  ssid: string;
  password: string;
  auth: WifiAuth;
}

export function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:"'])/g, '\\$1');
}

export function buildWifiQrPayload(wifi: VillaWifi): string {
  if (wifi.auth === 'nopass') return `WIFI:T:nopass;S:${escapeWifiField(wifi.ssid)};;`;
  return `WIFI:T:${wifi.auth};S:${escapeWifiField(wifi.ssid)};P:${escapeWifiField(wifi.password)};;`;
}

export function wifiPasswordCopyPayload(wifi: VillaWifi): string {
  return wifi.password;
}

export function isWifiCardComplete(wifi: VillaWifi): boolean {
  if (!wifi.ssid.trim()) return false;
  if (wifi.auth !== 'nopass' && !wifi.password) return false;
  return true;
}
