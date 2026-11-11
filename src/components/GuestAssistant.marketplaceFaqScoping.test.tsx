import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from '../test/settle';
import GuestAssistant from './GuestAssistant';

describe('GuestAssistant marketplace FAQ scoping (TASK-10298986)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes target tenantSlug and tenantId in headers and query params', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { q: 'What is check-in time?', a: 'Check-in is at 2:00 PM.' },
      ],
    });
    vi.stubGlobal('fetch', fetchSpy);

    render(
      <GuestAssistant
        listingId={42}
        tenantSlug="host-grove"
        tenantId={99}
      />
    );

    await settle();
    expect(fetchSpy).toHaveBeenCalled();

    const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];
    expect(calledUrl).toContain('/api/public/listings/42/faq?tenantId=99');
    expect(calledOptions.headers['X-Tenant-Slug']).toBe('host-grove');
    expect(calledOptions.headers['X-Tenant-Id']).toBe('99');

    // Trigger button should be rendered because FAQs are present
    expect(screen.getByRole('button', { name: /View frequently asked questions/i })).toBeDefined();
  });

  it('handles 404 response on marketplace gracefully without showing fatal error banner', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not found' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    render(
      <GuestAssistant
        listingId={42}
        tenantSlug="host-grove"
        tenantId={99}
      />
    );

    await settle();
    expect(fetchSpy).toHaveBeenCalled();

    // When FAQs return 404 / empty, widget silently suppresses trigger to avoid empty panel or error
    expect(screen.queryByText(/we couldn't load answers/i)).toBeNull();
  });
});
