export type CalendarRange = {
  startDate: Date;
  endDate: Date;
  key: "selection";
};

export type CalendarSelectionState = {
  range: CalendarRange;
  awaitingCheckout: boolean;
};

const normalizeRange = (startDate: Date, endDate: Date) =>
  startDate > endDate
    ? { startDate: endDate, endDate: startDate, key: "selection" as const }
    : { startDate, endDate, key: "selection" as const };

export const applyCalendarSelection = (
  state: CalendarSelectionState,
  selection: CalendarRange,
): CalendarSelectionState => {
  if (!state.awaitingCheckout) {
    return {
      awaitingCheckout: true,
      range: {
        startDate: selection.startDate,
        endDate: selection.startDate,
        key: "selection",
      },
    };
  }

  return {
    awaitingCheckout: false,
    range: normalizeRange(state.range.startDate, selection.endDate),
  };
};

export const shouldDispatchRange = (state: CalendarSelectionState) =>
  !state.awaitingCheckout && Boolean(state.range.startDate && state.range.endDate);
