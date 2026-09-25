import { describe, it, expect } from 'vitest';
import { buildWifiQrPayload, isWifiCardComplete, wifiPasswordCopyPayload } from './villaWifi';

describe('TASK-102201 villa WiFi QR + copy', () => {
  it('builds a scannable WPA payload', () => {
    expect(buildWifiQrPayload({ ssid: 'VillaSunset', password: 'sunset123', auth: 'WPA' }))
      .toBe('WIFI:T:WPA;S:VillaSunset;P:sunset123;;');
  });

  it('escapes delimiter characters in SSID/password', () => {
    expect(buildWifiQrPayload({ ssid: 'A;B', password: 'p,q', auth: 'WPA' }))
      .toBe('WIFI:T:WPA;S:A\\;B;P:p\\,q;;');
  });

  it('exposes the copy payload and completeness gate', () => {
    const wifi = { ssid: 'VillaSunset', password: 'sunset123', auth: 'WPA' as const };
    expect(wifiPasswordCopyPayload(wifi)).toBe('sunset123');
    expect(isWifiCardComplete(wifi)).toBe(true);
    expect(isWifiCardComplete({ ssid: ' ', password: 'x', auth: 'WPA' })).toBe(false);
  });
});
