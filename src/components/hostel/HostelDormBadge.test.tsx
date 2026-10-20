import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HostelDormBadge, { isHostelDorm, resolveGenderPolicy } from './HostelDormBadge';

describe('HostelDormBadge (HSL-002)', () => {
  it('correctly detects hostel dorm accommodations', () => {
    expect(isHostelDorm({ accommodationType: 'HostelDorm' })).toBe(true);
    expect(isHostelDorm({ propertyType: 'Hostel' })).toBe(true);
    expect(isHostelDorm({ name: 'Bed in 6-Bed Mixed Dormitory' })).toBe(true);
    expect(isHostelDorm({ name: 'Bunk Bed in Female Dorm' })).toBe(true);
    expect(isHostelDorm({ propertyType: 'Entire Villa' })).toBe(false);
  });

  it('resolves gender policy accurately', () => {
    expect(resolveGenderPolicy('FemaleOnly', 'Cozy Dorm')).toBe('FemaleOnly');
    expect(resolveGenderPolicy(undefined, '4-Bed Female-Only Dormitory')).toBe('FemaleOnly');
    expect(resolveGenderPolicy('MaleOnly', 'Dorm')).toBe('MaleOnly');
    expect(resolveGenderPolicy(undefined, 'Men-Only Dorm Room')).toBe('MaleOnly');
    expect(resolveGenderPolicy(undefined, '8-Bed Mixed Dormitory')).toBe('Mixed');
  });

  it('renders base dorm badge and mixed gender badge', () => {
    render(<HostelDormBadge accommodationType="HostelDorm" genderPolicy="Mixed" />);
    expect(screen.getByTestId('hostel-dorm-base-badge')).toHaveTextContent('Hostel Dormitory · Sold by the Bed');
    expect(screen.getByTestId('hostel-gender-badge-mixed')).toHaveTextContent('Mixed Dorm');
  });

  it('renders female-only badge and policy confirmation checkbox when requested', () => {
    const onConfirm = vi.fn();
    render(
      <HostelDormBadge
        accommodationType="HostelDorm"
        genderPolicy="FemaleOnly"
        showPolicyConfirmation={true}
        onPolicyConfirmed={onConfirm}
      />
    );

    expect(screen.getByTestId('hostel-gender-badge-female')).toHaveTextContent('Female-Only Dorm');
    const notice = screen.getByTestId('hostel-gender-policy-notice');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent('Strict Female-Only Policy');

    const checkbox = screen.getByTestId('hostel-gender-policy-checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it('renders male-only badge and notice', () => {
    render(
      <HostelDormBadge
        name="Bed in 6-Bed Male-Only Dorm"
        showPolicyConfirmation={true}
      />
    );

    expect(screen.getByTestId('hostel-gender-badge-male')).toHaveTextContent('Male-Only Dorm');
    expect(screen.getByTestId('hostel-gender-policy-notice')).toHaveTextContent('Strict Male-Only Policy');
  });

  it('renders nothing for regular hotel/villa listings', () => {
    const { container } = render(
      <HostelDormBadge propertyType="Villa" name="Oceanfront Luxury Villa" />
    );
    expect(container.firstChild).toBeNull();
  });
});
