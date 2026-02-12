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

// Helper function to read environment variable with fallback
const getEnvDiscountPercent = (): number => {
  const envValue = typeof import.meta !== "undefined" 
    ? (import.meta.env?.VITE_GLOBAL_DISCOUNT_PERCENT as string | undefined)
    : undefined;
  
  // Build-time logging for Cloudflare Pages verification
  if (typeof process !== "undefined" && process.env) {
    const buildEnvValue = process.env.VITE_GLOBAL_DISCOUNT_PERCENT;
    console.log(`[build] VITE_GLOBAL_DISCOUNT_PERCENT: ${buildEnvValue || 'NOT SET'}${buildEnvValue ? '' : ' (using default: 17)'}`);
  }
  
  if (envValue) {
    const parsed = Number(envValue);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  }
  
  return 17; // Default fallback value
};

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
  globalDiscountPercent: getEnvDiscountPercent(),
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
