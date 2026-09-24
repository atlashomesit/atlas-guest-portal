import { describe, it, expect } from 'vitest';
import { searchHouseManual, manualEntriesByRoom } from './houseManual';

describe('TASK-102203 digital house manual', () => {
  it('finds the AC remote topic from a guest query', () => {
    expect(searchHouseManual('AC remote').map((e) => e.id)).toContain('ac-living');
  });

  it('finds trash disposal guidance', () => {
    expect(searchHouseManual('Trash').map((e) => e.id)).toContain('trash-kitchen');
  });

  it('organizes entries by room with photo walkthroughs', () => {
    const byRoom = manualEntriesByRoom();
    expect(Object.keys(byRoom).length).toBeGreaterThan(0);
    for (const list of Object.values(byRoom)) {
      for (const e of list) expect(e.photoUrls.length).toBeGreaterThan(0);
    }
  });
});
