import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage_Locations from './HomePage_Locations';

const listingsWithGaps = [
  undefined,
  { id: '101', title: 'Atlas Homes Room 101' },
  { title: 'No ID' },
] as unknown[];

describe('HomePage_Locations', () => {
  it('renders without crashing when listings contain undefined or missing ids', () => {
    render(
      <MemoryRouter>
        <HomePage_Locations listings={listingsWithGaps} />
      </MemoryRouter>
    );

    expect(screen.getByText('Atlas Homes Room 101')).toBeInTheDocument();
  });
});
