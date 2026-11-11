/**
 * POS-017 (guest half): rules for the QR menu modifier picker.
 *
 * The API owns prices and permissions (`PosModifierRules`): it re-checks every pick against the item's groups and prices the
 * choices from the catalogue. These helpers only (a) read the groups defensively, (b) keep the guest from sending a choice the
 * server would refuse, in plain words, and (c) work out the number SHOWN in the cart (menu price + deltas, same floor at zero as
 * the server). Nothing here computes tax, and nothing here is sent as a price.
 */

export interface ModifierOption {
  id: string;
  name: string;
  /** Rupees added to (or, if negative, taken off) the item price. */
  priceDelta: number;
  dietaryFlag?: string | null;
  isAvailable?: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  /** 0 = optional; N = pick at least N. */
  minSelection: number;
  /** At most this many (always at least 1 and at least minSelection). */
  maxSelection: number;
  options: ModifierOption[];
}

/** groupId -> picked option ids. */
export type ModifierSelection = Record<string, string[]>;

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
  dietaryFlag?: string | null;
}

export interface ModifierPick {
  groupId: string;
  optionId: string;
}

const toInt = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const toMoney = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * The item's groups as the API sends them (`modifierGroups`, only available options). Defensive: anything that is not the expected
 * shape yields no groups, an option marked unavailable is dropped, and a group left with no option is dropped.
 */
export function parseModifierGroups(raw: unknown): ModifierGroup[] {
  if (!Array.isArray(raw)) return [];
  const groups: ModifierGroup[] = [];
  for (const g of raw) {
    if (!g || typeof g !== "object") continue;
    const rec = g as Record<string, unknown>;
    const id = toText(rec.id);
    const name = toText(rec.name);
    if (!id || !name) continue;
    const options: ModifierOption[] = [];
    if (Array.isArray(rec.options)) {
      for (const o of rec.options) {
        if (!o || typeof o !== "object") continue;
        const orec = o as Record<string, unknown>;
        const optionId = toText(orec.id);
        const optionName = toText(orec.name);
        if (!optionId || !optionName || orec.isAvailable === false) continue;
        options.push({
          id: optionId,
          name: optionName,
          priceDelta: toMoney(orec.priceDelta),
          dietaryFlag: typeof orec.dietaryFlag === "string" && orec.dietaryFlag.trim() ? orec.dietaryFlag.trim() : null,
          isAvailable: true,
        });
      }
    }
    if (options.length === 0) continue;
    const minSelection = Math.max(0, toInt(rec.minSelection, 0));
    const maxSelection = Math.max(1, minSelection, toInt(rec.maxSelection, 1));
    groups.push({ id, name, minSelection, maxSelection, options });
  }
  return groups;
}

/** False when a group asks for more options than exist (the guest could never satisfy it). */
export function isOrderable(groups: ModifierGroup[]): boolean {
  return groups.every((g) => g.minSelection <= g.options.length);
}

/** "Choose 1" / "Optional, up to 2" / "Choose 1 to 3". */
export function groupRuleText(group: ModifierGroup): string {
  if (group.minSelection === 0) return `Optional, up to ${group.maxSelection}`;
  if (group.minSelection === group.maxSelection) return `Choose ${group.minSelection}`;
  return `Choose ${group.minSelection} to ${group.maxSelection}`;
}

const plural = (n: number): string => (n === 1 ? "option" : "options");

/** Plain-words problem with this group's current picks, or null when fine. */
export function groupError(group: ModifierGroup, picked: string[]): string | null {
  const count = picked.length;
  if (count > group.maxSelection) return `You can choose at most ${group.maxSelection} for ${group.name}.`;
  if (count < group.minSelection) {
    return group.minSelection === group.maxSelection
      ? `Choose ${group.minSelection} ${plural(group.minSelection)} for ${group.name}.`
      : `Choose at least ${group.minSelection} ${plural(group.minSelection)} for ${group.name}.`;
  }
  return null;
}

/** Errors keyed by group id (only the invalid groups). */
export function validateSelection(groups: ModifierGroup[], selection: ModifierSelection): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const g of groups) {
    const error = groupError(g, selection[g.id] ?? []);
    if (error) errors[g.id] = error;
  }
  return errors;
}

