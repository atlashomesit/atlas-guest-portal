import React, { useState } from 'react';

export type GenderPolicy = 'FemaleOnly' | 'MaleOnly' | 'Mixed';

export interface HostelDormBadgeProps {
  accommodationType?: string | null;
  propertyType?: string | null;
  name?: string | null;
  genderPolicy?: GenderPolicy | string | null;
  showPolicyConfirmation?: boolean;
  onPolicyConfirmed?: (confirmed: boolean) => void;
  className?: string;
}

export function isHostelDorm(props: {
  accommodationType?: string | null;
  propertyType?: string | null;
  name?: string | null;
}): boolean {
  const acc = (props.accommodationType || '').toLowerCase();
  const prop = (props.propertyType || '').toLowerCase();
  const n = (props.name || '').toLowerCase();

  return (
    acc === 'hosteldorm' ||
    prop === 'hosteldorm' ||
    acc.includes('dorm') ||
    prop.includes('dorm') ||
    acc.includes('hostel') ||
    prop.includes('hostel') ||
    /\b(dorm|dormitory|bunk bed|bed in dorm)\b/i.test(n)
  );
}

export function resolveGenderPolicy(
  policy?: string | null,
  name?: string | null
): GenderPolicy {
  const pol = (policy || '').toLowerCase();
  const n = (name || '').toLowerCase();

  if (pol === 'femaleonly' || pol.includes('female') || /\b(female[- ]only|women[- ]only|girls)\b/i.test(n)) {
    return 'FemaleOnly';
  }
  if (pol === 'maleonly' || (pol.includes('male') && !pol.includes('female')) || /\b(male[- ]only|men[- ]only|boys)\b/i.test(n)) {
    return 'MaleOnly';
  }
  return 'Mixed';
}

export const HostelDormBadge: React.FC<HostelDormBadgeProps> = ({
  accommodationType,
  propertyType,
  name,
  genderPolicy: explicitPolicy,
  showPolicyConfirmation = false,
  onPolicyConfirmed,
  className = '',
}) => {
  const isDorm = isHostelDorm({ accommodationType, propertyType, name });
  const [confirmed, setConfirmed] = useState(false);

  if (!isDorm) {
    return null;
  }

  const gender = resolveGenderPolicy(explicitPolicy, name);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setConfirmed(isChecked);
    onPolicyConfirmed?.(isChecked);
  };

  return (
    <div className={`space-y-2 ${className}`} data-testid="hostel-dorm-container">
      <div className="flex flex-wrap items-center gap-2" data-testid="hostel-dorm-badge">
        <span
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-sm"
          data-testid="hostel-dorm-base-badge"
        >
          <span aria-hidden="true">🛏️</span>
          <span>Hostel Dormitory · Sold by the Bed</span>
        </span>

        {gender === 'FemaleOnly' && (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-pink-50 border border-pink-200 px-2.5 py-1 text-xs font-semibold text-pink-800 shadow-sm"
            data-testid="hostel-gender-badge-female"
          >
            <span aria-hidden="true">🚺</span>
            <span>Female-Only Dorm</span>
          </span>
        )}

        {gender === 'MaleOnly' && (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-800 shadow-sm"
            data-testid="hostel-gender-badge-male"
          >
            <span aria-hidden="true">🚹</span>
            <span>Male-Only Dorm</span>
          </span>
        )}

        {gender === 'Mixed' && (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm"
            data-testid="hostel-gender-badge-mixed"
          >
            <span aria-hidden="true">🚻</span>
            <span>Mixed Dorm</span>
          </span>
        )}
      </div>

      {showPolicyConfirmation && (gender === 'FemaleOnly' || gender === 'MaleOnly') && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-950 space-y-2"
          data-testid="hostel-gender-policy-notice"
        >
          <div className="font-semibold text-amber-900 flex items-center gap-1.5">
            <span>⚠️</span>
            <span>
              {gender === 'FemaleOnly' ? 'Strict Female-Only Policy' : 'Strict Male-Only Policy'}
            </span>
          </div>
          <p className="leading-relaxed">
            {gender === 'FemaleOnly'
              ? 'This dormitory bed is strictly reserved for female travelers. Male guests will not be permitted to check in to this room and bookings are non-refundable for gender policy violations.'
              : 'This dormitory bed is strictly reserved for male travelers. Female guests will not be permitted to check in to this room and bookings are non-refundable for gender policy violations.'}
          </p>
          <label className="flex items-start gap-2 pt-1 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={handleCheckboxChange}
              data-testid="hostel-gender-policy-checkbox"
              className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-700 focus:ring-amber-500"
            />
            <span>
              I confirm that all guests staying in this dorm bed comply with the{' '}
              {gender === 'FemaleOnly' ? 'female-only' : 'male-only'} policy.
            </span>
          </label>
        </div>
      )}
    </div>
  );
};

export default HostelDormBadge;
