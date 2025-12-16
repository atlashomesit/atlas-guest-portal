export type Identifiable = {
  id?: string | number | null;
  listingId?: string | number | null;
  title?: string | null;
  property_name?: string | null;
};

export function sanitizeItems<T extends Identifiable>(items: unknown): T[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is T => Boolean(item) && typeof item === 'object')
    .filter((item) => {
      const candidate = item as Identifiable;
      return candidate.id != null || candidate.listingId != null;
    });
}

export function getItemKey(item: Identifiable, fallbackIndex: number): string {
  if (item.id != null) return String(item.id);
  if (item.listingId != null) return String(item.listingId);
  if (item.property_name) return `property-${String(item.property_name)}`;
  if (item.title) return `title-${String(item.title)}`;
  return `item-${fallbackIndex}`;
}
