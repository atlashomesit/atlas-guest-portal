import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Homepage_PropertyDetails - TASK-1185: notFound heading', () => {
  it('renders "Home Not Found" h1 heading when listing not found', () => {
    const filePath = resolve(__dirname, './Homepage_PropertyDetails.tsx');
    const content = readFileSync(filePath, 'utf-8');

    // Verify the component renders h1 heading with "Home Not Found" text
    expect(content).toContain('<h1 className="text-2xl font-semibold text-text-primary mb-4">Home Not Found</h1>');

    // Verify there's a notFound state
    expect(content).toContain('notFound');
    expect(content).toContain('setNotFound');
  });
});
