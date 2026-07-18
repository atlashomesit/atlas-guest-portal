/**
 * The DEV-only `atlas-dev-theme` localStorage override used to be written on every mount
 * (the `else` branch of ThemeProvider's mount effect seeded it with `initialTheme`), and
 * honoured on every later mount. Since `initialTheme` is the tenant's boot-resolved color
 * preset (`main.tsx`, TASK-4903 wiring), browsing tenant A and then tenant B rendered B
 * with A's palette — a remembered value outranking the server's answer.
 *
 * The override is now gated on an explicit-choice marker that only `setTheme()` — i.e. only
 * the DevThemeSwitcher — writes. These tests pin both halves of that: a bare stored value
 * must not shadow the tenant, and a genuine pick must still survive a reload.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../ThemeProvider";

const STORAGE_KEY = "atlas-dev-theme";
const EXPLICIT_KEY = "atlas-dev-theme-explicit";

const TENANT_PRESET = "oceanLuxury";
const DEVELOPER_PICK = "royalViolet";

const activeTheme = () => document.documentElement.dataset.theme;

describe("ThemeProvider dev-only localStorage override", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("is DEV-gated, so these assertions describe real behaviour", () => {
    expect(import.meta.env.DEV).toBe(true);
  });

  it("renders the tenant's preset and stores nothing when no theme was ever picked", () => {
    render(<ThemeProvider initialTheme={TENANT_PRESET}>ok</ThemeProvider>);

    expect(activeTheme()).toBe(TENANT_PRESET);
    // The old `else` branch wrote here — that write is what later shadowed other tenants.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores a stored theme with no explicit-choice marker (tenant A must not leak into tenant B)", () => {
    // Exactly what a legacy build left behind after browsing a `royalViolet` tenant.
    localStorage.setItem(STORAGE_KEY, DEVELOPER_PICK);

    render(<ThemeProvider initialTheme={TENANT_PRESET}>ok</ThemeProvider>);

    expect(activeTheme()).toBe(TENANT_PRESET);
  });

  it("honours a stored theme when the explicit-choice marker is present", () => {
    localStorage.setItem(STORAGE_KEY, DEVELOPER_PICK);
    localStorage.setItem(EXPLICIT_KEY, "true");

    render(<ThemeProvider initialTheme={TENANT_PRESET}>ok</ThemeProvider>);

    expect(activeTheme()).toBe(DEVELOPER_PICK);
  });

  it("persists a DevThemeSwitcher pick across a reload, then releases it when the marker is cleared", () => {
    const first = render(
      <ThemeProvider initialTheme={TENANT_PRESET} enableDevSwitcher>
        ok
      </ThemeProvider>,
    );

    fireEvent.change(screen.getByLabelText("Select theme"), {
      target: { value: DEVELOPER_PICK },
    });

    expect(activeTheme()).toBe(DEVELOPER_PICK);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(DEVELOPER_PICK);
    expect(localStorage.getItem(EXPLICIT_KEY)).toBe("true");

    // Reload: the pick outranks the tenant preset, which is the switcher's whole purpose.
    first.unmount();
    const second = render(<ThemeProvider initialTheme={TENANT_PRESET}>ok</ThemeProvider>);
    expect(activeTheme()).toBe(DEVELOPER_PICK);

    // Clearing the marker hands control back to the tenant's resolved preset.
    second.unmount();
    localStorage.removeItem(EXPLICIT_KEY);
    render(<ThemeProvider initialTheme={TENANT_PRESET}>ok</ThemeProvider>);
    expect(activeTheme()).toBe(TENANT_PRESET);
  });
});
