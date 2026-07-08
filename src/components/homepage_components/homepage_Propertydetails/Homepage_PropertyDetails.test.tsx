import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Homepage_PropertyDetails - TASK-1185: notFound heading', () => {
  it('renders "Home not found" recovery message when listing not found', () => {
    const filePath = resolve(__dirname, './Homepage_PropertyDetails.tsx');
    const content = readFileSync(filePath, 'utf-8');

    // TASK-4518 refactored the inline <h1>Home Not Found</h1> into the shared <StateMessage>
    // component. Verify the notFound state renders that "Home not found" recovery message.
    // (Behavioural coverage lives in src/pages/home/__tests__/listing-not-found-recovery.test.tsx.)
    expect(content).toContain('title="Home not found"');
    expect(content).toContain('data-testid="listing-not-found-homepage"');

    // Verify there's a notFound state
    expect(content).toContain('notFound');
    expect(content).toContain('setNotFound');
  });
});
