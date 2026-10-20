import React, { useState } from 'react';

export type DietaryOption = 'Veg' | 'Jain' | 'Vegan' | 'Gluten-Free' | 'Early Packed Breakfast';

export interface GuestDietaryPreferences {
  dietaryOptions: DietaryOption[];
  breakfastTime: string;
  notes: string;
  guestCount?: number;
}

export interface GuestDietarySelectorProps {
  bookingRef?: string;
  initialPreferences?: Partial<GuestDietaryPreferences>;
  onSave?: (prefs: GuestDietaryPreferences) => void;
  className?: string;
}

export const DIETARY_OPTIONS: { id: DietaryOption; label: string; icon: string; description: string }[] = [
  { id: 'Veg', label: 'Vegetarian', icon: '🥬', description: 'Pure vegetarian meal (dairy included)' },
  { id: 'Jain', label: 'Jain', icon: '🌱', description: 'No root vegetables, onion, or garlic' },
  { id: 'Vegan', label: 'Vegan', icon: '🥑', description: '100% plant-based, strictly dairy-free' },
  { id: 'Gluten-Free', label: 'Gluten-Free', icon: '🌾', description: 'No wheat, maida, or gluten ingredients' },
  { id: 'Early Packed Breakfast', label: 'Early Packed Breakfast', icon: '🥪', description: 'Grab & go breakfast packed for travel before 7:00 AM' },
];

export const BREAKFAST_TIME_SLOTS = [
  '7:00 AM - 8:00 AM',
  '8:00 AM - 9:00 AM',
  '9:00 AM - 10:00 AM',
  'Early Packed (Before 7:00 AM)',
];

export const GuestDietarySelector: React.FC<GuestDietarySelectorProps> = ({
  bookingRef = 'general',
  initialPreferences,
  onSave,
  className = '',
}) => {
  const storageKey = `atlas_dietary_pref_${bookingRef}`;

  const [dietaryOptions, setDietaryOptions] = useState<DietaryOption[]>(() => {
    if (initialPreferences?.dietaryOptions) return initialPreferences.dietaryOptions;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.dietaryOptions)) return parsed.dietaryOptions;
      }
    } catch {
      /* ignore storage errors */
    }
    return ['Veg'];
  });

  const [breakfastTime, setBreakfastTime] = useState<string>(() => {
    if (initialPreferences?.breakfastTime) return initialPreferences.breakfastTime;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.breakfastTime) return parsed.breakfastTime;
      }
    } catch {
      /* ignore storage errors */
    }
    return '8:00 AM - 9:00 AM';
  });

  const [notes, setNotes] = useState<string>(() => {
    if (initialPreferences?.notes) return initialPreferences.notes;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.notes === 'string') return parsed.notes;
      }
    } catch {
      /* ignore storage errors */
    }
    return '';
  });

  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleOption = (option: DietaryOption) => {
    setDietaryOptions((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
    setSaveSuccess(false);
  };

  const handleSave = () => {
    const prefs: GuestDietaryPreferences = {
      dietaryOptions,
      breakfastTime,
      notes,
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch {
      /* ignore storage errors */
    }

    setSaveSuccess(true);
    onSave?.(prefs);
  };

  return (
    <div
      className={`rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 shadow-sm space-y-5 ${className}`}
      data-testid="guest-dietary-selector"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">🍳</span>
          <h3 className="text-lg font-bold text-emerald-950">
            Morning Breakfast & Dietary Preferences
          </h3>
        </div>
        <p className="text-xs text-emerald-800 leading-relaxed">
          Feeds your host's 7:00 AM Morning Breakfast Manifest so the kitchen team can prepare fresh, hot local dishes tailored to your dietary needs.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900">
          Dietary Requirements (Select all that apply)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {DIETARY_OPTIONS.map((item) => {
            const isChecked = dietaryOptions.includes(item.id);
            return (
              <label
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition select-none ${
                  isChecked
                    ? 'border-emerald-600 bg-emerald-100/70 text-emerald-950 shadow-2xs font-semibold'
                    : 'border-emerald-200/80 bg-white/80 text-emerald-900 hover:bg-emerald-50'
                }`}
                data-testid={`dietary-option-${item.id}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleOption(item.id)}
                  className="mt-0.5 h-4 w-4 rounded border-emerald-400 text-emerald-700 focus:ring-emerald-500"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span aria-hidden="true">{item.icon}</span>
                    <span className="font-semibold">{item.label}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700/90 font-normal mt-0.5">
                    {item.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="breakfast-time-select"
          className="block text-xs font-bold uppercase tracking-wider text-emerald-900"
        >
          Preferred Breakfast Time Slot
        </label>
        <select
          id="breakfast-time-select"
          value={breakfastTime}
          onChange={(e) => {
            setBreakfastTime(e.target.value);
            setSaveSuccess(false);
          }}
          data-testid="breakfast-time-select"
          className="w-full sm:w-72 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-950 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {BREAKFAST_TIME_SLOTS.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="dietary-notes"
          className="block text-xs font-bold uppercase tracking-wider text-emerald-900"
        >
          Kitchen Notes & Allergies (Optional)
        </label>
        <textarea
          id="dietary-notes"
          rows={2}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaveSuccess(false);
          }}
          data-testid="dietary-notes-input"
          placeholder="e.g. Mild spice for children, nut allergy, lactose intolerance, prefer south-indian filter coffee..."
          className="w-full rounded-xl border border-emerald-300 bg-white p-3 text-xs text-emerald-950 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          data-testid="save-dietary-btn"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 cursor-pointer"
        >
          Save Breakfast Preferences
        </button>

        {saveSuccess && (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800"
            data-testid="dietary-save-status"
            role="status"
          >
            <span>✓</span>
            <span>Saved! Sent to your host's 7:00 AM Morning Kitchen Manifest.</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default GuestDietarySelector;
