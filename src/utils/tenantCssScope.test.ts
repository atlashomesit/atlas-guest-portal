import { describe, it, expect } from 'vitest';
import { scopeTenantCss, tenantScopeSelector } from './tenantCssScope';

/**
 * TASK-102428 — Tenant A's custom CSS must never bleed into Tenant B's portal.
 * Every rule is scoped under #tenant-theme-root[data-tenant="<slug>"].
 */
describe('scopeTenantCss — TASK-102428 per-tenant CSS isolation', () => {
  it('prefixes plain selectors with the tenant scope', () => {
    const out = scopeTenantCss('.btn { color: neon-green; }', 'tenant-a');
    expect(out).toBe('#tenant-theme-root[data-tenant="tenant-a"] .btn{ color: neon-green; }');
    expect(out).not.toContain('tenant-b');
  });

  it('scopes comma lists and preserves at-rule wrappers with scoped inners', () => {
    const out = scopeTenantCss(
      'h1, .title { margin: 0; } @media (max-width: 600px) { .btn { width: 100%; } }',
      'tenant-a',
    );
    expect(out).toContain('#tenant-theme-root[data-tenant="tenant-a"] h1');
    expect(out).toContain('#tenant-theme-root[data-tenant="tenant-a"] .title');
    expect(out).toContain('@media (max-width: 600px)');
    expect(out).toContain('#tenant-theme-root[data-tenant="tenant-a"] .btn');
  });

  it('maps :root to the tenant container and never double-scopes', () => {
    const scope = tenantScopeSelector('tenant-a');
    const out = scopeTenantCss(`:root { --x: 1; } ${scope} .btn { color: red; }`, 'tenant-a');
    expect(out).toContain(`${scope}{ --x: 1; }`);
    expect(out).not.toContain(`${scope} ${scope}`);
  });

  it('drops unsafe payloads instead of emitting them', () => {
    expect(scopeTenantCss('@import url("https://evil.example/x.css");', 'tenant-a')).toBe('');
    expect(scopeTenantCss('.a { background: url(javascript:alert(1)); }', 'tenant-a')).toBe('');
    expect(scopeTenantCss('.a { color: red; ', 'tenant-a')).toBe('');
    expect(scopeTenantCss('', 'tenant-a')).toBe('');
    expect(scopeTenantCss('.a { color: red; }', '')).toBe('');
  });

  it('different tenants get disjoint scopes', () => {
    expect(tenantScopeSelector('tenant-a')).not.toBe(tenantScopeSelector('tenant-b'));
    const outA = scopeTenantCss('.btn { color: green; }', 'tenant-a');
    expect(outA).not.toContain('tenant-b');
  });
});
