import { describe, it, expect } from 'vitest';
import { onRequestGet } from './robots.txt';

/**
 * TASK-7866 regression (prod-environment-indexing, 2026-09-17): production Cloudflare Pages
 * hosts set ATLAS_ENVIRONMENT to the literal "prod", not "production" — verified with
 * GET /.well-known/atlas-runtime-config.json on atlashomestays.com, www.atlashomestays.com,
 * atlashomes.in, atlastays.com and millionairesmansion.atlastays.com, all of which returned
 * `"environment": "prod"`. The old check here (`!environment || environment === "production"`)
 * only recognised an empty value or the exact string "production", so every real prod host
 * served the qa/dev Disallow: / body — de-indexing the entire guest-portal marketplace and
 * every white-label site from search engines.
 *
 * This file pins the full truth table via functions/_lib/environment.ts's
 * isProductionEnvironment(). Before that helper existed, every "prod" case below failed
 * against the old inline check (captured in the PR description as the red run).
 */
describe('robots.txt production-environment detection (TASK-7866)', () => {
  const call = (environment?: string, url = 'https://atlashomestays.com/robots.txt') =>
    onRequestGet({
      request: new Request(url),
      env: environment === undefined ? {} : { ATLAS_ENVIRONMENT: environment },
    });

  const expectProductionBody = async (environment?: string) => {
    const body = await (await call(environment)).text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Allow: /');
    expect(body).toContain('Sitemap: https://atlashomestays.com/sitemap.xml');
    expect(body).not.toContain('Disallow: /');
  };

  const expectDisallowBody = async (environment?: string) => {
    const body = await (await call(environment)).text();
    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Allow: /');
    expect(body).not.toContain('Sitemap:');
  };

  it('serves the production body for the real prod value', async () => {
    await expectProductionBody('prod');
  });

  it('serves the production body for the literal word "production"', async () => {
    await expectProductionBody('production');
  });

  it('serves the production body when ATLAS_ENVIRONMENT is unset', async () => {
    await expectProductionBody(undefined);
  });

  it('treats "prod" case-insensitively and trims whitespace', async () => {
    await expectProductionBody('  PROD  ');
  });

  it('serves Disallow: / for qa', async () => {
    await expectDisallowBody('qa');
  });

  it('serves Disallow: / for dev', async () => {
    await expectDisallowBody('dev');
  });

  it('serves Disallow: / for an unrecognised environment value', async () => {
    await expectDisallowBody('staging');
  });

  it('serves Disallow: / for a near-miss typo of "production"', async () => {
    await expectDisallowBody('productionx');
  });

  it('keeps the showcase host on Disallow: / even with the real prod environment value', async () => {
    const body = await (
      await call('prod', 'https://atlas-showcase.atlastays.com/robots.txt')
    ).text();

    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Sitemap:');
  });
});
