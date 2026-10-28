import { useState } from "react";
import {
  dietaryLabel,
  formatDelta,
  groupError,
  groupRuleText,
  toggleOption,
  validateSelection,
  type ModifierGroup,
  type ModifierSelection,
} from "./modifiers";

export interface ModifierPickerProps {
  itemId: number;
  itemName: string;
  groups: ModifierGroup[];
  onAdd: (selection: ModifierSelection) => void;
  onCancel: () => void;
}

/**
 * POS-017 (guest half): the choices for one menu item. Min / max / required are enforced here in plain words, but the API
 * re-checks every pick and prices it from the catalogue, so nothing in this component is trusted for money. All text is
 * rendered as React text.
 */
export default function ModifierPicker({ itemId, itemName, groups, onAdd, onCancel }: ModifierPickerProps) {
  const [selection, setSelection] = useState<ModifierSelection>({});
  const [blocked, setBlocked] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);

  const onToggle = (group: ModifierGroup, optionId: string) => {
    const result = toggleOption(group, selection[group.id] ?? [], optionId);
    setSelection((prev) => ({ ...prev, [group.id]: result.picked }));
    setBlocked((prev) => {
      const next = { ...prev };
      if (result.blocked) next[group.id] = result.blocked;
      else delete next[group.id];
      return next;
    });
  };

  const handleAdd = () => {
    const errors = validateSelection(groups, selection);
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    onAdd(selection);
  };

  return (
    <div
      role="group"
      aria-label={`Choose options for ${itemName}`}
      data-testid={`modifier-picker-${itemId}`}
      style={{
        marginTop: "-4px",
        backgroundColor: "#fffaf6",
        border: "1px solid #ebd9c8",
        borderTop: "none",
        borderRadius: "0 0 14px 14px",
        padding: "12px 16px 14px 16px",
      }}
    >
      {groups.map((group) => {
        const picked = selection[group.id] ?? [];
        const useRadio = group.maxSelection === 1 && group.minSelection >= 1;
        const error = blocked[group.id] ?? (showErrors ? groupError(group, picked) : null);
        return (
          <fieldset key={group.id} style={{ border: "none", margin: "0 0 12px 0", padding: 0 }}>
            <legend style={{ padding: 0, marginBottom: "6px", fontSize: "13px", fontWeight: 800, color: "#1e1b18" }}>
              <span>{group.name}</span>{" "}
              <span style={{ fontWeight: 600, color: "#786a63", fontSize: "11px" }}>{groupRuleText(group)}</span>
            </legend>
            {group.options.map((option) => {
              const tag = dietaryLabel(option.dietaryFlag);
              const delta = formatDelta(option.priceDelta);
              return (
                <label
                  key={option.id}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", fontSize: "13px", color: "#2d2a26", cursor: "pointer" }}
                >
                  <input
                    type={useRadio ? "radio" : "checkbox"}
                    name={`modifier-${itemId}-${group.id}`}
                    checked={picked.includes(option.id)}
                    onChange={() => onToggle(group, option.id)}
                  />
                  <span style={{ flex: 1 }}>{option.name}</span>
                  {tag && <span style={{ fontSize: "11px", color: "#16a34a" }}>{tag}</span>}
                  {delta && <span style={{ fontWeight: 700, color: "#9e402a" }}>{delta}</span>}
                </label>
              );
            })}
            {error && (
              <div
                role="alert"
                data-testid={`modifier-error-${group.id}`}
                style={{ marginTop: "4px", fontSize: "12px", color: "#991b1b" }}
              >
                {error}
              </div>
            )}
          </fieldset>
        );
      })}

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          onClick={handleAdd}
          data-testid={`modifier-picker-add-${itemId}`}
          style={{
            flex: 1,
            backgroundColor: "#9e402a",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "9px 12px",
            fontWeight: 800,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Add to order
        </button>
        <button
          type="button"
          onClick={onCancel}
          data-testid={`modifier-picker-cancel-${itemId}`}
          style={{
            backgroundColor: "#fff",
            color: "#4a3e39",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "9px 12px",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
