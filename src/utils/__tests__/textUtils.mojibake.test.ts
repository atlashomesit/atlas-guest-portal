import { describe, expect, it } from 'vitest';
import { repairMojibake } from '../textUtils';

describe('repairMojibake', () => {
  it('repairs double-encoded bullets ("â€¢" -> "•")', () => {
    expect(repairMojibake('â€¢ Swimming Pool\nâ€¢ Free WiFi')).toBe('• Swimming Pool\n• Free WiFi');
  });

  it('repairs double-encoded check marks ("âœ”" -> "✔")', () => {
    expect(repairMojibake('âœ” Verified Property\nâœ” 24/7 Power Backup')).toBe('✔ Verified Property\n✔ 24/7 Power Backup');
  });

  it('repairs double-encoded smart apostrophes ("â€™" -> "’")', () => {
    expect(repairMojibake('Vistaraâ€™s Stays - Hostâ€™s Favorite')).toBe('Vistara’s Stays - Host’s Favorite');
  });

  it('repairs double-encoded left double quotes ("â€œ" -> "“")', () => {
    expect(repairMojibake('â€œWelcome to Goa')).toBe('“Welcome to Goa');
  });

  it('repairs double-encoded right double quotes with 0x9D / \\u009d ("â€\\x9d" or "â€\\u009d" -> "”")', () => {
    expect(repairMojibake('â€œLuxury Villaâ€\u009d')).toBe('“Luxury Villa”');
    expect(repairMojibake('â€œLuxury Villaâ€\x9d')).toBe('“Luxury Villa”');
  });

  it('repairs stripped right double quotes ("â€" -> "”")', () => {
    expect(repairMojibake('â€œHeritage Homeâ€')).toBe('“Heritage Home”');
  });

  it('repairs en-dashes ("â€“" -> "–") and em-dashes ("â€”" -> "—")', () => {
    expect(repairMojibake('Check-in: 2 PM â€“ 8 PM')).toBe('Check-in: 2 PM – 8 PM');
    expect(repairMojibake('Relax â€” unwind by the sea')).toBe('Relax — unwind by the sea');
  });

  it('repairs double-encoded spaces ("Â " -> " ")', () => {
    expect(repairMojibake('DeluxeÂ Room Â withÂ balcony')).toBe('Deluxe Room  with balcony');
    expect(repairMojibake('CleanÂ\u00A0Bedding')).toBe('Clean Bedding');
  });

  it('normalizes raw literal "\\r\\n" and "\\r" strings to clean line breaks', () => {
    expect(repairMojibake('Line 1\\r\\nLine 2\\r\\nLine 3')).toBe('Line 1\nLine 2\nLine 3');
    expect(repairMojibake('Line 1\\rLine 2')).toBe('Line 1\nLine 2');
  });

  it('normalizes actual carriage returns ("\\r\\n" and "\\r") to clean line breaks', () => {
    expect(repairMojibake('Line 1\r\nLine 2\rLine 3\nLine 4')).toBe('Line 1\nLine 2\nLine 3\nLine 4');
  });

  it('repairs a realistic OTA description with multiple combined mojibake and newlines', () => {
    const raw =
      'â€œVistaraâ€™s Mountain Retreatâ€\u009d\r\n' +
      'â€¢ Private Villa â€“ 3 BHK\r\n' +
      'âœ” High-Speed WiFiÂ included\r\n' +
      'â€¢ Fully equipped kitchen â€” chef on call\\r\\n' +
      'Book your stay today!';

    const expected =
      '“Vistara’s Mountain Retreat”\n' +
      '• Private Villa – 3 BHK\n' +
      '✔ High-Speed WiFi included\n' +
      '• Fully equipped kitchen — chef on call\n' +
      'Book your stay today!';

    expect(repairMojibake(raw)).toBe(expected);
  });

  it('safely handles empty, null, or undefined values', () => {
    expect(repairMojibake('')).toBe('');
    expect(repairMojibake(null)).toBe('');
    expect(repairMojibake(undefined)).toBe('');
  });

  it('preserves clean text, normal punctuation, and standard emojis unaltered', () => {
    const clean = '✨ Highlights:\n🏡 Entire 2BHK in South Bangalore!\n⭐ 4.9 Rating (120 reviews)';
    expect(repairMojibake(clean)).toBe(clean);
  });
});
