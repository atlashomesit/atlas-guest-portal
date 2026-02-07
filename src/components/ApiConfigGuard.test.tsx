import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => '',
  getApiBaseUrlSafe: () => '',
  isApiBaseConfigured: () => false,
}));

import ApiConfigGuard from './ApiConfigGuard';

describe('ApiConfigGuard', () => {
  it('renders children when the API base URL is missing', () => {
    render(
      <ApiConfigGuard>
        <div>child</div>
      </ApiConfigGuard>
    );

    expect(screen.getByText('child')).toBeInTheDocument();
  });
});
