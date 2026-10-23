import React, { useEffect, useState } from 'react';
import { buildApiUrl, getApiHeaders } from '../../api/client';

/**
 * BNB-009: the guest's meal choices, saved to the host through the booking-link token
 * (`POST /api/guest/bookings/{id}/meal-preferences?t=...`). The list of dietary options and
 * breakfast times is NOT defined here: it arrives in `mealPreferences.options` on the booking
 * summary (the API's single vocabulary), so the portal and the API can never drift apart.
 */

export interface MealOption {
  id: string;
  label: string;
  description?: string;
}

export interface GuestMealPreferences {
  /** Server decision: the booked plan includes a meal, or the property is a B&B / guesthouse / homestay. */
  offered: boolean;
  dietaryTags: string[];
  preferredBreakfastTime?: string | null;
  earlyPackedBreakfast: boolean;
  foodAllergies?: string | null;
  options: {
    dietaryTags: MealOption[];
    breakfastTimeSlots: MealOption[];
    maxFoodAllergiesLength: number;
  };
}

export interface GuestDietarySelectorProps {
  bookingId?: number | string | null;
  /** The booking-link token (`?t=`). Without it nothing can be saved, so nothing is shown. */
  token?: string | null;
  /**
   * The `mealPreferences` block of the booking summary the page already loaded. Pass `null` when the
   * summary has none. Leave it `undefined` and the component loads the summary itself.
   */
  mealPreferences?: GuestMealPreferences | null;
  className?: string;
}

const TAG_ICONS: Record<string, string> = {
  Veg: '🥬',
  NonVeg: '🍗',
  Jain: '🌱',
  Vegan: '🥑',
  GlutenFree: '🌾',
};

const draftKey = (bookingId: number | string) => `atlas_meal_draft_${bookingId}`;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const GuestDietarySelector: React.FC<GuestDietarySelectorProps> = ({
  bookingId,
  token,
  mealPreferences,
  className = '',
}) => {
  const [fetched, setFetched] = useState<GuestMealPreferences | null>(null);
  const needsFetch = mealPreferences === undefined && !!bookingId && !!token;

  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          buildApiUrl(`/api/guest/bookings/${bookingId}/summary?t=${encodeURIComponent(token as string)}`),
          { headers: { Accept: 'application/json', ...getApiHeaders() } },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { mealPreferences?: GuestMealPreferences | null };
        if (!cancelled && body.mealPreferences) setFetched(body.mealPreferences);
      } catch {
        /* the section simply stays hidden when the summary cannot be loaded */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsFetch, bookingId, token]);

  const prefs = mealPreferences === undefined ? fetched : mealPreferences;
  if (!bookingId || !token || !prefs || !prefs.offered || !prefs.options) return null;

  return (
    <MealForm
      key={String(bookingId)}
      bookingId={bookingId}
      token={token}
      prefs={prefs}
      className={className}
    />
  );
};

interface MealFormProps {
  bookingId: number | string;
  token: string;
  prefs: GuestMealPreferences;
  className: string;
}

