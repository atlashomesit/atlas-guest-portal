// Custom hook for i18n translation in components
import { useEffect, useState } from 'react';
import { translate, getCurrentLanguage, setLanguage, Language, getAvailableLanguages, getLanguageName } from '@/i18n/i18n';

/**
 * Hook to use translations in components
 * Returns translate function and current language
 * Forces re-render when language changes via the global listener
 */
export function useTranslation() {
  const [language, setLanguageState] = useState<Language>(getCurrentLanguage());

  useEffect(() => {
    const handleLanguageChange = () => {
      setLanguageState(getCurrentLanguage());
    };

    // Listen for storage changes (from other tabs/windows)
    window.addEventListener('storage', handleLanguageChange);

    return () => {
      window.removeEventListener('storage', handleLanguageChange);
    };
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    setLanguageState(lang);
    // Dispatch custom event for cross-component updates
    window.dispatchEvent(new CustomEvent('i18n-language-changed', { detail: { language: lang } }));
  };

  return {
    t: translate,
    language,
    changeLanguage,
    availableLanguages: getAvailableLanguages(),
    getLanguageName,
  };
}
