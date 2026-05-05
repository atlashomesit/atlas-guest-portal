import React, { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import { applyTheme, availableThemes, themeRegistry, type ThemeName } from '../../styles/theme';
import { getAutoTheme } from '../../utils/seasonalTheme';

const THEME_STORAGE_KEY = 'atlas-theme-preference';
const AUTO_THEME_KEY = 'auto';

export const CompactThemeSwitcher: React.FC = () => {
  const [selectedTheme, setSelectedTheme] = useState<ThemeName | typeof AUTO_THEME_KEY>('auto');
  
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      setSelectedTheme(saved as ThemeName | typeof AUTO_THEME_KEY);
      if (saved === AUTO_THEME_KEY) {
        applyTheme(getAutoTheme());
      } else {
        applyTheme(saved);
      }
    } else {
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
    <div className="inline-flex items-center gap-2">
      <Palette className="h-5 w-5 text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors" aria-hidden="true" />
      <select
        id="footer-theme-select"
        value={selectedTheme}
        onChange={(e) => handleThemeChange(e.target.value as ThemeName | typeof AUTO_THEME_KEY)}
        className="bg-transparent border border-[var(--border-subtle)] rounded px-2 py-1 text-base text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] cursor-pointer transition-colors"
        aria-label="Select theme"
      >
        <option value="auto" className="bg-[var(--footer-bg)] text-[var(--footer-text)]">Auto</option>
        {availableThemes.map((theme) => (
          <option key={theme} value={theme} className="bg-[var(--footer-bg)] text-[var(--footer-text)]">
            {themeRegistry[theme].label}
          </option>
        ))}
      </select>
    </div>
  );
};

