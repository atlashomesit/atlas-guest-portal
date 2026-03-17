import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Palette } from 'lucide-react';
import { applyTheme, availableThemes, themeRegistry, type ThemeName } from '../../styles/theme';
import { getAutoTheme } from '../../utils/seasonalTheme';

const THEME_STORAGE_KEY = 'atlas-theme-preference';
const AUTO_THEME_KEY = 'auto';

export const CompactThemeSwitcher: React.FC = () => {
  const [selectedTheme, setSelectedTheme] = useState<ThemeName | typeof AUTO_THEME_KEY>('auto');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  
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

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, { capture: true } as AddEventListenerOptions);
    };
  }, [open]);
  
  const handleThemeChange = (theme: ThemeName | typeof AUTO_THEME_KEY) => {
    setSelectedTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    
    if (theme === AUTO_THEME_KEY) {
      applyTheme(getAutoTheme());
    } else {
      applyTheme(theme);
    }
  };

  const selectedLabel =
    selectedTheme === AUTO_THEME_KEY ? 'Auto' : themeRegistry[selectedTheme as ThemeName]?.label ?? selectedTheme;
  
  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-2">
      <Palette className="h-5 w-5 text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors" aria-hidden="true" />
      <button
        type="button"
        className="inline-flex items-center gap-2 bg-white/10 border border-[var(--border-subtle)] rounded px-2 py-1 text-[13px] leading-[1.4] text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] cursor-pointer transition-colors"
        style={{ fontFamily: 'var(--font-family-base, "Plus Jakarta Sans", sans-serif)' }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select theme"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="max-w-[150px] truncate">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 opacity-80" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 z-50 w-[220px] max-w-[240px] overflow-hidden rounded-md border border-[var(--border-subtle)] shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-[13px] leading-[1.4] font-medium text-[var(--footer-text)]"
          style={{
            background: 'var(--footer-bg)',
            fontFamily: 'var(--font-family-base, "Plus Jakarta Sans", sans-serif)',
            fontSize: '13px',
            lineHeight: '18px',
          }}
          role="listbox"
          aria-label="Theme options"
        >
          <div
            className="max-h-64 overflow-auto py-1"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-subtle) transparent' }}
          >
            <button
              type="button"
              className={`w-full flex items-center justify-between gap-2 px-3 py-[7px] text-left text-[13px] leading-[1.4] transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${
                selectedTheme === AUTO_THEME_KEY
                  ? 'text-[var(--footer-link-hover)] bg-white/10'
                  : 'text-[var(--footer-link)] hover:bg-white/10 hover:text-[var(--footer-link-hover)]'
              }`}
              style={{
                fontFamily: 'var(--font-family-base, "Plus Jakarta Sans", sans-serif)',
                fontSize: '13px',
                lineHeight: '18px',
              }}
              onClick={() => {
                handleThemeChange(AUTO_THEME_KEY);
                setOpen(false);
              }}
            >
              <span className="flex-1 truncate">Auto</span>
              {selectedTheme === AUTO_THEME_KEY && <Check className="h-4 w-4 opacity-90" aria-hidden="true" />}
            </button>

            {availableThemes.map((theme) => {
              const isSelected = selectedTheme === theme;
              return (
                <button
                  key={theme}
                  type="button"
                  className={`w-full flex items-center justify-between gap-2 px-3 py-[7px] text-left text-[13px] leading-[1.4] transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${
                    isSelected
                      ? 'text-[var(--footer-link-hover)] bg-white/10'
                      : 'text-[var(--footer-link)] hover:bg-white/10 hover:text-[var(--footer-link-hover)]'
                  }`}
                  style={{
                    fontFamily: 'var(--font-family-base, "Plus Jakarta Sans", sans-serif)',
                    fontSize: '13px',
                    lineHeight: '18px',
                  }}
                  onClick={() => {
                    handleThemeChange(theme);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 truncate">{themeRegistry[theme].label}</span>
                  {isSelected && <Check className="h-4 w-4 opacity-90" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
