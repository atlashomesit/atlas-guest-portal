import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DormGroupRosterForm, parseDormRosterCsv } from './DormGroupRosterForm';

describe('HSL-047 DormGroupRosterForm', () => {
  it('parses CSV group rooming list with header row', () => {
    const rows = parseDormRosterCsv(
      'Full Name,Gender,Phone,Bunk Preference\nAnanya Rao,Female,9876543210,Lower\nRohan Verma,Male,9876500000,Upper'
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      fullName: 'Ananya Rao',
      gender: 'Female',
      phone: '9876543210',
      bunkPreference: 'Lower',
    });
  });

  it('submits parsed sleepers up to maxBeds', () => {
    const onSubmit = vi.fn();
    render(<DormGroupRosterForm maxBeds={2} onSubmitRoster={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/Group rooming list CSV/i), {
      target: { value: 'Asha,Female,999,Lower\nDev,Male,888,Upper\nExtra,Male,777,Any' },
    });
    expect(screen.getByTestId('parsed-sleeper-count').textContent).toContain('2 sleeper(s)');
    fireEvent.click(screen.getByRole('button', { name: /Save Group Roster/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toHaveLength(2);
  });
});
