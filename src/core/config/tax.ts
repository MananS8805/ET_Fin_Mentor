export const CURRENT_TAX_YEAR = "2025-26";
export const TAX_CONFIG_VALID_UNTIL_YEAR = 2027;
export const IS_TAX_CONFIG_CURRENT = new Date().getFullYear() < TAX_CONFIG_VALID_UNTIL_YEAR;

export const OLD_REGIME_SLABS_2025 = [
  { upto: 300_000, rate: 0 },
  { upto: 600_000, rate: 0.05 },
  { upto: 900_000, rate: 0.1 },
  { upto: 1_200_000, rate: 0.15 },
  { upto: 1_500_000, rate: 0.2 },
  { upto: Number.POSITIVE_INFINITY, rate: 0.3 },
] as const;

export const NEW_REGIME_SLABS_2025 = [
  { upto: 300_000, rate: 0 },
  { upto: 700_000, rate: 0.05 },
  { upto: 1_000_000, rate: 0.1 },
  { upto: 1_200_000, rate: 0.15 },
  { upto: 1_500_000, rate: 0.2 },
  { upto: Number.POSITIVE_INFINITY, rate: 0.3 },
] as const;

export function getTaxSlabWarning(): string | null {
  if (IS_TAX_CONFIG_CURRENT) return null;
  return `Tax slabs are for FY ${CURRENT_TAX_YEAR}. Please verify with a tax advisor for the current year.`;
}