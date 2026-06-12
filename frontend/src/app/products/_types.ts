export type TaxCategory =
  | "STANDARD"
  | "REDUCED"
  | "NON_TAXABLE"
  | "TAX_EXEMPT"
  | "OLD_STANDARD";

export type ProductSummary = {
  readonly productId: number;
  readonly productCode: string;
  readonly name: string;
  readonly unit: string;
  readonly standardUnitPrice: number;
  readonly taxCategory: TaxCategory;
  readonly isDiscontinued: boolean;
  readonly effectiveFrom: string;
};

export type ProductChange = {
  readonly effectiveFrom: string;
  readonly name: string;
  readonly unit: string;
  readonly standardUnitPrice: number;
  readonly taxCategory: TaxCategory;
  readonly isDiscontinued: boolean;
};

export type ProductSearchParams = {
  readonly productCode?: string;
  readonly name?: string;
  readonly isDiscontinued?: boolean;
};

export type ProductFormValues = {
  readonly productCode: string;
  readonly name: string;
  readonly unit: string;
  readonly standardUnitPrice: string;
  readonly taxCategory: TaxCategory;
  readonly isDiscontinued: boolean;
  readonly effectiveFrom: string;
};

export type ProductChangeFormValues = Omit<ProductFormValues, "productCode">;

export const taxCategoryLabels: Record<TaxCategory, string> = {
  STANDARD: "標準税率",
  REDUCED: "軽減税率",
  NON_TAXABLE: "非課税",
  TAX_EXEMPT: "免税",
  OLD_STANDARD: "旧標準税率",
};

export const taxCategories = Object.keys(taxCategoryLabels) as TaxCategory[];
