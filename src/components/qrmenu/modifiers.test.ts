/**
 * POS-017 (guest half): pure rules for the QR menu modifier picker.
 * The API is the authority on prices and on what is allowed; these helpers only keep the guest from
 * sending a choice the server would refuse, in plain words, and never compute tax.
 */
import { describe, expect, it } from "vitest";
import {
  buildLineKey,
  formatDelta,
  groupError,
  groupRuleText,
  isOrderable,
  parseModifierGroups,
  selectedModifiers,
  selectionToPayload,
  toggleOption,
  unitPriceWithModifiers,
  validateSelection,
  type ModifierGroup,
} from "./modifiers";

const MILK: ModifierGroup = {
  id: "g-milk",
  name: "Milk choice",
  minSelection: 1,
  maxSelection: 1,
  options: [
    { id: "o-dairy", name: "Dairy milk", priceDelta: 0 },
    { id: "o-oat", name: "Oat milk", priceDelta: 40, dietaryFlag: "VEGAN" },
  ],
};
const EXTRAS: ModifierGroup = {
  id: "g-extra",
  name: "Extras",
  minSelection: 0,
  maxSelection: 2,
  options: [
    { id: "o-shot", name: "Extra shot", priceDelta: 30 },
    { id: "o-syrup", name: "Vanilla syrup", priceDelta: 20 },
    { id: "o-choc", name: "Chocolate", priceDelta: -5 },
  ],
};
const GROUPS = [MILK, EXTRAS];

