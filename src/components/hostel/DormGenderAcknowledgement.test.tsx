import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DormGenderAcknowledgement from './DormGenderAcknowledgement';

describe('DormGenderAcknowledgement (HSL-011)', () => {
  it('women-only: a required tick, with the rule stated and NO refund claim', () => {
    const onChange = vi.fn();
    const { container } = render(<DormGenderAcknowledgement policy="FemaleOnly" accepted={false} onChange={onChange} />);
    expect(screen.getByTestId('dorm-gender-ack-card')).toHaveTextContent('Women-only dorm');
    expect(screen.getByTestId('dorm-gender-ack-text')).toHaveTextContent('This dorm is for women only');
    expect(screen.getByTestId('dorm-gender-ack-row')).toHaveTextContent('Required before you pay');
    expect(container.textContent).not.toMatch(/refund/i);
    expect(container.textContent).not.toMatch(/non-refundable/i);

    const box = screen.getByTestId('dorm-gender-ack-checkbox');
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('men-only: says men', () => {
    render(<DormGenderAcknowledgement policy="MaleOnly" accepted onChange={() => {}} />);
    expect(screen.getByTestId('dorm-gender-ack-card')).toHaveTextContent('Men-only dorm');
    expect(screen.getByTestId('dorm-gender-ack-checkbox')).toBeChecked();
  });

  it('shows the error under the tick', () => {
    render(<DormGenderAcknowledgement policy="FemaleOnly" accepted={false} onChange={() => {}} error="Please confirm the dorm rule to continue." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Please confirm the dorm rule to continue.');
  });

  it.each([['Mixed' as const], [null], [undefined]])('renders nothing for policy %s', (policy) => {
    const { container } = render(<DormGenderAcknowledgement policy={policy} accepted={false} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
