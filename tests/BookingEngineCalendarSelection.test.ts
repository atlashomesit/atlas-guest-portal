import { describe, expect, it } from "vitest";

import {
  applyCalendarSelection,
  shouldDispatchRange,
  type CalendarSelectionState,
} from "@/be/calendarSelection";

const buildSelection = (startDate: Date, endDate: Date) => ({
  startDate,
  endDate,
  key: "selection" as const,
});

const baseState: CalendarSelectionState = {
  awaitingCheckout: false,
  range: buildSelection(new Date("2024-01-01"), new Date("2024-01-02")),
};

describe("booking engine calendar selection", () => {
  it("treats the first click as check-in and waits for check-out", () => {
    const firstSelection = applyCalendarSelection(
      baseState,
      buildSelection(new Date("2024-02-10"), new Date("2024-02-10")),
    );

    expect(firstSelection.awaitingCheckout).toBe(true);
    expect(firstSelection.range.startDate).toEqual(new Date("2024-02-10"));
    expect(firstSelection.range.endDate).toEqual(new Date("2024-02-10"));
    expect(shouldDispatchRange(firstSelection)).toBe(false);

    const completedSelection = applyCalendarSelection(
      firstSelection,
      buildSelection(new Date("2024-02-10"), new Date("2024-02-15")),
    );

    expect(completedSelection.awaitingCheckout).toBe(false);
    expect(completedSelection.range.startDate).toEqual(new Date("2024-02-10"));
    expect(completedSelection.range.endDate).toEqual(new Date("2024-02-15"));
    expect(shouldDispatchRange(completedSelection)).toBe(true);
  });

  it("keeps cross-month selections ordered and intact", () => {
    const marchStart = new Date("2024-03-30");
    const aprilEnd = new Date("2024-04-02");

    const firstSelection = applyCalendarSelection(
      baseState,
      buildSelection(marchStart, marchStart),
    );
    const completedSelection = applyCalendarSelection(
      firstSelection,
      buildSelection(aprilEnd, aprilEnd),
    );

    expect(completedSelection.awaitingCheckout).toBe(false);
    expect(completedSelection.range.startDate).toEqual(marchStart);
    expect(completedSelection.range.endDate).toEqual(aprilEnd);
    expect(shouldDispatchRange(completedSelection)).toBe(true);
  });
});

