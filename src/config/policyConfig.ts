export type UnitPolicy = {
  checkIn: string;
  checkOut: string;
  extraGuestFeeRange: string;
};

export const DEFAULT_UNIT_POLICY: UnitPolicy = {
  checkIn: "2:00 PM",
  checkOut: "11:00 AM",
  extraGuestFeeRange: "₹400–₹600",
};

export const unitPolicies: Record<string, UnitPolicy> = {
  "101": { checkIn: "11:00 AM", checkOut: "9:00 AM", extraGuestFeeRange: "₹400–₹600" },
  "102": { checkIn: "1:00 PM", checkOut: "11:00 AM", extraGuestFeeRange: "₹400–₹600" },
  "302": { checkIn: "12:00 PM", checkOut: "10:00 AM", extraGuestFeeRange: "₹400–₹600" },
  "501": { checkIn: "2:00 PM", checkOut: "12:00 PM", extraGuestFeeRange: "₹600" },
};

export const baseGuestAllowance = 2;

export const getUnitPolicy = (unitId: string | number | undefined): UnitPolicy => {
  if (!unitId) return DEFAULT_UNIT_POLICY;
  const key = String(unitId);
  return unitPolicies[key] || DEFAULT_UNIT_POLICY;
};
