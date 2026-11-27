import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranslatedListingText } from './TranslatedListingText';

describe('BNB-041 TranslatedListingText', () => {
  it('shows auto-translated text by default and toggles back to original host text', () => {
    render(
      <TranslatedListingText
        originalText="Peaceful hilltop room with valley view."
        translatedText="घाटी के दृश्य वाला शांत पहाड़ी कमरा।"
        targetLanguageLabel="Hindi"
      />
    );
    expect(screen.getByText(/घाटी के दृश्य/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Show original/i }));
    expect(screen.getByText(/Peaceful hilltop room/i)).toBeTruthy();
  });
});
