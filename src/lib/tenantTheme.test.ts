import { describe, it, expect } from 'vitest';
import { isTenantThemeValid, tenantThemeCssVars, tenantThemeDbRow } from './tenantTheme';

describe('TASK-102264 tenant theme customizer', () => {
  it('validates brand color + font tokens', () => {
    expect(isTenantThemeValid({ primaryColor: '#1d4ed8', accentColor: '#f59e0b', fontFamily: 'Inter' })).toBe(true);
    expect(isTenantThemeValid({ primaryColor: 'blue', accentColor: '#f59e0b', fontFamily: 'Inter' })).toBe(false);
  });

  it('serves live-preview CSS variables and a DB row', () => {
    const theme = { primaryColor: '#1d4ed8', accentColor: '#f59e0b', fontFamily: 'Inter' };
    expect(tenantThemeCssVars(theme)).toEqual({
      '--tenant-primary': '#1d4ed8', '--tenant-accent': '#f59e0b', '--tenant-font': 'Inter',
    });
    expect(tenantThemeDbRow('goan-hideaway', theme).tenant_slug).toBe('goan-hideaway');
  });
});
