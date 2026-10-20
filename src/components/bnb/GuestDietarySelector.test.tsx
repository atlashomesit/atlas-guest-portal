import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GuestDietarySelector, { DIETARY_OPTIONS, BREAKFAST_TIME_SLOTS } from './GuestDietarySelector';

describe('GuestDietarySelector (BNB-002)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders dietary selection options and breakfast time slots', () => {
    render(<GuestDietarySelector bookingRef="BK-1234" />);

    expect(screen.getByTestId('guest-dietary-selector')).toBeInTheDocument();
    expect(screen.getByText('Morning Breakfast & Dietary Preferences')).toBeInTheDocument();
    expect(screen.getByText(/Feeds your host's 7:00 AM Morning Breakfast Manifest/)).toBeInTheDocument();

    for (const opt of DIETARY_OPTIONS) {
      expect(screen.getByTestId(`dietary-option-${opt.id}`)).toBeInTheDocument();
    }

    const select = screen.getByTestId('breakfast-time-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options).toHaveLength(BREAKFAST_TIME_SLOTS.length);
  });

  it('allows toggling multiple dietary requirements and typing notes', () => {
    const onSave = vi.fn();
    render(<GuestDietarySelector bookingRef="BK-1234" onSave={onSave} />);

    // Toggle Jain and Gluten-Free
    const jainInput = screen.getByTestId('dietary-option-Jain').querySelector('input')!;
    fireEvent.click(jainInput);

    const gfInput = screen.getByTestId('dietary-option-Gluten-Free').querySelector('input')!;
    fireEvent.click(gfInput);

    // Change breakfast time
    const select = screen.getByTestId('breakfast-time-select');
    fireEvent.change(select, { target: { value: '7:00 AM - 8:00 AM' } });

    // Type kitchen notes
    const notesInput = screen.getByTestId('dietary-notes-input');
    fireEvent.change(notesInput, { target: { value: 'Strict Jain breakfast for 2 adults' } });

    // Click Save
    const saveBtn = screen.getByTestId('save-dietary-btn');
    fireEvent.click(saveBtn);

    expect(screen.getByTestId('dietary-save-status')).toHaveTextContent(
      "Saved! Sent to your host's 7:00 AM Morning Kitchen Manifest."
    );

    expect(onSave).toHaveBeenCalledWith({
      dietaryOptions: expect.arrayContaining(['Veg', 'Jain', 'Gluten-Free']),
      breakfastTime: '7:00 AM - 8:00 AM',
      notes: 'Strict Jain breakfast for 2 adults',
    });

    // Check localStorage persistence
    const saved = JSON.parse(localStorage.getItem('atlas_dietary_pref_BK-1234') || '{}');
    expect(saved.breakfastTime).toBe('7:00 AM - 8:00 AM');
    expect(saved.notes).toBe('Strict Jain breakfast for 2 adults');
  });

  it('loads previously saved preferences from localStorage', () => {
    localStorage.setItem(
      'atlas_dietary_pref_BK-5678',
      JSON.stringify({
        dietaryOptions: ['Vegan', 'Early Packed Breakfast'],
        breakfastTime: 'Early Packed (Before 7:00 AM)',
        notes: 'Heading out for trek at 6:00 AM',
      })
    );

    render(<GuestDietarySelector bookingRef="BK-5678" />);

    const veganInput = screen.getByTestId('dietary-option-Vegan').querySelector('input')!;
    expect(veganInput).toBeChecked();

    const packedInput = screen.getByTestId('dietary-option-Early Packed Breakfast').querySelector('input')!;
    expect(packedInput).toBeChecked();

    const select = screen.getByTestId('breakfast-time-select') as HTMLSelectElement;
    expect(select.value).toBe('Early Packed (Before 7:00 AM)');

    const notesInput = screen.getByTestId('dietary-notes-input') as HTMLTextAreaElement;
    expect(notesInput.value).toBe('Heading out for trek at 6:00 AM');
  });
});
