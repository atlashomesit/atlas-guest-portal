import React from 'react';
import { parseDormGenderPolicy, type DormGenderPolicy } from '@/utils/dormListing';

export type GenderPolicy = DormGenderPolicy;

export interface HostelDormBadgeProps {
  accommodationType?: string | null;
  propertyType?: string | null;
  /**
   * HSL-011: `Listing.DormGenderPolicy` straight from the API. Missing / unrecognised = the host has not
   * stated a rule, so NO gender chip is shown (the listing name is never read to guess one).
   */
  genderPolicy?: GenderPolicy | string | null;
  className?: string;
}

export function isHostelDorm(props: {
  accommodationType?: string | null;
  propertyType?: string | null;
}): boolean {
  const acc = (props.accommodationType || '').toLowerCase();
  const prop = (props.propertyType || '').toLowerCase();

  return (
    acc === 'hosteldorm' ||
    prop === 'hosteldorm' ||
    acc.includes('dorm') ||
    prop.includes('dorm') ||
    acc.includes('hostel') ||
    prop.includes('hostel')
  );
}

/** The API's own value, or null when it states none. Never inferred from the listing name. */
export function resolveGenderPolicy(policy?: string | null): GenderPolicy | null {
  return parseDormGenderPolicy(policy);
}

export const HostelDormBadge: React.FC<HostelDormBadgeProps> = ({
  accommodationType,
  propertyType,
  genderPolicy,
  className = '',
}) => {
  const isDorm = isHostelDorm({ accommodationType, propertyType });

  if (!isDorm) {
    return null;
  }

  const gender = resolveGenderPolicy(genderPolicy);

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
    </div>
  );
};

export default HostelDormBadge;
