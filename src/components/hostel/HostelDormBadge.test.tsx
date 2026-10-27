import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HostelDormBadge, { isHostelDorm, resolveGenderPolicy } from './HostelDormBadge';

describe('HostelDormBadge (HSL-002 / HSL-011: gender rule from the API only)', () => {
  it('detects hostel dorm accommodations from the API type, never from the listing name', () => {
    expect(isHostelDorm({ accommodationType: 'HostelDorm' })).toBe(true);
    expect(isHostelDorm({ propertyType: 'Hostel' })).toBe(true);
    expect(isHostelDorm({ propertyType: 'Entire Villa' })).toBe(false);
    // A name is not an input any more: a villa called "Dorm Retreat" is not a dorm.
    expect(isHostelDorm({ accommodationType: 'Hotel', propertyType: 'Villa', name: 'Bed in 6-Bed Mixed Dormitory' } as never)).toBe(false);
  });

  it('resolves the gender policy to the API value, or null when the API states none', () => {
    expect(resolveGenderPolicy('FemaleOnly')).toBe('FemaleOnly');
    expect(resolveGenderPolicy('MaleOnly')).toBe('MaleOnly');
    expect(resolveGenderPolicy('Mixed')).toBe('Mixed');
    expect(resolveGenderPolicy(undefined)).toBeNull();
    expect(resolveGenderPolicy(null)).toBeNull();
    expect(resolveGenderPolicy('something-else')).toBeNull();
  });

  it('renders base dorm badge and mixed gender badge', () => {
    render(<HostelDormBadge accommodationType="HostelDorm" genderPolicy="Mixed" />);
    expect(screen.getByTestId('hostel-dorm-base-badge')).toHaveTextContent('Hostel Dormitory · Sold by the Bed');
    expect(screen.getByTestId('hostel-gender-badge-mixed')).toHaveTextContent('Mixed Dorm');
  });

  it('renders the female-only and male-only chips from genderPolicy', () => {
    const { rerender } = render(<HostelDormBadge accommodationType="HostelDorm" genderPolicy="FemaleOnly" />);
    expect(screen.getByTestId('hostel-gender-badge-female')).toHaveTextContent('Female-Only Dorm');
    rerender(<HostelDormBadge accommodationType="HostelDorm" genderPolicy="MaleOnly" />);
    expect(screen.getByTestId('hostel-gender-badge-male')).toHaveTextContent('Male-Only Dorm');
  });

  it('does NOT guess a gender rule from the listing name: no policy from the API means no gender chip', () => {
    render(<HostelDormBadge accommodationType="HostelDorm" {...({ name: '6-Bed Female-Only Dorm' } as object)} />);
    expect(screen.getByTestId('hostel-dorm-base-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('hostel-gender-badge-female')).toBeNull();
    expect(screen.queryByTestId('hostel-gender-badge-male')).toBeNull();
    expect(screen.queryByTestId('hostel-gender-badge-mixed')).toBeNull();
  });

  it('makes no refund claim anywhere in the badge', () => {
    const { container } = render(<HostelDormBadge accommodationType="HostelDorm" genderPolicy="FemaleOnly" />);
    expect(container.textContent).not.toMatch(/refund/i);
  });

  it('renders nothing for regular hotel/villa listings', () => {
    const { container } = render(<HostelDormBadge propertyType="Villa" />);
    expect(container.firstChild).toBeNull();
  });
});
