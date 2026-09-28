import { describe, expect, it } from 'vitest';
import { previewListingDescription, resolveHostListingDescription } from './listingDescription';

describe('resolveHostListingDescription', () => {
  it('returns the Full description (longDescription) when the host filled it in', () => {
    expect(
      resolveHostListingDescription({
        longDescription: 'A beautifully furnished 2BHK.\n\n✨ Highlights\n🏡 Entire private 2BHK',
        shortDescription: 'Stylish 2BHK in Central Bangalore.',
      }),
    ).toBe('A beautifully furnished 2BHK.\n\n✨ Highlights\n🏡 Entire private 2BHK');
  });

  it('falls back to the Short description when the Full description is empty', () => {
    expect(
      resolveHostListingDescription({ longDescription: '   ', shortDescription: 'Stylish 2BHK in Central Bangalore.' }),
    ).toBe('Stylish 2BHK in Central Bangalore.');
    expect(resolveHostListingDescription({ longDescription: null, shortDescription: 'Short only' })).toBe('Short only');
  });

  it('accepts PascalCase keys like the rest of the listing payload readers', () => {
    expect(resolveHostListingDescription({ LongDescription: 'Pascal long' })).toBe('Pascal long');
    expect(resolveHostListingDescription({ ShortDescription: 'Pascal short' })).toBe('Pascal short');
  });

  it('trims only the outer whitespace and keeps the host’s own line breaks', () => {
    expect(resolveHostListingDescription({ longDescription: '\n  Line one\n\nLine two  \n' })).toBe(
      'Line one\n\nLine two',
    );
  });

  it('never uses SEO/meta copy or the tagline — returns empty so the page keeps its "Ask the host" state', () => {
    expect(
      resolveHostListingDescription({
        seoDescription: 'SEO copy',
        metaDescription: 'Meta copy',
        tagline: 'Tagline',
        property_description: 'Legacy',
      }),
    ).toBe('');
    expect(resolveHostListingDescription({ longDescription: '', shortDescription: '' })).toBe('');
    expect(resolveHostListingDescription(null)).toBe('');
    expect(resolveHostListingDescription(undefined)).toBe('');
  });
});

describe('previewListingDescription', () => {
  it('returns the text unchanged when it fits', () => {
    expect(previewListingDescription('Short text', 300)).toEqual({ preview: 'Short text', truncated: false });
    const exact = 'x'.repeat(300);
    expect(previewListingDescription(exact, 300)).toEqual({ preview: exact, truncated: false });
  });

  it('cuts to the limit and appends an ellipsis when longer', () => {
    const { preview, truncated } = previewListingDescription('abcdefghij', 4);
    expect(truncated).toBe(true);
    expect(preview).toBe('abcd…');
  });

  it('never splits an emoji surrogate pair at the cut', () => {
    // "🏡" is two UTF-16 units; a code-unit slice at 2 would leave a lone surrogate ("�").
    const { preview, truncated } = previewListingDescription('a🏡bcdef', 2);
    expect(truncated).toBe(true);
    expect(preview).toBe('a🏡…');
    expect(preview).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('does not leave the ellipsis dangling after a trailing line break', () => {
    expect(previewListingDescription('Intro\n\nMore text here', 7).preview).toBe('Intro…');
  });
});
