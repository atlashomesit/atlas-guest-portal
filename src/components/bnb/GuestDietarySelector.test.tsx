import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { settle } from '../../test/settle';
import GuestDietarySelector, { type GuestMealPreferences } from './GuestDietarySelector';

// The option lists below stand in for what the API returns in `mealPreferences.options`
// (Atlas.Api.Constants.BnBMealVocabulary). The component must render exactly what it is given.
const OPTIONS: GuestMealPreferences['options'] = {
  dietaryTags: [
    { id: 'Veg', label: 'Vegetarian', description: 'Vegetarian meals (dairy included)' },
    { id: 'Jain', label: 'Jain', description: 'No root vegetables, onion or garlic' },
    { id: 'GlutenFree', label: 'Gluten-free' },
  ],
  breakfastTimeSlots: [
    { id: '07:00 AM', label: '7:00 AM' },
    { id: '08:30 AM', label: '8:30 AM' },
  ],
  maxFoodAllergiesLength: 1000,
};

function prefs(over: Partial<GuestMealPreferences> = {}): GuestMealPreferences {
  return {
    offered: true,
    dietaryTags: [],
    preferredBreakfastTime: null,
    earlyPackedBreakfast: false,
    foodAllergies: null,
    options: OPTIONS,
    ...over,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GuestDietarySelector (BNB-009)', () => {
  it('renders exactly the options the API sent, with no plan jargon', () => {
    render(<GuestDietarySelector bookingId={101} token="tok" mealPreferences={prefs()} />);

    expect(screen.getByTestId('guest-dietary-selector')).toBeInTheDocument();
    for (const o of OPTIONS.dietaryTags) {
      expect(screen.getByTestId(`dietary-option-${o.id}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('dietary-option-Vegan')).not.toBeInTheDocument();
    const select = screen.getByTestId('breakfast-time-select') as HTMLSelectElement;
    // "No preference" + the API slots
    expect(select.options).toHaveLength(OPTIONS.breakfastTimeSlots.length + 1);

    const text = screen.getByTestId('guest-dietary-selector').textContent ?? '';
    expect(text).not.toMatch(/\b(CP|MAP|AP|EP)\b/);
    expect(text).not.toMatch(/manifest/i);
  });

  it('is hidden for a room-only booking (server says not offered)', () => {
    render(<GuestDietarySelector bookingId={101} token="tok" mealPreferences={prefs({ offered: false })} />);
    expect(screen.queryByTestId('guest-dietary-selector')).not.toBeInTheDocument();
  });

  it('is hidden when the summary carries no meal block, or there is no token', () => {
    const { rerender } = render(<GuestDietarySelector bookingId={101} token="tok" mealPreferences={null} />);
    expect(screen.queryByTestId('guest-dietary-selector')).not.toBeInTheDocument();
    rerender(<GuestDietarySelector bookingId={101} token={null} mealPreferences={prefs()} />);
    expect(screen.queryByTestId('guest-dietary-selector')).not.toBeInTheDocument();
  });

  it('pre-fills from the server, not from localStorage', () => {
    localStorage.setItem(
      'atlas_dietary_pref_101',
      JSON.stringify({ dietaryOptions: ['Vegan'], breakfastTime: '9:00', notes: 'stale browser value' }),
    );
    render(
      <GuestDietarySelector
        bookingId={101}
        token="tok"
        mealPreferences={prefs({
          dietaryTags: ['jain'],
          preferredBreakfastTime: '08:30 AM',
          earlyPackedBreakfast: true,
          foodAllergies: 'peanuts',
        })}
      />,
    );

    expect(screen.getByTestId('dietary-option-Jain').querySelector('input')).toBeChecked();
    expect(screen.getByTestId('dietary-option-Veg').querySelector('input')).not.toBeChecked();
    expect((screen.getByTestId('breakfast-time-select') as HTMLSelectElement).value).toBe('08:30 AM');
    expect(screen.getByTestId('dietary-early-packed').querySelector('input')).toBeChecked();
    expect((screen.getByTestId('dietary-notes-input') as HTMLTextAreaElement).value).toBe('peanuts');
  });

  it('shows "saved" only after a 2xx, and posts the choices with the booking token', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    render(<GuestDietarySelector bookingId={101} token="tok/1" mealPreferences={prefs()} />);

    fireEvent.click(screen.getByTestId('dietary-option-Jain').querySelector('input')!);
    fireEvent.change(screen.getByTestId('breakfast-time-select'), { target: { value: '07:00 AM' } });
    fireEvent.change(screen.getByTestId('dietary-notes-input'), { target: { value: 'nut allergy' } });

    expect(screen.queryByTestId('dietary-save-status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('save-dietary-btn'));

    await settle();
    expect(screen.getByTestId('dietary-save-status')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/guest/bookings/101/meal-preferences?t=tok%2F1');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      dietaryTags: ['Jain'],
      preferredBreakfastTime: '07:00 AM',
      earlyPackedBreakfast: false,
      foodAllergies: 'nut allergy',
    });
    expect(screen.queryByTestId('dietary-save-error')).not.toBeInTheDocument();
  });

  it('a failed POST shows a retry message, never "saved", and keeps an offline draft', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    render(<GuestDietarySelector bookingId={101} token="tok" mealPreferences={prefs()} />);

    fireEvent.change(screen.getByTestId('dietary-notes-input'), { target: { value: 'shellfish' } });
    fireEvent.click(screen.getByTestId('save-dietary-btn'));

    await settle();
    expect(screen.getByTestId('dietary-save-error')).toBeInTheDocument();
    expect(screen.getByTestId('dietary-save-error')).toHaveTextContent(/could not save.*save again/i);
    expect(screen.queryByTestId('dietary-save-status')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('atlas_meal_draft_101') ?? '{}').allergies).toBe('shellfish');
  });

  it('a network failure also shows the retry message, not "saved"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<GuestDietarySelector bookingId={101} token="tok" mealPreferences={prefs()} />);

    fireEvent.click(screen.getByTestId('save-dietary-btn'));

    await settle();
    expect(screen.getByTestId('dietary-save-error')).toBeInTheDocument();
    expect(screen.queryByTestId('dietary-save-status')).not.toBeInTheDocument();
  });

  it('clears the offline draft once a save succeeds', async () => {
    localStorage.setItem('atlas_meal_draft_101', JSON.stringify({ tags: ['Veg'], slot: '', packed: false, allergies: 'x' }));
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    render(<GuestDietarySelector bookingId={101} token="tok" mealPreferences={prefs()} />);

    // the draft is restored into the form
    expect((screen.getByTestId('dietary-notes-input') as HTMLTextAreaElement).value).toBe('x');
    fireEvent.click(screen.getByTestId('save-dietary-btn'));

    await settle();
    expect(screen.getByTestId('dietary-save-status')).toBeInTheDocument();
    expect(localStorage.getItem('atlas_meal_draft_101')).toBeNull();
  });

  it('loads the summary itself when the page did not pass one, and shows the block when offered', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ mealPreferences: prefs({ dietaryTags: ['Veg'] }) }), { status: 200 }),
    );
    render(<GuestDietarySelector bookingId={101} token="tok" />);

    await settle();
    expect(screen.getByTestId('guest-dietary-selector')).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/guest/bookings/101/summary?t=tok');
    expect(screen.getByTestId('dietary-option-Veg').querySelector('input')).toBeChecked();
  });

  it('stays hidden when the summary it loads says not offered', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ mealPreferences: prefs({ offered: false }) }), { status: 200 }),
    );
    render(<GuestDietarySelector bookingId={101} token="tok" />);

    await settle();
    expect(fetchMock).toHaveBeenCalled();
    expect(screen.queryByTestId('guest-dietary-selector')).not.toBeInTheDocument();
  });
});
