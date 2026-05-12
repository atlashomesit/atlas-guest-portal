import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage_Locations from './HomePage_Locations';

const listingsWithGaps = [
  undefined,
  { id: '101', title: 'Room 101' },
  { title: 'No ID' },
] as unknown[];

const trackEventMock = vi.fn();
let navigateMock: ReturnType<typeof vi.fn>;
let mockSearch = '';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: '/', search: mockSearch, hash: '' }),
    Link: ({ children, to, onClick }: { children: React.ReactNode; to: string | { pathname?: string }; onClick?: () => void }) => (
      <a href={typeof to === 'string' ? to : to.pathname} onClick={onClick}>
        {children}
      </a>
    ),
  };
});

vi.mock('../../../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

describe('HomePage_Locations', () => {
  beforeEach(() => {
    trackEventMock.mockReset();
    navigateMock = vi.fn();
    mockSearch = '';
  });

  it('renders without crashing when listings contain undefined or missing ids', async () => {
    render(
      <MemoryRouter>
        <HomePage_Locations listings={listingsWithGaps} />
      </MemoryRouter>
    );

    expect(await screen.findByText('Room 101')).toBeInTheDocument();
    await waitFor(() => expect(trackEventMock).toHaveBeenCalledWith(
      'listings_browse',
      expect.objectContaining({ surface: 'home_locations' }),
      expect.anything(),
    ));
  });

  it('emits listings browse analytics with query context', async () => {
    mockSearch = '?checkIn=2025-01-01&guests=2';

    render(
      <MemoryRouter initialEntries={[{ pathname: '/', search: mockSearch }]}>
        <HomePage_Locations listings={listingsWithGaps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith(
        'listings_browse',
        expect.objectContaining({
          surface: 'home_locations',
          checkIn: expect.stringContaining('2025-01-01'),
          guests: 2,
        }),
        { route: '/?checkIn=2025-01-01T00%3A00%3A00.000Z&guests=2#our-homes' },
      );
    });
  });

  it('preserves search params when navigating from hero CTAs', async () => {
    mockSearch = '?checkIn=2025-02-01&checkOut=2025-02-05&guests=4';

    render(
      <MemoryRouter initialEntries={[{ pathname: '/', search: mockSearch }]}>
        <HomePage_Locations />
      </MemoryRouter>
    );

    const cta = await screen.findByText('Check availability');
    fireEvent.click(cta);

    const [navigateArgs] = navigateMock.mock.calls[0] ?? [];
    expect(navigateArgs).toEqual(
      expect.objectContaining({
        pathname: expect.stringMatching(/^\/homes\//),
      }),
    );
    expect(decodeURIComponent(navigateArgs.search)).toContain('checkIn=2025-02-01T00:00:00.000Z');
    expect(decodeURIComponent(navigateArgs.search)).toContain('checkOut=2025-02-05T00:00:00.000Z');
    expect(decodeURIComponent(navigateArgs.search)).toContain('guests=4');

    await waitFor(() => {
      const selectionEvent = trackEventMock.mock.calls.find(([eventName]) => eventName === 'listing_selected');
      expect(selectionEvent?.[1]).toEqual(
        expect.objectContaining({ surface: 'home_locations', guests: 4 }),
      );
    });
  });
});
