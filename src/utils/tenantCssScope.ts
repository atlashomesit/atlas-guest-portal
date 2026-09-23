/**
 * TASK-102428 — scope tenant custom CSS so Tenant A's rules can never bleed into
 * Tenant B's portal.
 *
 * Board defect: tenant custom CSS cached/injected globally without a tenant scoping
 * prefix. Required fix: scope every rule under the tenant root container.
 *
 * Scope note: no tenant custom-CSS input/injector exists in this repo yet (the admin
 * custom-CSS field + atlas-api storage are the follow-up). This module is the shared,
 * tested scoping primitive that injector must use: every selector is rewritten under
 * `#tenant-theme-root[data-tenant="<slug>"]`, at-rules are preserved but their inner
 * selectors are scoped the same way, and unsafe payloads (`@import`, `url(javascript:)`,
 * unbalanced braces) are dropped rather than emitted.
 */

const SCOPE_ATTR = 'data-tenant';

export function tenantScopeSelector(tenantSlug: string): string {
  const slug = String(tenantSlug ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `#tenant-theme-root[${SCOPE_ATTR}="${slug}"]`;
}

function isUnsafeCss(css: string): boolean {
  const lowered = css.toLowerCase();
  if (lowered.includes('@import')) return true;
  if (/url\s*\(\s*['"]?\s*javascript:/.test(lowered)) return true;
  let depth = 0;
  for (const ch of css) {
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth < 0) return true;
    }
  }
  return depth !== 0;
}

function scopeSelectors(selectorText: string, scope: string): string {
  return selectorText
    .split(',')
    .map((part) => {
      const s = part.trim();
      if (!s) return '';
      // Never scope keyframe stops or already-scoped selectors twice.
      if (/^(from|to|\d+%)$/.test(s)) return s;
      if (s.startsWith(scope)) return s;
      // :root in tenant CSS means the tenant root container, not the document root.
      if (s.startsWith(':root')) return `${scope}${s.slice(':root'.length) || ''}`;
      return `${scope} ${s}`;
    })
    .filter(Boolean)
    .join(', ');
}

export function scopeTenantCss(rawCss: string | null | undefined, tenantSlug: string): string {
  const css = String(rawCss ?? '').trim();
  const slug = String(tenantSlug ?? '').trim();
  if (!css || !slug) return '';
  if (isUnsafeCss(css)) return '';
  const scope = tenantScopeSelector(slug);

  // Scope top-level rule selectors and the inner selectors of at-rule blocks
  // (@media / @supports), preserving the at-rule wrappers themselves. @keyframes
  // bodies (from/to/%) pass through untouched via scopeSelectors.
  let out = '';
  let i = 0;
  const pushRule = (selectors: string, body: string) => {
    const scoped = scopeSelectors(selectors, scope);
    if (scoped) out += `${scoped}{${body}}`;
  };

  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const head = css.slice(i, open).trim();
    let depth = 0;
    let close = open;
    for (; close < css.length; close += 1) {
      if (css[close] === '{') depth += 1;
      if (css[close] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const body = css.slice(open + 1, close);
    if (head.startsWith('@')) {
      // Re-scope rules nested inside the at-rule body.
      const inner = scopeTenantCssInner(body, scope);
      if (inner) out += `${head}{${inner}}`;
    } else {
      pushRule(head, body);
    }
    i = close + 1;
  }
  return out;
}

function scopeTenantCssInner(body: string, scope: string): string {
  let out = '';
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf('{', i);
    if (open === -1) break;
    const head = body.slice(i, open).trim();
    let depth = 0;
    let close = open;
    for (; close < body.length; close += 1) {
      if (body[close] === '{') depth += 1;
      if (body[close] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const innerBody = body.slice(open + 1, close);
    const scoped = scopeSelectors(head, scope);
    if (scoped) out += `${scoped}{${innerBody}}`;
    i = close + 1;
  }
  return out;
}
