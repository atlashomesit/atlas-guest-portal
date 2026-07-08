import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StateMessage from '@/components/StateMessage';

// Mock the tenant context
vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => ({ slug: 'test' }),
}));

vi.mock('@/tenant/displayBrand', () => ({
  getTenantBrandName: () => 'Test Brand',
}));

describe('Listing not-found recovery (TASK-4518)', () => {
  it('should render StateMessage with recovery CTA for listing not found', () => {
    render(
      <BrowserRouter>
        <StateMessage
          data-testid="listing-not-found"
          icon="🏠"
          title="Home not found"
          message="We could not find that home on Test Brand. Let's get you back to browsing available stays."
          primaryAction={{ label: 'Browse Test Brand homes', to: '/' }}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Home not found')).toBeInTheDocument();
    expect(screen.getByText(/We could not find that home/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Browse.*homes/ })).toBeInTheDocument();
  });

  it('should display the recovery CTA with correct link', () => {
    render(
      <BrowserRouter>
        <StateMessage
          icon="🏠"
          title="Home not found"
          message="Test message"
          primaryAction={{ label: 'Browse homes', to: '/' }}
        />
      </BrowserRouter>
    );

    const link = screen.getByRole('link', { name: /Browse homes/ });
    expect(link).toHaveAttribute('href', '/');
  });
});
