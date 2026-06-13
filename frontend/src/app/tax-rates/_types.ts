export type TaxCategory =
  | "STANDARD"
  | "REDUCED"
  | "NON_TAXABLE"
  | "TAX_EXEMPT"
  | "OLD_STANDARD";

export type AccountingCategory =
  | "TAXABLE_STANDARD"
  | "TAXABLE_REDUCED"
  | "NON_TAXABLE"
  | "TAX_EXEMPT"
  | "TAXABLE_OLD_STANDARD";

export type TaxRateSummary = {
  readonly taxCategory: TaxCategory;
  readonly taxCategoryName: string;
  readonly accountingCategory: AccountingCategory;
  readonly rate: number;
  readonly effectiveFrom: string;
};

export type TaxRateChange = TaxRateSummary;

export type TaxRateFormValues = {
  readonly taxCategory: TaxCategory;
  readonly ratePercent: string;
  readonly effectiveFrom: string;
};

export type TaxRateChangeFormValues = {
  readonly taxCategory: TaxCategory;
  readonly ratePercent: string;
  readonly effectiveFrom: string;
};

export const taxCategoryLabels: Record<TaxCategory, string> = {
  STANDARD: "標準税率",
  REDUCED: "軽減税率",
  NON_TAXABLE: "非課税",
  TAX_EXEMPT: "免税",
  OLD_STANDARD: "旧標準税率",
};

export const accountingCategoryLabels: Record<AccountingCategory, string> = {
  TAXABLE_STANDARD: "課税(標準)",
  TAXABLE_REDUCED: "課税(軽減)",
  NON_TAXABLE: "非課税",
  TAX_EXEMPT: "免税",
  TAXABLE_OLD_STANDARD: "課税(旧標準)",
};

export const taxCategories = Object.keys(taxCategoryLabels) as TaxCategory[];

export const zeroRateCategories: readonly TaxCategory[] = [
  "NON_TAXABLE",
  "TAX_EXEMPT",
];

export const requiresZeroRate = (taxCategory: TaxCategory) =>
  zeroRateCategories.includes(taxCategory);

export const formatRatePercent = (rate: number) => {
  const percent = rate * 100;
  return `${new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(percent)}%`;
};

export const rateToPercentInput = (rate: number) => {
  const percent = rate * 100;
  return Number.isInteger(percent) ? String(percent) : String(percent);
};
