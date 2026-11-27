import React, { useState } from 'react';

export interface DormSleeperEntry {
  fullName: string;
  gender?: string;
  phone?: string;
  bunkPreference?: 'Lower' | 'Upper' | 'Any';
}

export function parseDormRosterCsv(csvText: string): DormSleeperEntry[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const startIdx = /^name|^full\s*name/i.test(lines[0]) ? 1 : 0;
  const entries: DormSleeperEntry[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (!cols[0]) continue;
    const rawPref = (cols[3] || '').toLowerCase();
    const bunkPreference: DormSleeperEntry['bunkPreference'] =
      rawPref === 'lower' ? 'Lower' : rawPref === 'upper' ? 'Upper' : 'Any';
    entries.push({
      fullName: cols[0],
      gender: cols[1] || undefined,
      phone: cols[2] || undefined,
      bunkPreference,
    });
  }
  return entries;
}

export interface DormGroupRosterFormProps {
  maxBeds: number;
  onSubmitRoster: (sleepers: DormSleeperEntry[]) => void;
}

export const DormGroupRosterForm: React.FC<DormGroupRosterFormProps> = ({
  maxBeds,
  onSubmitRoster,
}) => {
  const [rawCsv, setRawCsv] = useState('');
  const parsed = parseDormRosterCsv(rawCsv).slice(0, maxBeds);

  return (
    <div data-testid="dorm-group-roster-form" className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-900">
        Group Rooming List (up to {maxBeds} sleepers)
      </h4>
      <p className="mt-1 text-xs text-slate-600">
        Paste CSV rows: <code>Full Name, Gender, Phone, Bunk Preference</code>
      </p>
      <textarea
        aria-label="Group rooming list CSV"
        rows={4}
        value={rawCsv}
        onChange={(e) => setRawCsv(e.target.value)}
        placeholder="Ananya Rao, Female, 9876543210, Lower"
        className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-600" data-testid="parsed-sleeper-count">
          {parsed.length} sleeper(s) ready
        </span>
        <button
          type="button"
          disabled={parsed.length === 0}
          onClick={() => onSubmitRoster(parsed)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Save Group Roster
        </button>
      </div>
    </div>
  );
};