const MealForm: React.FC<MealFormProps> = ({ bookingId, token, prefs, className }) => {
  const knownTagIds = prefs.options.dietaryTags.map((o) => o.id);
  const knownSlotIds = prefs.options.breakfastTimeSlots.map((o) => o.id);
  const maxAllergies = prefs.options.maxFoodAllergiesLength || 1000;

  // Pre-fill from what the host already has (the server). An unsaved draft from a failed save wins.
  const draft = (() => {
    try {
      const raw = localStorage.getItem(draftKey(bookingId));
      return raw ? (JSON.parse(raw) as Partial<{ tags: string[]; slot: string; packed: boolean; allergies: string }>) : null;
    } catch {
      return null;
    }
  })();

  const [tags, setTags] = useState<string[]>(() => {
    const source = Array.isArray(draft?.tags) ? draft!.tags! : prefs.dietaryTags ?? [];
    return knownTagIds.filter((id) => source.some((t) => t.toLowerCase() === id.toLowerCase()));
  });
  const [slot, setSlot] = useState<string>(() => {
    const v = typeof draft?.slot === 'string' ? draft.slot : prefs.preferredBreakfastTime ?? '';
    return knownSlotIds.includes(v) ? v : '';
  });
  const [packed, setPacked] = useState<boolean>(() =>
    typeof draft?.packed === 'boolean' ? draft.packed : !!prefs.earlyPackedBreakfast,
  );
  const [allergies, setAllergies] = useState<string>(() =>
    typeof draft?.allergies === 'string' ? draft.allergies : prefs.foodAllergies ?? '',
  );
  const [status, setStatus] = useState<SaveState>('idle');

  const touch = () => {
    if (status !== 'saving') setStatus('idle');
  };

  const toggleTag = (id: string) => {
    setTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
    touch();
  };

  const handleSave = async () => {
    setStatus('saving');
    const body = {
      dietaryTags: tags,
      preferredBreakfastTime: slot,
      earlyPackedBreakfast: packed,
      foodAllergies: allergies,
    };
    try {
      const res = await fetch(
        buildApiUrl(`/api/guest/bookings/${bookingId}/meal-preferences?t=${encodeURIComponent(token)}`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try {
        localStorage.removeItem(draftKey(bookingId));
      } catch {
        /* ignore storage errors */
      }
      setStatus('saved');
    } catch {
      // Offline draft only: keep what the guest typed so a retry (or a reload) does not lose it.
      try {
        localStorage.setItem(
          draftKey(bookingId),
          JSON.stringify({ tags, slot, packed, allergies }),
        );
      } catch {
        /* ignore storage errors */
      }
      setStatus('error');
    }
  };

  return (
    <div
      className={`rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 shadow-sm space-y-5 ${className}`}
      data-testid="guest-dietary-selector"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">🍳</span>
          <h3 className="text-lg font-bold text-emerald-950">Breakfast and food preferences</h3>
        </div>
        <p className="text-xs text-emerald-800 leading-relaxed">
          Tell your host what you eat and when you would like breakfast. Your choices go straight to the kitchen before you arrive.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900">
          What do you eat? (select all that apply)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {prefs.options.dietaryTags.map((item) => {
            const isChecked = tags.includes(item.id);
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
                  onChange={() => toggleTag(item.id)}
                  className="mt-0.5 h-4 w-4 rounded border-emerald-400 text-emerald-700 focus:ring-emerald-500"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span aria-hidden="true">{TAG_ICONS[item.id] ?? '🍽️'}</span>
                    <span className="font-semibold">{item.label}</span>
                  </div>
                  {item.description ? (
                    <p className="text-[11px] text-emerald-700/90 font-normal mt-0.5">{item.description}</p>
                  ) : null}
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
          When would you like breakfast?
        </label>
        <select
          id="breakfast-time-select"
          value={slot}
          onChange={(e) => {
            setSlot(e.target.value);
            touch();
          }}
          data-testid="breakfast-time-select"
          className="w-full sm:w-72 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-950 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">No preference</option>
          {prefs.options.breakfastTimeSlots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-emerald-900 cursor-pointer" data-testid="dietary-early-packed">
          <input
            type="checkbox"
            checked={packed}
            onChange={(e) => {
              setPacked(e.target.checked);
              touch();
            }}
            className="h-4 w-4 rounded border-emerald-400 text-emerald-700 focus:ring-emerald-500"
          />
          <span>I leave early, please pack my breakfast to take away</span>
        </label>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="dietary-notes"
          className="block text-xs font-bold uppercase tracking-wider text-emerald-900"
        >
          Food allergies or other notes (optional)
        </label>
        <textarea
          id="dietary-notes"
          rows={2}
          maxLength={maxAllergies}
          value={allergies}
          onChange={(e) => {
            setAllergies(e.target.value);
            touch();
          }}
          data-testid="dietary-notes-input"
          placeholder="e.g. nut allergy, lactose intolerance, mild spice for children"
          className="w-full rounded-xl border border-emerald-300 bg-white p-3 text-xs text-emerald-950 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving'}
          data-testid="save-dietary-btn"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 cursor-pointer disabled:opacity-60"
        >
          {status === 'saving' ? 'Saving...' : 'Save food preferences'}
        </button>

        {status === 'saved' && (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800"
            data-testid="dietary-save-status"
            role="status"
          >
            <span>✓</span>
            <span>Saved. Your host's kitchen will see this before you arrive.</span>
          </span>
        )}

        {status === 'error' && (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700"
            data-testid="dietary-save-error"
            role="alert"
          >
            We could not save your choices. Please check your connection and tap Save again.
          </span>
        )}
      </div>
    </div>
  );
};

export default GuestDietarySelector;
