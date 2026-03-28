export type UnitType = "1bhk" | "penthouse" | string;

export type RoundingMode = "nearest" | "up" | "down";

export interface PricingConfig {
  baseNightlyPriceByUnitType: Record<UnitType, number>;
  includedGuestsByUnitType: Record<UnitType, number>;
  globalDiscountPercent: number;
  dateMultipliers: Record<string, number>;
  currency: string;
  timezone: string;
  rounding: {
    mode: RoundingMode;
    decimalPlaces: number;
  };
  extraGuestFeeByUnitType?: Record<UnitType, number>;
  maxGuestsByUnitType?: Record<UnitType, number>;
  cleaningFeeByUnitType?: Record<UnitType, number>;
}

export const pricingConfig: PricingConfig = {
  baseNightlyPriceByUnitType: {
    "1bhk": 3500,
    penthouse: 6000,
  },
  includedGuestsByUnitType: {
    default: 2,
    "1bhk": 2,
    penthouse: 2,
  },
  globalDiscountPercent: 0,
  dateMultipliers: {
    "12-31": 2,
  },
  currency: "INR",
  timezone: "Asia/Kolkata",
  rounding: {
    mode: "nearest",
    decimalPlaces: 0,
  },
  extraGuestFeeByUnitType: {
    "1bhk": 500,
    penthouse: 1200,
  },
  maxGuestsByUnitType: {
    "1bhk": 4,
    penthouse: 6,
  },
  cleaningFeeByUnitType: {},
};

export default pricingConfig;
