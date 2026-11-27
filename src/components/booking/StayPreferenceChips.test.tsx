import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  StayPreferenceChips,
  SelfCheckInStayPreferences,
  STAY_PREFERENCE_OPTIONS,
} from "./StayPreferenceChips";
import { api } from "../../api/client";

vi.mock("../../api/client", () => ({
  api: {
    patch: vi.fn(),
  },
}));

describe("StayPreferenceChips (GUEST-090)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all 6 preference chips with >=44px touch target", () => {
    const onChange = vi.fn();
    render(<StayPreferenceChips selected={[]} onChange={onChange} />);

    for (const opt of STAY_PREFERENCE_OPTIONS) {
      const chip = screen.getByTestId(`stay-pref-chip-${opt.slug}`);
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveAttribute("aria-checked", "false");
      expect(chip.style.minHeight).toBe("44px");
    }
  });

  it("toggles chips on and off", () => {
    const onChange = vi.fn();
    const { rerender } = render(<StayPreferenceChips selected={[]} onChange={onChange} />);

    fireEvent.click(screen.getByTestId("stay-pref-chip-infant_crib"));
    expect(onChange).toHaveBeenCalledWith(["infant_crib"]);

    rerender(<StayPreferenceChips selected={["infant_crib"]} onChange={onChange} />);
    expect(screen.getByTestId("stay-pref-chip-infant_crib")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByTestId("stay-pref-chip-infant_crib"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("saves stay preferences in SelfCheckInStayPreferences via PATCH", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { ok: true } });

    render(
      <SelfCheckInStayPreferences
        bookingId={42}
        token="tok-abc"
        initialTags={["quiet_room"]}
      />,
    );

    fireEvent.click(screen.getByTestId("checkin-stay-pref-chip-extra_pillows"));
    fireEvent.change(screen.getByTestId("checkin-stay-pref-note"), {
      target: { value: "Arriving around 11 AM" },
    });
    fireEvent.click(screen.getByTestId("checkin-stay-pref-save"));

    await waitFor(() => {
      expect(screen.getByTestId("checkin-stay-pref-saved")).toBeInTheDocument();
    });

    expect(api.patch).toHaveBeenCalledWith(
      "/public/bookings/42/stay-preferences",
      {
        stayPreferenceTags: ["quiet_room", "extra_pillows"],
        notes: "Arriving around 11 AM",
      },
      { params: { t: "tok-abc" } },
    );
  });
});
