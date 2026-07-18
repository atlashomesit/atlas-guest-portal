import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { applyTheme, availableThemes, DEFAULT_THEME, type ThemeName } from "../styles/theme";
import { themeOptions } from "./themes";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

type ThemeProviderProps = {
  initialTheme?: ThemeName;
  children: React.ReactNode;
  enableDevSwitcher?: boolean;
};

const isThemeName = (value: string): value is ThemeName =>
  (availableThemes as string[]).includes(value);

const DEV_LOCAL_STORAGE_KEY = "atlas-dev-theme";
// Set only by `setTheme()` — i.e. only when a developer picks a theme in the DevThemeSwitcher.
// Without it the stored theme is ignored, so a value left behind by an earlier tenant's boot
// cannot shadow the next tenant's server-resolved preset. Clear it (or use a fresh profile) to
// go back to following the tenant.
const DEV_EXPLICIT_CHOICE_KEY = "atlas-dev-theme-explicit";

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  initialTheme = DEFAULT_THEME,
  children,
  enableDevSwitcher = false,
}) => {
  const [theme, setThemeState] = useState<ThemeName>(initialTheme);

  // Future persistence hook (front office ready)
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Optional dev-only localStorage override. Honoured ONLY for an explicit DevThemeSwitcher
  // pick: `initialTheme` is the tenant's boot-resolved preset, and a merely-remembered value
  // must not outrank it (browse tenant A then tenant B and B rendered A's palette).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (localStorage.getItem(DEV_EXPLICIT_CHOICE_KEY) !== "true") return;
    const stored = localStorage.getItem(DEV_LOCAL_STORAGE_KEY);
    if (stored && isThemeName(stored)) {
      setThemeState(stored);
      applyTheme(stored);
    }
  }, []);

  const setTheme = (next: ThemeName) => {
    setThemeState(next);
    if (import.meta.env.DEV) {
      localStorage.setItem(DEV_LOCAL_STORAGE_KEY, next);
      localStorage.setItem(DEV_EXPLICIT_CHOICE_KEY, "true");
    }
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {enableDevSwitcher && import.meta.env.DEV ? (
        <DevThemeSwitcher theme={theme} onChange={setTheme} />
      ) : null}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with ThemeProvider
export const useTheme = () => useContext(ThemeContext);

type DevThemeSwitcherProps = {
  theme: ThemeName;
  onChange: (theme: ThemeName) => void;
};

const DevThemeSwitcher: React.FC<DevThemeSwitcherProps> = ({ theme, onChange }) => {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        left: "16px",
        right: "auto",
        zIndex: 40,
        padding: "10px 12px",
        borderRadius: "12px",
        background: "var(--bg-surface)",
        boxShadow: "var(--shadow-level-2)",
        border: `1px solid var(--border-subtle)`,
        display: "flex",
        gap: "8px",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Theme</span>
      <select
        value={theme}
        aria-label="Select theme"
        onChange={(e) => onChange(isThemeName(e.target.value) ? e.target.value : DEFAULT_THEME)}
        style={{
          background: "transparent",
          color: "var(--text-primary)",
          border: `1px solid var(--border-subtle)`,
          borderRadius: "8px",
          padding: "4px 8px",
          fontSize: "12px",
        }}
      >
        {themeOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

