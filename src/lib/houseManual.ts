/**
 * TASK-102203 — Digital house manual interactive viewer.
 *
 * Done-when:
 * 1. Manual organized by appliance/room with photo walkthroughs.
 * 2. Search bar queries topics like 'AC remote' or 'Trash'.
 */

export interface ManualEntry {
  id: string;
  room: string;
  appliance: string;
  title: string;
  steps: string[];
  photoUrls: string[];
  keywords: string[];
}

export const HOUSE_MANUAL: ManualEntry[] = [
  {
    id: 'ac-living', room: 'Living Room', appliance: 'AC',
    title: 'Living room AC remote',
    steps: ['Point the remote at the unit', 'Press Power, set 24°C on Cool'],
    photoUrls: ['/manual/ac-living-1.jpg'],
    keywords: ['ac', 'remote', 'cool', 'living room', 'air conditioner'],
  },
  {
    id: 'geyser-bath', room: 'Bathroom', appliance: 'Geyser',
    title: 'Bathroom geyser switch',
    steps: ['Switch on the red geyser MCB outside the bathroom', 'Wait 10 minutes before shower'],
    photoUrls: ['/manual/geyser-1.jpg'],
    keywords: ['geyser', 'hot water', 'switch', 'bathroom', 'heater'],
  },
  {
    id: 'trash-kitchen', room: 'Kitchen', appliance: 'Trash',
    title: 'Trash disposal and segregation',
    steps: ['Segregate wet/dry waste in the labelled bins', 'Leave bins outside by 9 AM for pickup'],
    photoUrls: ['/manual/trash-1.jpg'],
    keywords: ['trash', 'garbage', 'waste', 'kitchen', 'disposal'],
  },
];

export function searchHouseManual(query: string, entries: ManualEntry[] = HOUSE_MANUAL): ManualEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  const tokens = q.split(/\s+/);
  return entries.filter((e) => {
    const hay = `${e.room} ${e.appliance} ${e.title} ${e.steps.join(' ')} ${e.keywords.join(' ')}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}

export function manualEntriesByRoom(entries: ManualEntry[] = HOUSE_MANUAL): Record<string, ManualEntry[]> {
  const out: Record<string, ManualEntry[]> = {};
  for (const e of entries) (out[e.room] ??= []).push(e);
  return out;
}
