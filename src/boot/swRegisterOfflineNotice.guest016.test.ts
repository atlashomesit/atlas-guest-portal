// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '../../public/sw-register.js'), 'utf8');

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
}
function runScript() {
  // eslint-disable-next-line no-new-func
  new Function(source)();
}

describe('G3 journey 16: the loading shell says so when the page is opened offline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="root"><div class="boot-shell" data-testid="boot-shell"></div></div>';
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    setOnline(true);
  });

  it('offline with the shell still showing after 4 s: a plain alert appears', () => {
    setOnline(false);
    runScript();
    expect(document.getElementById('boot-offline-notice')).toBeNull();
    vi.advanceTimersByTime(4100);
    const notice = document.getElementById('boot-offline-notice');
    expect(notice).not.toBeNull();
    expect(notice!.getAttribute('role')).toBe('alert');
    expect(notice!.textContent).toMatch(/offline/i);
  });

  it('online: nothing is added', () => {
    setOnline(true);
    runScript();
    vi.advanceTimersByTime(5000);
    expect(document.getElementById('boot-offline-notice')).toBeNull();
  });

  it('offline but the app has already replaced the shell: nothing is added', () => {
    setOnline(false);
    runScript();
    document.body.innerHTML = '<div id="root"><main>app</main></div>';
    vi.advanceTimersByTime(5000);
    expect(document.getElementById('boot-offline-notice')).toBeNull();
  });

  it('shows the notice once, however many times the browser reports offline', () => {
    setOnline(false);
    runScript();
    window.dispatchEvent(new Event('offline'));
    vi.advanceTimersByTime(9000);
    expect(document.querySelectorAll('#boot-offline-notice').length).toBe(1);
  });
});

describe('G3 journey 16: the script that carries the notice is itself available offline', () => {
  it('sw.js precaches /sw-register.js with the shell', () => {
    const sw = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');
    const line = sw.split('\n').find((l) => l.startsWith('const SHELL_URLS'));
    expect(line).toBeDefined();
    expect(line).toContain("'/sw-register.js'");
  });
});
