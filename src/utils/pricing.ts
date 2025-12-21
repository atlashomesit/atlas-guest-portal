import pricingConfig, { type PricingConfig, type UnitType } from "../config/pricing.config";

type CalculateNightlyPriceInput = {
  unitType: UnitType;
  checkInDate: Date | string;
  guests?: number;
};

export type NightlyPriceBreakdown = {
  baseNightlyPrice: number;
  discountAmount: number;
  discountedNightlyPrice: number;
  dateMultiplier: number;
  extraGuestFee: number;
  finalNightlyPrice: number;
  currency: string;
  appliedDiscountPercent: number;
  includedGuests: number;
  isNewYearsEve: boolean;
};

const getEnvValue = (key: string): string | undefined => {
  if (typeof import.meta !== "undefined" && (import.meta as any).env && (import.meta as any).env[key] !== undefined) {
    return (import.meta as any).env[key];
  }

  if (typeof process !== "undefined" && (process as any).env && (process as any).env[key] !== undefined) {
    return (process as any).env[key];
  }

  return undefined;
};

const parseEnvDiscount = (config: PricingConfig): number => {
  const envValue = getEnvValue("VITE_GLOBAL_DISCOUNT_PERCENT");
  if (!envValue) return config.globalDiscountPercent;

  const parsed = Number(envValue);
  return Number.isFinite(parsed) ? parsed : config.globalDiscountPercent;
};

const parseEnvDateMultipliers = (config: PricingConfig): Record<string, number> => {
  const envValue = getEnvValue("VITE_DATE_MULTIPLIERS_JSON");
  if (!envValue) return config.dateMultipliers;

  try {
    const parsed = JSON.parse(envValue);
    if (parsed && typeof parsed === "object") {
      const sanitized = Object.entries(parsed).reduce<Record<string, number>>((acc, [key, value]) => {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
          acc[key] = numericValue;
        }
        return acc;
      }, {});

      return Object.keys(sanitized).length > 0 ? sanitized : config.dateMultipliers;
    }
    return config.dateMultipliers;
  } catch (error) {
    console.warn("Invalid VITE_DATE_MULTIPLIERS_JSON:", error);
    return config.dateMultipliers;
  }
};

const formatDateKey = (date: Date, timezone: string): string => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${month}-${day}`;
};

const applyRounding = (value: number, { mode, decimalPlaces }: PricingConfig["rounding"]): number => {
  const factor = 10 ** decimalPlaces;
  if (mode === "up") return Math.ceil(value * factor) / factor;
  if (mode === "down") return Math.floor(value * factor) / factor;
  return Math.round(value * factor) / factor;
};

const getIncludedGuests = (unitType: UnitType): number => {
  return (
    pricingConfig.includedGuestsByUnitType[unitType] ??
    pricingConfig.includedGuestsByUnitType.default ??
    pricingConfig.includedGuestsByUnitType["1bhk"] ??
    2
  );
};

const getExtraGuestFee = (unitType: UnitType): number => {
  return pricingConfig.extraGuestFeeByUnitType?.[unitType] ?? 0;
};

export const inferUnitType = (property: { id?: string | number; property_name?: string; name?: string }): UnitType => {
  const derivedName = property.property_name || property.name || "";
  const normalized = derivedName.toLowerCase();

  if (String(property.id) === "501" || normalized.includes("penthouse")) {
    return "penthouse";
  }

  return "1bhk";
};

export const calculateNightlyPrice = ({
  unitType,
  checkInDate,
  guests,
}: CalculateNightlyPriceInput): NightlyPriceBreakdown => {
  const validDate = new Date(checkInDate);
  if (Number.isNaN(validDate.getTime())) {
    throw new Error("Invalid check-in date supplied to calculateNightlyPrice");
  }

  const discountPercent = parseEnvDiscount(pricingConfig);
  const dateMultipliers = parseEnvDateMultipliers(pricingConfig);
  const baseNightlyPrice = pricingConfig.baseNightlyPriceByUnitType[unitType];

  if (!baseNightlyPrice) {
    throw new Error(`No base price configured for unit type: ${unitType}`);
  }

  const includedGuests = getIncludedGuests(unitType);
  const extraGuestFee = getExtraGuestFee(unitType);
  const guestCount = Math.max(guests ?? includedGuests, 1);
  const extraGuests = Math.max(0, guestCount - includedGuests);
  const extraGuestCharge = extraGuests > 0 ? extraGuests * extraGuestFee : 0;

  const discountAmount = (baseNightlyPrice * discountPercent) / 100;
  const discountedNightlyPrice = baseNightlyPrice - discountAmount;

  const dateKey = formatDateKey(validDate, pricingConfig.timezone);
  const dateMultiplier = dateMultipliers[dateKey] ?? 1;
  const subtotalBeforeMultiplier = discountedNightlyPrice + extraGuestCharge;
  const finalNightlyPrice = applyRounding(
    subtotalBeforeMultiplier * dateMultiplier,
    pricingConfig.rounding,
  );

  return {
    baseNightlyPrice,
    discountAmount,
    discountedNightlyPrice,
    dateMultiplier,
    extraGuestFee: extraGuestCharge,
    finalNightlyPrice,
    currency: pricingConfig.currency,
    appliedDiscountPercent: discountPercent,
    includedGuests,
    isNewYearsEve: dateKey === "12-31" && dateMultiplier > 1,
  };
};
