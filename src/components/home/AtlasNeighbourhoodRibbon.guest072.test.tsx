/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../../tenant/tenantContext', () => ({ getTenantContext: () => ({ slug: 'atlas', isMarketplaceRoot: false }) }));
vi.mock('../../tenant/tenantOverrides', () => ({ getTenantOverrides: () => ({}), shouldHideAtlasBranding: () => false }));

import AtlasNeighbourhoodRibbon from './AtlasNeighbourhoodRibbon';

describe('AtlasNeighbourhoodRibbon closer (GUEST-072)', () => {
  test('never prints a fixed number of homes', () => {
    render(<MemoryRouter><AtlasNeighbourhoodRibbon variant="closer" homeCount={8} /></MemoryRouter>);
    const line = screen.getByLabelText('Neighbourhood note').textContent ?? '';
    expect(line).not.toMatch(/seven|\b7\b/i);
    expect(line).toContain('within a 4-minute walk of each other');
  });
  test('a single home makes no claim about "the homes"', () => {
    const { container } = render(<MemoryRouter><AtlasNeighbourhoodRibbon variant="closer" homeCount={1} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
