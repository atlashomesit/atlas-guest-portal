import React, { useState } from 'react';

export interface TranslatedListingTextProps {
  originalText: string;
  translatedText?: string | null;
  targetLanguageLabel?: string;
}

export const TranslatedListingText: React.FC<TranslatedListingTextProps> = ({
  originalText,
  translatedText,
  targetLanguageLabel = 'your language',
}) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const hasTranslation = Boolean(translatedText && translatedText.trim() && translatedText.trim() !== originalText.trim());

  if (!hasTranslation) {
    return <p className="text-sm leading-relaxed text-slate-700">{originalText}</p>;
  }

  return (
    <div data-testid="translated-listing-text" className="space-y-1.5">
      <p className="text-sm leading-relaxed text-slate-700">
        {showOriginal ? originalText : translatedText}
      </p>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>
          {showOriginal
            ? 'Showing original host text'
            : `Auto-translated to ${targetLanguageLabel}`}
        </span>
        <button
          type="button"
          onClick={() => setShowOriginal((v) => !v)}
          className="font-medium text-slate-800 underline hover:text-slate-600"
        >
          {showOriginal ? `Show ${targetLanguageLabel}` : 'Show original'}
        </button>
      </div>
    </div>
  );
};
