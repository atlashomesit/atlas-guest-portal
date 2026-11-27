import React, { useState } from "react";
import { api } from "../../api/client";

export interface StayPreferenceOption {
  slug: string;
  label: string;
  emoji: string;
}

export const STAY_PREFERENCE_OPTIONS: readonly StayPreferenceOption[] = [
  { slug: "infant_crib", label: "Infant crib", emoji: "🍼" },
  { slug: "ground_floor_access", label: "Ground-floor access", emoji: "♿" },
  { slug: "quiet_room", label: "Quiet room", emoji: "🤫" },
  { slug: "extra_pillows", label: "Extra pillows", emoji: "🛏️" },
  { slug: "early_arrival", label: "Early arrival request", emoji: "⏰" },
  { slug: "celebration_setup", label: "Anniversary / birthday setup", emoji: "🎉" },
] as const;

export interface StayPreferenceChipsProps {
  selected: string[];
  onChange: (next: string[]) => void;
  title?: string;
  subtitle?: string;
  disabled?: boolean;
  testIdPrefix?: string;
}

export const StayPreferenceChips: React.FC<StayPreferenceChipsProps> = ({
  selected,
  onChange,
  title = "Quick stay preferences",
  subtitle = "Tap any requests so your host and housekeeping team can prepare ahead.",
  disabled = false,
  testIdPrefix = "stay-pref",
}) => {
  const toggle = (slug: string) => {
    if (disabled) return;
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  };

  return (
    <div
      data-testid={`${testIdPrefix}-container`}
      style={{
        borderRadius: 12,
        border: "1px solid var(--gd-border, #e2e8f0)",
        padding: "14px 16px",
        background: "var(--gd-surface, #ffffff)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gd-ink, #0f172a)" }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: "var(--gd-faint, #64748b)", marginTop: 2, marginBottom: 10 }}>
        {subtitle}
      </div>
      <div
        role="group"
        aria-label={title}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {STAY_PREFERENCE_OPTIONS.map((opt) => {
          const isSelected = selected.includes(opt.slug);
          return (
            <button
              key={opt.slug}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              disabled={disabled}
              data-testid={`${testIdPrefix}-chip-${opt.slug}`}
              onClick={() => toggle(opt.slug)}
              style={{
                minHeight: 44,
                padding: "8px 14px",
                borderRadius: 9999,
                border: isSelected
                  ? "1.5px solid var(--gd-accent, #0f766e)"
                  : "1px solid var(--gd-border, #cbd5e1)",
                background: isSelected
                  ? "var(--gd-accent-soft, #f0fdfa)"
                  : "var(--gd-bg, #f8fafc)",
                color: isSelected
                  ? "var(--gd-accent-text, #0f766e)"
                  : "var(--gd-ink, #1e293b)",
                fontSize: 13,
                fontWeight: isSelected ? 600 : 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 150ms ease",
                maxWidth: "100%",
                textAlign: "left",
              }}
            >
              <span aria-hidden="true">{opt.emoji}</span>
              <span>{opt.label}</span>
              {isSelected && <span aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export interface SelfCheckInStayPreferencesProps {
  bookingId: number;
  token: string;
  initialTags?: string[];
  initialNote?: string;
}

export const SelfCheckInStayPreferences: React.FC<SelfCheckInStayPreferencesProps> = ({
  bookingId,
  token,
  initialTags = [],
  initialNote = "",
}) => {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [note, setNote] = useState<string>(initialNote);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setStatus("idle");
    setErrorMsg(null);
    try {
      await api.patch(
        `/public/bookings/${bookingId}/stay-preferences`,
        {
          stayPreferenceTags: tags,
          notes: note.trim().slice(0, 500) || undefined,
        },
        { params: token ? { t: token } : undefined },
      );
      setStatus("saved");
    } catch {
      setStatus("error");
      setErrorMsg("Could not save preferences right now. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="self-checkin-stay-preferences" className="text-left">
      <StayPreferenceChips
        selected={tags}
        onChange={(next) => {
          setTags(next);
          if (status === "saved") setStatus("idle");
        }}
        title="Stay preferences"
        subtitle="Update your room setup requests before arrival."
        testIdPrefix="checkin-stay-pref"
      />
      <div className="mt-3">
        <label
          htmlFor="checkin-stay-pref-note"
          className="block text-xs font-medium text-text-secondary mb-1"
        >
          Optional note for your host
        </label>
        <textarea
          id="checkin-stay-pref-note"
          data-testid="checkin-stay-pref-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (status === "saved") setStatus("idle");
          }}
          placeholder="Any extra details for your stay…"
          className="w-full rounded-lg border border-border-subtle bg-bg-page px-3 py-2 text-sm text-text-primary"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          data-testid="checkin-stay-pref-save"
          className="min-h-[44px] rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60 transition"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        {status === "saved" && (
          <span data-testid="checkin-stay-pref-saved" className="text-xs font-semibold text-green-700">
            ✓ Preferences saved
          </span>
        )}
        {status === "error" && errorMsg && (
          <span data-testid="checkin-stay-pref-error" className="text-xs text-red-600">
            {errorMsg}
          </span>
        )}
      </div>
    </div>
  );
};

export default StayPreferenceChips;