/**
 * One tap on an option. A single-choice group swaps the pick; a multi-choice group adds or removes it, and refuses a pick beyond the
 * maximum (with the reason in `blocked`).
 */
export function toggleOption(group: ModifierGroup, picked: string[], optionId: string): { picked: string[]; blocked?: string } {
  if (!group.options.some((o) => o.id === optionId)) return { picked };
  if (picked.includes(optionId)) return { picked: picked.filter((id) => id !== optionId) };
  if (group.maxSelection === 1) return { picked: [optionId] };
  if (picked.length >= group.maxSelection) {
    return { picked, blocked: `You can choose at most ${group.maxSelection} for ${group.name}.` };
  }
  return { picked: [...picked, optionId] };
}

/** The choices in menu order (group order, then option order), as the order body wants them: ids only. */
export function selectionToPayload(groups: ModifierGroup[], selection: ModifierSelection): ModifierPick[] {
  const payload: ModifierPick[] = [];
  for (const g of groups) {
    const picked = selection[g.id] ?? [];
    for (const o of g.options) {
      if (picked.includes(o.id)) payload.push({ groupId: g.id, optionId: o.id });
    }
  }
  return payload;
}

/** The same choices with names and deltas, for the cart line. */
export function selectedModifiers(groups: ModifierGroup[], selection: ModifierSelection): SelectedModifier[] {
  const result: SelectedModifier[] = [];
  for (const g of groups) {
    const picked = selection[g.id] ?? [];
    for (const o of g.options) {
      if (picked.includes(o.id)) {
        result.push({
          groupId: g.id,
          groupName: g.name,
          optionId: o.id,
          optionName: o.name,
          priceDelta: o.priceDelta,
          dietaryFlag: o.dietaryFlag ?? null,
        });
      }
    }
  }
  return result;
}

/** Cart line identity: the item alone, or the item plus its sorted choices (the same choices in any order are one line). */
export function buildLineKey(itemId: number, picks: ModifierPick[]): string {
  if (picks.length === 0) return String(itemId);
  const parts = picks.map((p) => `${p.groupId}:${p.optionId}`).sort();
  return `${itemId}|${parts.join("|")}`;
}

/** What the cart shows per unit: menu price + deltas, never below zero, paise-exact (the server applies the same rule). */
export function unitPriceWithModifiers(basePrice: number, modifiers: Pick<SelectedModifier, "priceDelta">[]): number {
  const cents = Math.round(basePrice * 100) + modifiers.reduce((sum, m) => sum + Math.round(m.priceDelta * 100), 0);
  return Math.max(0, cents) / 100;
}

const rupees = (n: number): string => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** "+₹40" / "-₹5"; blank for a free choice. */
export function formatDelta(delta: number): string {
  if (!delta) return "";
  return `${delta > 0 ? "+" : "-"}₹${rupees(Math.abs(delta))}`;
}

const DIETARY_LABELS: Record<string, string> = {
  VEG: "Veg",
  NON_VEG: "Non-veg",
  VEGAN: "Vegan",
  EGG: "Contains egg",
  JAIN: "Jain",
  GLUTEN_FREE: "Gluten free",
  CONTAINS_NUTS: "Contains nuts",
};

export function dietaryLabel(flag: string | null | undefined): string | null {
  if (!flag) return null;
  const key = flag.trim().toUpperCase();
  return DIETARY_LABELS[key] ?? null;
}

/** "Milk choice: Oat milk (+₹40), Extras: Extra shot" - the line text under the item name. */
export function describeModifiers(modifiers: SelectedModifier[]): string {
  const byGroup: { name: string; parts: string[] }[] = [];
  for (const m of modifiers) {
    let entry = byGroup.find((e) => e.name === m.groupName);
    if (!entry) {
      entry = { name: m.groupName, parts: [] };
      byGroup.push(entry);
    }
    const delta = formatDelta(m.priceDelta);
    entry.parts.push(delta ? `${m.optionName} (${delta})` : m.optionName);
  }
  return byGroup.map((e) => `${e.name}: ${e.parts.join(", ")}`).join("; ");
}
