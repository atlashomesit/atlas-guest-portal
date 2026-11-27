import React from 'react';

export type DormNightGender = 'Mixed' | 'FemaleOnly' | 'MaleOnly';

export interface DormNightGenderSlot {
  date: string;
  genderMode: DormNightGender;
  availableBeds: number;
}

export function isStayEligibleForDormGenderSchedule(
  slots: DormNightGenderSlot[],
  requestedGender: DormNightGender,
  bedsNeeded: number
): { eligible: boolean; blockingDates: string[] } {
  const blockingDates: string[] = [];
  for (const slot of slots) {
    const genderOk = slot.genderMode === 'Mixed' || slot.genderMode === requestedGender;
    if (!genderOk || slot.availableBeds < bedsNeeded) {
      blockingDates.push(slot.date);
    }
  }
  return { eligible: blockingDates.length === 0, blockingDates };
}

export const DormNightlyGenderSchedule: React.FC<{ slots: DormNightGenderSlot[] }> = ({ slots }) => {
  if (!slots.length) return null;
  return (
    <div data-testid="dorm-nightly-gender-schedule" className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-900">Night-by-night dorm gender availability</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {slots.map((s) => (
          <span
            key={s.date}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800"
          >
            <span className="font-medium">{s.date}</span>
            <span>·</span>
            <span>{s.genderMode === 'FemaleOnly' ? 'Female-Only' : s.genderMode === 'MaleOnly' ? 'Male-Only' : 'Mixed'}</span>
            <span className="text-slate-500">({s.availableBeds} beds)</span>
          </span>
        ))}
      </div>
    </div>
  );
};
