import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ageYearsFromDob,
  dormNeedsAgeAcknowledgement,
  formatDormMinAgeBadge,
  parseDormMinAge,
  readDormListingFields,
} from '@/utils/dormListing';
import { HostelDormBadge } from './HostelDormBadge';
import { DormRoomSelector } from './DormRoomSelector';
import { DormAgeAcknowledgement } from './DormAgeAcknowledgement';

describe('HSL-034: Dorm minimum age rule helpers & UI', () => {
  it('parses dormMinAge and formats 18+ badge copy', () => {
    expect(parseDormMinAge(18)).toBe(18);
    expect(parseDormMinAge('21')).toBe(21);
    expect(parseDormMinAge(null)).toBeNull();
    expect(parseDormMinAge(0)).toBeNull();
    expect(dormNeedsAgeAcknowledgement(18)).toBe(true);
    expect(dormNeedsAgeAcknowledgement(null)).toBe(false);
    expect(formatDormMinAgeBadge(18)).toBe('18+ only — under 18s must book a private room');
    expect(formatDormMinAgeBadge(16)).toBe('16+ only');

    const fields = readDormListingFields({
      accommodationType: 'HostelDorm',
      dormGenderPolicy: 'Mixed',
      quantity: 8,
      dormMinAge: 18,
    });
    expect(fields.dormMinAge).toBe(18);

    const ref = new Date('2026-11-27T00:00:00Z');
    expect(ageYearsFromDob('2010-05-01', ref)).toBe(16);
    expect(ageYearsFromDob('2000-05-01', ref)).toBe(26);
  });

  it('HostelDormBadge shows 18+ badge only on dorms with dormMinAge', () => {
    const { rerender } = render(
      <HostelDormBadge accommodationType="HostelDorm" genderPolicy="Mixed" dormMinAge={18} />,
    );
    expect(screen.getByTestId('hostel-dorm-min-age-badge')).toHaveTextContent(
      '18+ only — under 18s must book a private room',
    );

    rerender(<HostelDormBadge accommodationType="HostelDorm" genderPolicy="Mixed" dormMinAge={null} />);
    expect(screen.queryByTestId('hostel-dorm-min-age-badge')).toBeNull();
  });

  it('DormRoomSelector shows underage restriction notice and private rooms link for 18+ dorms', () => {
    render(
      <DormRoomSelector
        roomName="8-Bed Mixed Dorm"
        dormGenderPolicy="Mixed"
        dormMinAge={18}
        privateRoomsHref="/homes/zostel-goa"
      />,
    );
    expect(screen.getByTestId('dorm-age-restriction-notice')).toHaveTextContent(
      /Children and infants are not permitted in 18\+ shared dorms/i,
    );
    const link = screen.getByTestId('dorm-view-private-rooms-link');
    expect(link).toHaveAttribute('href', '/homes/zostel-goa');
  });

  it('DormAgeAcknowledgement blocks underage DOB and requires checkbox confirmation', () => {
    const onChange = vi.fn();
    const onDobChange = vi.fn();

    const { rerender } = render(
      <DormAgeAcknowledgement
        dormMinAge={18}
        accepted={false}
        onChange={onChange}
        youngestDob="2012-06-15"
        onYoungestDobChange={onDobChange}
        privateRoomsHref="/homes/zostel-goa"
      />,
    );

    expect(screen.getByTestId('dorm-age-underage-error')).toHaveTextContent(
      /Guests under 18 cannot stay in this shared dorm/i,
    );
    expect(screen.getByTestId('dorm-age-ack-checkbox')).toBeDisabled();

    rerender(
      <DormAgeAcknowledgement
        dormMinAge={18}
        accepted={false}
        onChange={onChange}
        youngestDob="1998-06-15"
        onYoungestDobChange={onDobChange}
        privateRoomsHref="/homes/zostel-goa"
      />,
    );

    expect(screen.queryByTestId('dorm-age-underage-error')).toBeNull();
    const checkbox = screen.getByTestId('dorm-age-ack-checkbox');
    expect(checkbox).not.toBeDisabled();
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
