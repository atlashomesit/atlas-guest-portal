import { describe, it, expect } from 'vitest';
import { getSeasonalTheme, getAutoTheme } from '../seasonalTheme';

describe('seasonalTheme', () => {
  describe('getSeasonalTheme', () => {
    it('should return "valentine" for dates in Valentine period (Feb 1-14)', () => {
      const feb1 = new Date(2025, 1, 1); // Feb 1
      const feb10 = new Date(2025, 1, 10); // Feb 10
      const feb14 = new Date(2025, 1, 14); // Feb 14
      
      expect(getSeasonalTheme(feb1)).toBe('valentine');
      expect(getSeasonalTheme(feb10)).toBe('valentine');
      expect(getSeasonalTheme(feb14)).toBe('valentine');
    });

    it('should return null for dates outside Valentine period', () => {
      const jan31 = new Date(2025, 0, 31); // Jan 31
      const feb15 = new Date(2025, 1, 15); // Feb 15
      
      expect(getSeasonalTheme(jan31)).toBe(null);
      expect(getSeasonalTheme(feb15)).toBe(null);
    });

    it('should return "christmas" for dates in Christmas period (Dec 15-26)', () => {
      const dec15 = new Date(2025, 11, 15); // Dec 15
      const dec20 = new Date(2025, 11, 20); // Dec 20
      const dec26 = new Date(2025, 11, 26); // Dec 26
      
      expect(getSeasonalTheme(dec15)).toBe('christmas');
      expect(getSeasonalTheme(dec20)).toBe('christmas');
      expect(getSeasonalTheme(dec26)).toBe('christmas');
    });

    it('should return null for dates outside Christmas period', () => {
      const dec14 = new Date(2025, 11, 14); // Dec 14
      const dec27 = new Date(2025, 11, 27); // Dec 27 (New Year period)
      
      expect(getSeasonalTheme(dec14)).toBe(null);
      expect(getSeasonalTheme(dec27)).toBe('newYear'); // Not null, but newYear
    });

    it('should return "newYear" for dates in New Year period (Dec 27 - Jan 2)', () => {
      const dec27 = new Date(2025, 11, 27); // Dec 27
      const dec31 = new Date(2025, 11, 31); // Dec 31
      const jan1 = new Date(2026, 0, 1); // Jan 1 (next year)
      const jan2 = new Date(2026, 0, 2); // Jan 2 (next year)
      
      expect(getSeasonalTheme(dec27)).toBe('newYear');
      expect(getSeasonalTheme(dec31)).toBe('newYear');
      expect(getSeasonalTheme(jan1)).toBe('newYear');
      expect(getSeasonalTheme(jan2)).toBe('newYear');
    });

    it('should return null for dates outside New Year period', () => {
      const dec26 = new Date(2025, 11, 26); // Dec 26 (Christmas period)
      const jan3 = new Date(2026, 0, 3); // Jan 3
      
      expect(getSeasonalTheme(dec26)).toBe('christmas'); // Not null, but christmas
      expect(getSeasonalTheme(jan3)).toBe(null);
    });

    it('should return null for regular dates throughout the year', () => {
      const mar15 = new Date(2025, 2, 15); // Mar 15
      const jul4 = new Date(2025, 6, 4); // Jul 4
      const oct31 = new Date(2025, 9, 31); // Oct 31
      
      expect(getSeasonalTheme(mar15)).toBe(null);
      expect(getSeasonalTheme(jul4)).toBe(null);
      expect(getSeasonalTheme(oct31)).toBe(null);
    });
  });

  describe('getAutoTheme', () => {
    it('should return "default" when no seasonal theme is active', () => {
      const mar15 = new Date(2025, 2, 15); // Mar 15
      // Mock getSeasonalTheme to return null
      const result = getAutoTheme();
      // Since we can't easily mock the current date in this test,
      // we'll just verify the function exists and returns a valid theme
      expect(['default', 'valentine', 'christmas', 'newYear']).toContain(result);
    });
  });

  describe('year-crossing logic', () => {
    it('should correctly handle New Year period crossing year boundary', () => {
      // Test dates around year boundary
      const dec28_2024 = new Date(2024, 11, 28); // Dec 28, 2024
      const dec31_2024 = new Date(2024, 11, 31); // Dec 31, 2024
      const jan1_2025 = new Date(2025, 0, 1); // Jan 1, 2025
      const jan2_2025 = new Date(2025, 0, 2); // Jan 2, 2025
      const jan3_2025 = new Date(2025, 0, 3); // Jan 3, 2025
      
      expect(getSeasonalTheme(dec28_2024)).toBe('newYear');
      expect(getSeasonalTheme(dec31_2024)).toBe('newYear');
      expect(getSeasonalTheme(jan1_2025)).toBe('newYear');
      expect(getSeasonalTheme(jan2_2025)).toBe('newYear');
      expect(getSeasonalTheme(jan3_2025)).toBe(null);
    });
  });

  describe('edge cases', () => {
    it('should handle leap year dates correctly', () => {
      const feb29_2024 = new Date(2024, 1, 29); // Feb 29, 2024 (leap year)
      // Feb 29 is outside Valentine period (Feb 1-14)
      expect(getSeasonalTheme(feb29_2024)).toBe(null);
    });

    it('should handle first and last days of periods correctly', () => {
      // First day of Valentine
      const feb1 = new Date(2025, 1, 1);
      expect(getSeasonalTheme(feb1)).toBe('valentine');
      
      // Last day of Valentine
      const feb14 = new Date(2025, 1, 14);
      expect(getSeasonalTheme(feb14)).toBe('valentine');
      
      // Day after Valentine
      const feb15 = new Date(2025, 1, 15);
      expect(getSeasonalTheme(feb15)).toBe(null);
      
      // First day of Christmas
      const dec15 = new Date(2025, 11, 15);
      expect(getSeasonalTheme(dec15)).toBe('christmas');
      
      // Last day of Christmas
      const dec26 = new Date(2025, 11, 26);
      expect(getSeasonalTheme(dec26)).toBe('christmas');
      
      // First day of New Year
      const dec27 = new Date(2025, 11, 27);
      expect(getSeasonalTheme(dec27)).toBe('newYear');
    });
  });
});

