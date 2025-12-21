export interface PriceDisplayConfig {
  discount: {
    primaryBadgeLabel: string;
    secondaryBadgeLabel: string;
    reasonLabel: string;
    savingsPrefix: string;
  };
  defaultSpecialLabel: string;
  specialPricingLabels: Record<string, string>;
}

export const priceDisplayConfig: PriceDisplayConfig = {
  discount: {
    primaryBadgeLabel: "Smart Saver Price",
    secondaryBadgeLabel: "🔥 Hot Deal",
    reasonLabel: "Limited-time Atlas member deal",
    savingsPrefix: "You save",
  },
  defaultSpecialLabel: "Special day pricing",
  specialPricingLabels: {
    "12-31": "New Year Special Pricing 🎉",
  },
};

export default priceDisplayConfig;
