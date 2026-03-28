import React, { useEffect, useState } from 'react';
import { applyTheme, type ThemeName, DEFAULT_THEME } from '../../styles/theme';

const THEME_STORAGE_KEY = 'atlas-theme-preference';

type FloatingThemeId =
  | 'sunriseCoral'
  | 'oceanLuxury'
  | 'royalViolet'
  | 'emeraldOasis'
  | 'godsWebsite';

type FloatingThemeConfig = {
  id: FloatingThemeId;
  themeName: ThemeName;
  label: string;
  swatch: string;
  icon?: string;
};

const THEMES: FloatingThemeConfig[] = [
  {
    id: 'sunriseCoral',
    themeName: 'sunriseCoral',
    label: 'Sunrise Coral',
    swatch: 'linear-gradient(135deg, #FFEDD5, #FF5733)',
  },
  {
    id: 'oceanLuxury',
    themeName: 'oceanLuxury',
    label: 'Ocean Luxury',
    swatch: 'linear-gradient(135deg, #E0F4FF, #0077B6)',
  },
  {
    id: 'royalViolet',
    themeName: 'royalViolet',
    label: 'Royal Violet',
    swatch: 'linear-gradient(135deg, #F0E6FF, #7B2FBE)',
  },
  {
    id: 'emeraldOasis',
    themeName: 'emeraldOasis',
    label: 'Emerald Oasis',
    swatch: 'linear-gradient(135deg, #DCFCE7, #059669)',
  },
  {
    id: 'godsWebsite',
    themeName: 'godsWebsite',
    label: "GOD'S WEBSITE",
    swatch: 'linear-gradient(135deg, #FEF3C7, #F59E0B, #EC4899)',
    icon: '👑',
  },
];

export const FloatingThemeSwitcher: React.FC = () => {
  const [activeTheme, setActiveTheme] = useState<ThemeName>(DEFAULT_THEME);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(THEME_STORAGE_KEY)) as
      | ThemeName
      | null;

    const initial = saved || DEFAULT_THEME;
    setActiveTheme(initial);
    applyTheme(initial);
  }, []);

  const handleSelect = (theme: ThemeName) => {
    setActiveTheme(theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
    applyTheme(theme);
  };

  return (
    <div
      className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[var(--z-floating)]"
      aria-label="Theme switcher"
    >
      <div className="flex items-end justify-end">
        <div className="flex items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--bg-surface)_90%,transparent)] border border-[var(--border-subtle)] shadow-[var(--shadow-level-2)] px-3 py-2 backdrop-blur-md">
          {open && (
            <div className="flex items-center gap-2 mr-2">
              {THEMES.map((config) => {
                const isActive = activeTheme === config.themeName;
                const size = config.id === 'godsWebsite' ? 18 : 14;

                return (
                  <button
                    key={config.id}
                    type="button"
                    onClick={() => handleSelect(config.themeName)}
                    className="relative inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    style={{
                      width: `${size + 4}px`,
                      height: `${size + 4}px`,
                    }}
                    title={config.label}
                    aria-label={config.label}
                  >
                    <span
                      className="inline-flex rounded-full"
                      style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        background: config.swatch,
                        boxShadow: isActive
                          ? '0 0 0 2px rgba(0, 0, 0, 0.12), 0 0 0 4px rgba(255, 255, 255, 0.65)'
                          : '0 0 0 1px rgba(15, 23, 42, 0.18)',
                        backgroundSize:
                          config.id === 'godsWebsite' ? '200% 200%' : '120% 120%',
                        animation:
                          config.id === 'godsWebsite' && isActive
                            ? 'shimmer 3s linear infinite'
                            : undefined,
                      }}
                    />
                    {config.icon && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-2 -right-1 text-[11px]"
                      >
                        {config.icon}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] shadow-[var(--shadow-level-1)] hover:shadow-[var(--shadow-level-2)] hover:scale-[1.02] transition-transform"
          >
            <span aria-hidden>🎨</span>
            <span className="hidden sm:inline">Theme</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingThemeSwitcher;

