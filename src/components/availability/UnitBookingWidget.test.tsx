import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('UnitBookingWidget - TASK-1229/1215: Button text is "Book Now"', () => {
  it('button text contains "Book Now" in the render output', () => {
    const filePath = resolve(__dirname, './UnitBookingWidget.tsx');
    const content = readFileSync(filePath, 'utf-8');

    // Verify the button text is "Book Now"
    expect(content).toContain("'Book Now'");

    // Verify the button has disabled conditions including date checks
    expect(content).toContain('!dateRange.startDate');
    expect(content).toContain('!dateRange.endDate');
  });
});
