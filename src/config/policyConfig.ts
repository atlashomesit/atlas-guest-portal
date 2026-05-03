export type UnitPolicy = {
  checkIn: string;
  checkOut: string;
  extraGuestFeeRange: string;
};

export const DEFAULT_UNIT_POLICY: UnitPolicy = {
  checkIn: "2:00 PM",
  checkOut: "11:00 AM",
  extraGuestFeeRange: "₹500 per additional guest",
};

export const unitPolicies: Record<string, UnitPolicy> = {
  "101": { checkIn: "11:00 AM", checkOut: "9:00 AM", extraGuestFeeRange: "₹500" },
  "102": { checkIn: "1:00 PM", checkOut: "11:00 AM", extraGuestFeeRange: "₹500" },
  "302": { checkIn: "12:00 PM", checkOut: "10:00 AM", extraGuestFeeRange: "₹500" },
  "501": { checkIn: "2:00 PM", checkOut: "12:00 PM", extraGuestFeeRange: "₹1,200" },
};

export const baseGuestAllowance = 2;

export const getUnitPolicy = (unitId: string | number | undefined): UnitPolicy => {
  if (!unitId) return DEFAULT_UNIT_POLICY;
  const key = String(unitId);
  return unitPolicies[key] || DEFAULT_UNIT_POLICY;
};

/** Only returns a policy when this unit id has an explicit row (not the global default). */
export function getExplicitUnitPolicy(unitId: string | number | undefined): UnitPolicy | undefined {
  if (unitId == null) return undefined;
  const key = String(unitId);
  return unitPolicies[key];
}
