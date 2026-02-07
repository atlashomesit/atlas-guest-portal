import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => '',
  getApiBaseUrlSafe: () => '',
  isApiBaseConfigured: () => false,
}));

import ApiConfigGuard from './ApiConfigGuard';

describe('ApiConfigGuard', () => {
  const originalLocation = window.location;
  const setHostname = (hostname: string) => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, hostname },
    });
  };

  beforeEach(() => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, hostname: 'atlashomestays.com', reload: reloadSpy },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('renders the shared error layout when the API base URL is missing on production hosts', () => {
    render(
      <ApiConfigGuard>
        <div>child</div>
      </ApiConfigGuard>
    );

    expect(screen.getByTestId('error-layout')).toBeInTheDocument();
    expect(screen.getByText(/we couldn’t load this page/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('renders children on non-production hosts when the API base URL is missing', () => {
    setHostname('dev.atlashomestays.com');

    render(
      <ApiConfigGuard>
        <div>child</div>
      </ApiConfigGuard>
    );

    expect(screen.getByText('child')).toBeInTheDocument();
  });
});