describe("parseModifierGroups", () => {
  it("returns [] for anything that is not an array (older API / fallback menu)", () => {
    expect(parseModifierGroups(undefined)).toEqual([]);
    expect(parseModifierGroups(null)).toEqual([]);
    expect(parseModifierGroups({})).toEqual([]);
  });

  it("keeps only available options, drops a group left with none, coerces numbers", () => {
    const groups = parseModifierGroups([
      {
        id: "g1",
        name: "Spice",
        minSelection: "1",
        maxSelection: "1",
        options: [
          { id: "a", name: "Mild", priceDelta: "0" },
          { id: "b", name: "Hot", priceDelta: 10, isAvailable: false },
        ],
      },
      { id: "g2", name: "Empty", minSelection: 0, maxSelection: 1, options: [{ id: "x", name: "X", priceDelta: 1, isAvailable: false }] },
      { name: "No id", options: [{ id: "y", name: "Y", priceDelta: 0 }] },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("g1");
    expect(groups[0].minSelection).toBe(1);
    expect(groups[0].options.map((o) => o.id)).toEqual(["a"]);
    expect(groups[0].options[0].priceDelta).toBe(0);
  });

  it("never lets maxSelection fall below 1 or below minSelection", () => {
    const [g] = parseModifierGroups([
      { id: "g", name: "G", minSelection: 2, maxSelection: 0, options: [{ id: "a", name: "A", priceDelta: 0 }, { id: "b", name: "B", priceDelta: 0 }] },
    ]);
    expect(g.maxSelection).toBeGreaterThanOrEqual(2);
  });
});

describe("isOrderable", () => {
  it("is false when a group asks for more options than are available", () => {
    expect(isOrderable([{ ...MILK, minSelection: 3, maxSelection: 3 }])).toBe(false);
    expect(isOrderable(GROUPS)).toBe(true);
    expect(isOrderable([])).toBe(true);
  });
});

describe("plain wording", () => {
  it("describes each group's rule", () => {
    expect(groupRuleText(MILK)).toBe("Choose 1");
    expect(groupRuleText(EXTRAS)).toBe("Optional, up to 2");
    expect(groupRuleText({ ...EXTRAS, minSelection: 1, maxSelection: 3 })).toBe("Choose 1 to 3");
  });

  it("explains a missing required choice and an over-limit choice in plain words", () => {
    expect(groupError(MILK, [])).toBe("Choose 1 option for Milk choice.");
    expect(groupError({ ...MILK, minSelection: 2, maxSelection: 3 }, ["o-dairy"])).toBe("Choose at least 2 options for Milk choice.");
    expect(groupError(EXTRAS, ["o-shot", "o-syrup", "o-choc"])).toBe("You can choose at most 2 for Extras.");
    expect(groupError(MILK, ["o-oat"])).toBeNull();
    expect(groupError(EXTRAS, [])).toBeNull();
  });

  it("formats price deltas with a sign, blank for a free choice", () => {
    expect(formatDelta(0)).toBe("");
    expect(formatDelta(40)).toBe("+₹40");
    expect(formatDelta(-5)).toBe("-₹5");
    expect(formatDelta(12.5)).toBe("+₹12.5");
    expect(formatDelta(1500)).toBe("+₹1,500");
  });
});

describe("validateSelection", () => {
  it("returns an error per invalid group, keyed by group id", () => {
    expect(validateSelection(GROUPS, {})).toEqual({ "g-milk": "Choose 1 option for Milk choice." });
    expect(validateSelection(GROUPS, { "g-milk": ["o-oat"] })).toEqual({});
    expect(validateSelection(GROUPS, { "g-milk": ["o-oat"], "g-extra": ["o-shot", "o-syrup", "o-choc"] })).toEqual({
      "g-extra": "You can choose at most 2 for Extras.",
    });
  });
});

describe("toggleOption", () => {
  it("replaces the choice in a single-choice group", () => {
    expect(toggleOption(MILK, ["o-dairy"], "o-oat")).toEqual({ picked: ["o-oat"] });
  });

  it("adds and removes in a multi-choice group", () => {
    expect(toggleOption(EXTRAS, [], "o-shot")).toEqual({ picked: ["o-shot"] });
    expect(toggleOption(EXTRAS, ["o-shot"], "o-syrup")).toEqual({ picked: ["o-shot", "o-syrup"] });
    expect(toggleOption(EXTRAS, ["o-shot", "o-syrup"], "o-shot")).toEqual({ picked: ["o-syrup"] });
  });

  it("refuses a pick beyond the maximum and says why", () => {
    expect(toggleOption(EXTRAS, ["o-shot", "o-syrup"], "o-choc")).toEqual({
      picked: ["o-shot", "o-syrup"],
      blocked: "You can choose at most 2 for Extras.",
    });
  });

  it("ignores an option id that is not in the group", () => {
    expect(toggleOption(EXTRAS, ["o-shot"], "nope")).toEqual({ picked: ["o-shot"] });
  });
});

describe("payload, display and price", () => {
  const selection = { "g-extra": ["o-syrup", "o-shot"], "g-milk": ["o-oat"] };

  it("sends only group and option ids, in menu order (the server prices them)", () => {
    expect(selectionToPayload(GROUPS, selection)).toEqual([
      { groupId: "g-milk", optionId: "o-oat" },
      { groupId: "g-extra", optionId: "o-shot" },
      { groupId: "g-extra", optionId: "o-syrup" },
    ]);
  });

  it("builds the display snapshot with names and deltas", () => {
    expect(selectedModifiers(GROUPS, selection).map((m) => `${m.groupName}: ${m.optionName} ${m.priceDelta}`)).toEqual([
      "Milk choice: Oat milk 40",
      "Extras: Extra shot 30",
      "Extras: Vanilla syrup 20",
    ]);
  });

  it("gives the same cart line key for the same choices in any order, and a plain key with none", () => {
    const a = buildLineKey(11, selectionToPayload(GROUPS, selection));
    const b = buildLineKey(11, [...selectionToPayload(GROUPS, selection)].reverse());
    expect(a).toBe(b);
    expect(buildLineKey(11, [])).toBe("11");
    expect(a).not.toBe("11");
    expect(buildLineKey(11, [{ groupId: "g-milk", optionId: "o-dairy" }])).not.toBe(a);
  });

  it("shows menu price plus deltas, never below zero, paise-exact", () => {
    expect(unitPriceWithModifiers(200, selectedModifiers(GROUPS, selection))).toBe(290);
    expect(unitPriceWithModifiers(10, [{ groupId: "g", groupName: "G", optionId: "o", optionName: "O", priceDelta: -50 }])).toBe(0);
    expect(unitPriceWithModifiers(0.1, [{ groupId: "g", groupName: "G", optionId: "o", optionName: "O", priceDelta: 0.2 }])).toBe(0.3);
  });
});
