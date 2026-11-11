export const STAY_ISSUE_CATEGORIES = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'cleanliness', label: 'Cleanliness' },
  { value: 'access', label: 'Access' },
  { value: 'noise', label: 'Noise' },
  { value: 'other', label: 'Other' },
] as const;

export type StayIssueCategory = typeof STAY_ISSUE_CATEGORIES[number]['value'];

export function parseStayIssueCategory(value?: string | null): StayIssueCategory | '' {
  return STAY_ISSUE_CATEGORIES.find((category) => category.value === value)?.value ?? '';
}

export function stayIssuePrefix(value: StayIssueCategory | ''): string {
  const category = STAY_ISSUE_CATEGORIES.find((item) => item.value === value);
  return category ? `[${category.label}] ` : '';
}
