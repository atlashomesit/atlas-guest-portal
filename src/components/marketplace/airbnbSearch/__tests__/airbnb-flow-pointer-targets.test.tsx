import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AirbnbSearchBar from '../AirbnbSearchBar';

vi.mock('@/api/publicCities', () => ({ fetchPublicCities: async () => [] }));

function mount(flow = true) {
  return render(<MemoryRouter initialEntries={['/search?brand=atlastays']}>
    <AirbnbSearchBar preserveFlowPointerTargets={flow} />
  </MemoryRouter>);
}

describe('marketplace in-flow pointer preservation', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('keeps the destination panel until the next native control completes its click', () => {
    mount();
    fireEvent.focus(screen.getByTestId('airbnb-search-destination'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const who = screen.getByTestId('airbnb-search-guests-trigger');
    fireEvent.mouseDown(who);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(who);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Guest selector' })).toBeInTheDocument();
  });

  it('lets Clear complete before an open guest panel collapses', () => {
    mount();
    fireEvent.change(screen.getByTestId('airbnb-search-destination'), { target: { value: 'Goa' } });
    fireEvent.click(screen.getByTestId('airbnb-search-guests-trigger'));
    const clear = screen.getByTestId('airbnb-search-clear');
    fireEvent.mouseDown(clear);
    expect(screen.getByRole('dialog', { name: 'Guest selector' })).toBeInTheDocument();
    fireEvent.click(clear);
    expect(screen.queryByRole('dialog', { name: 'Guest selector' })).not.toBeInTheDocument();
    expect(screen.getByTestId('airbnb-search-destination')).toHaveValue('');
    expect(screen.getByTestId('airbnb-search-guests-trigger')).toHaveTextContent('2 guests');
  });

  it('does not reopen suggestions from the previous edit after explicit selection', async () => {
    mount();
    const input = screen.getByTestId('airbnb-search-destination');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Go' } });
    fireEvent.click(screen.getByRole('option', { name: /^Goa/ }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('Goa');
  });

  it('cancels the previous edit callback when switching to Who', async () => {
    mount();
    fireEvent.change(screen.getByTestId('airbnb-search-destination'), { target: { value: 'Go' } });
    fireEvent.click(screen.getByTestId('airbnb-search-guests-trigger'));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Guest selector' })).toBeInTheDocument();
  });

  it('retains the original 300ms open delay while editing continues', async () => {
    mount();
    fireEvent.change(screen.getByTestId('airbnb-search-destination'), { target: { value: 'Go' } });
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('leaves default shared Search consumers on original mousedown dismissal', () => {
    mount(false);
    fireEvent.focus(screen.getByTestId('airbnb-search-destination'));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('airbnb-search-guests-trigger'));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog', { name: 'Guest selector' })).not.toBeInTheDocument();
  });
});
