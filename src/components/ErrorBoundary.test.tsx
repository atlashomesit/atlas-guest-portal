import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('shows fallback UI and reloads when child throws', () => {
    const FailingComponent = () => {
      throw new Error('boom');
    };

    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    render(
      <ErrorBoundary>
        <FailingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-layout')).toBeInTheDocument();
    expect(screen.getByText(/we couldn’t load this page/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reloadSpy).toHaveBeenCalled();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
