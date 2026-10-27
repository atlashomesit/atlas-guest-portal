// GUEST-036 — paging the homepage date picker must not write a check-in, and the day a guest
// taps must be the day selected in the month they are looking at.
//
// RED before the fix: AirbnbSearchBar's onShownDateChange wrote startDate = first of the paged-to
// month, so paging to November planted a phantom check-in (1 Nov), the controlled `shownDate`
// prop followed it, and the grid snapped forward to November again after paging back.
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { format } from 'date-fns';

import AirbnbSearchBar from '../AirbnbSearchBar';
import { getIstCalendarDate } from '@/utils/date';
import { settle } from '../../../../test/settle';

const monthSelect = () => screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement;

describe('GUEST-036 AirbnbSearchBar date picker month state', () => {
  it('paging months plants no check-in and a tapped day is selected in the shown month', async () => {
    const today = getIstCalendarDate();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AirbnbSearchBar />
      </MemoryRouter>,
    );
    await settle();
    const when = screen.getByTestId('airbnb-search-when');
    const before = when.textContent;
    fireEvent.click(when);
    await settle();

    fireEvent.click(document.querySelector('.rdrNextButton') as HTMLElement);
    await settle();
    // Paging is navigation only: no date may be written.
    expect(when.textContent).toBe(before);

    fireEvent.click(document.querySelector('.rdrPprevButton') as HTMLElement);
    await settle();
    expect(monthSelect().value).toBe(String(today.getMonth()));
    expect(when.textContent).toBe(before);

    const cell = Array.from(document.querySelectorAll('.rdrDay:not(.rdrDayPassive):not(.rdrDayDisabled)')).find(
      (d) => d.textContent?.trim() === String(today.getDate()),
    ) as HTMLElement;
    const btn = (cell.tagName === 'BUTTON' ? cell : cell.querySelector('button')) as HTMLElement;
    fireEvent.mouseDown(btn);
    fireEvent.mouseUp(btn);
    await act(async () => {});

    expect(monthSelect().value).toBe(String(today.getMonth()));
    expect(screen.getByTestId('search-calendar-selection')).toHaveTextContent(format(today, 'd MMM yyyy'));
  });
});
