import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PageNotFound from './PageNotFound';

describe('PageNotFound - Page not found heading', () => {
  it('renders h1 heading with "Home Not Found" text', () => {
    render(
      <BrowserRouter>
        <PageNotFound />
      </BrowserRouter>
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(/Home Not Found|not found/i);
  });
});
