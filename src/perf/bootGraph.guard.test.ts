import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * TASK-10299465: what the first page of the guest portal downloads. Measured 2026-11-10 with Lighthouse (mobile, throttled) on a production build:
 * the entry file statically imported the "maps" (200 KB) and "markdown" (115 KB) chunks because the old manualChunks function let Rolldown pull shared code
 * (React) into them, so every page, the home page included, paid for map and markdown code it never runs.
 *
 * These are source-level pins (a vitest run does not build the bundle); the built result is recorded in docs/ops in atlas-e2e.
 */
const root = path.resolve(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

describe('guest portal boot graph', () => {
  it('keeps the route-only chunk groups to their own modules (includeDependenciesRecursively: false)', () => {
    const config = read('vite.config.ts');
    expect(config).toContain('advancedChunks');
    expect(config).toContain('includeDependenciesRecursively: false');
    for (const group of ['maps', 'markdown', 'payment', 'vendor']) {
      expect(config).toContain(`name: "${group}"`);
    }
  });

  it('puts react-leaflet-cluster and leaflet.markercluster in the maps group (a prefix match, not a trailing slash)', () => {
    const config = read('vite.config.ts');
    const mapsLine = config.split('\n').find((line) => line.includes('name: "maps"')) ?? '';
    const test = mapsLine.match(/test: (\/.*\/),/)?.[1] ?? '';
    const regex = new RegExp(test.slice(1, -1));
    for (const id of [
      '/x/node_modules/leaflet/dist/leaflet-src.js',
      '/x/node_modules/react-leaflet/lib/index.js',
      '/x/node_modules/react-leaflet-cluster/lib/index.js',
      '/x/node_modules/@react-leaflet/core/lib/index.js',
    ]) {
      expect(regex.test(id)).toBe(true);
    }
    expect(regex.test('/x/node_modules/react/index.js')).toBe(false);
  });

  it('loads the assistant chat (react-markdown) only when a guest opens it', () => {
    const drawer = read('src/components/support-drawer/SupportDrawer.tsx');
    expect(drawer).toContain('lazy(() => import("./AtlasChat"))');
    expect(drawer).not.toMatch(/^import AtlasChat from/m);
  });
});
