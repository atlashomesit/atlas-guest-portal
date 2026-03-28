import React, { useEffect, useState } from 'react';
import { applyTheme, availableThemes, themeRegistry, type ThemeName } from '../../styles/theme';
import { getAutoTheme } from '../../utils/seasonalTheme';

const THEME_STORAGE_KEY = 'atlas-theme-preference';
const AUTO_THEME_KEY = 'auto';

export const ThemeSwitcher: React.FC = () => {
  const [selectedTheme, setSelectedTheme] = useState<ThemeName | typeof AUTO_THEME_KEY>('auto');
  
  useEffect(() => {
    // Load saved preference
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      setSelectedTheme(saved as ThemeName | typeof AUTO_THEME_KEY);
      if (saved === AUTO_THEME_KEY) {
        applyTheme(getAutoTheme());
      } else {
        applyTheme(saved);
      }
    } else {
      // Default to auto
      applyTheme(getAutoTheme());
    }
  }, []);
  
  const handleThemeChange = (theme: ThemeName | typeof AUTO_THEME_KEY) => {
    setSelectedTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    
    if (theme === AUTO_THEME_KEY) {
      applyTheme(getAutoTheme());
    } else {
      applyTheme(theme);
    }
  };
  
  return (
    <div className="theme-switcher">
      <label htmlFor="theme-select" className="text-sm font-medium text-[#64748B]">
        Theme
      </label>
      <select
        id="theme-select"
        value={selectedTheme}
        onChange={(e) => handleThemeChange(e.target.value as ThemeName | typeof AUTO_THEME_KEY)}
        className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#475569] focus:outline-none focus:ring-2 focus:ring-[#475569]/20"
      >
        <option value="auto">Auto (Seasonal)</option>
        {availableThemes.map((theme) => (
          <option key={theme} value={theme}>
            {themeRegistry[theme].label}
          </option>
        ))}
      </select>
    </div>
  );
};

