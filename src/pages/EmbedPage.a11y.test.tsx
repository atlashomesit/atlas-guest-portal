/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EmbedPage, { readableCtaText } from './EmbedPage';

vi.mock('@/runtime-config', () => ({ getApiBaseUrl: () => 'https://api.example.test' }));

const renderEmbed = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/embed/:embedKey" element={<EmbedPage />} /></Routes>
  </MemoryRouter>,
);

describe('EmbedPage state semantics', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('announces loading and API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderEmbed('/embed/demo');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })));
    renderEmbed('/embed/failing');
    expect(await screen.findByRole('alert')).toHaveTextContent('Booking widget unavailable');
  });

  it('chooses a readable CTA label for light and dark tenant colors', () => {
    expect(readableCtaText('#ffffff')).toBe('#111827');
    expect(readableCtaText('#fff')).toBe('#111827');
    expect(readableCtaText('#0f766e')).toBe('#ffffff');
  });
});
