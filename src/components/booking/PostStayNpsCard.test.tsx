import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PostStayNpsCard, classifyNpsScore } from './PostStayNpsCard';

describe('REV-078 PostStayNpsCard', () => {
  it('classifies Detractor, Passive, and Promoter scores accurately', () => {
    expect(classifyNpsScore(4)).toBe('Detractor');
    expect(classifyNpsScore(8)).toBe('Passive');
    expect(classifyNpsScore(10)).toBe('Promoter');
  });

  it('submits selected NPS score and comment', () => {
    const onSubmit = vi.fn();
    render(<PostStayNpsCard propertyName="Munnar Tea Villa" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.change(screen.getByLabelText(/Optional stay feedback/i), {
      target: { value: 'Warm hospitality!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit Rating/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      score: 9,
      category: 'Promoter',
      comment: 'Warm hospitality!',
    });
    expect(screen.getByTestId('post-stay-nps-submitted')).toBeTruthy();
  });
});
