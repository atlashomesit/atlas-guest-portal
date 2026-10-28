import React from 'react';
import { isHostelDormType, parseDormGenderPolicy, type DormGenderPolicy } from '@/utils/dormListing';

export type GenderPolicy = DormGenderPolicy;

export function formatBedType(type?: string | null): string {
  if (!type) return '';
  const normalized = type.toLowerCase().replace(/[-_]/g, ' ').trim();
  if (normalized.includes('lower')) return 'Lower Bunk';
  if (normalized.includes('upper')) return 'Upper Bunk';
  if (normalized.includes('single')) return 'Single Bed';
  if (normalized.includes('double')) return 'Double Bed';
  if (normalized.includes('bunk')) return 'Bunk Bed';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export interface HostelDormBadgeProps {
  accommodationType?: string | null;
  propertyType?: string | null;
  /**
   * HSL-011: `Listing.DormGenderPolicy` straight from the API. Missing / unrecognised = the host has not
   * stated a rule, so NO gender chip is shown (the listing name is never read to guess one).
   */
  genderPolicy?: GenderPolicy | string | null;
  /**
   * TASK-1039778: Bed type label (e.g. "Lower Bunk", "Upper Bunk", "Single Bed")
   */
  bedType?: string | null;
  bedTypes?: string[] | null;
  className?: string;
}

/**
 * TASK-10299109: the badge reads "Sold by the Bed", so it belongs only on a listing that really sells beds:
 * `Listing.AccommodationType === "HostelDorm"`, straight from the API. The PROPERTY type is not an input -
 * a private room of a Hostel property is sold by the room and must not carry a dorm badge. `propertyType` stays
 * in the signature only so existing callers still compile; it is ignored.
 */
export function isHostelDorm(props: {
  accommodationType?: string | null;
  propertyType?: string | null;
}): boolean {
  return isHostelDormType(props.accommodationType);
}

/** The API's own value, or null when it states none. Never inferred from the listing name. */
export function resolveGenderPolicy(policy?: string | null): GenderPolicy | null {
  return parseDormGenderPolicy(policy);
}

export const HostelDormBadge: React.FC<HostelDormBadgeProps> = ({
  accommodationType,
  propertyType,
  genderPolicy,
  bedType,
  bedTypes,
  className = '',
}) => {
  const isDorm = isHostelDorm({ accommodationType, propertyType });

  if (!isDorm) {
    return null;
  }

  const gender = resolveGenderPolicy(genderPolicy);
  const resolvedBedTypes = bedTypes?.length
    ? bedTypes.map(formatBedType).filter(Boolean)
    : bedType
      ? [formatBedType(bedType)].filter(Boolean)
      : [];

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

        {resolvedBedTypes.map((label, idx) => (
          <span
            key={`bed-type-${idx}-${label}`}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-800 shadow-sm"
            data-testid="hostel-bed-type-badge"
          >
            <span aria-hidden="true">🛌</span>
            <span>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default HostelDormBadge;
