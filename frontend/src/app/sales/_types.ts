export type UnitPriceSource = "CUSTOMER_PRODUCT_PRICE" | "PRODUCT_STANDARD";

export type SaleStatus = "Active" | "Canceled";

export type SaleCorrectionType = "Cancellation" | "Replacement";

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

export type SaleListItem = {
  readonly saleId: number;
  readonly salesDate: string;
  readonly customerId: number;
  readonly customerCode: string;
  readonly customerName: string;
  readonly totalAmount: number;
  readonly createdAt: string;
  readonly status: SaleStatus;
  readonly statusChangedAt: string;
  readonly correctionType: SaleCorrectionType | null;
  readonly originalSaleId: number | null;
  readonly correctionSaleId: number | null;
  readonly correctionReason: string | null;
};

export type SaleStatusHistory = {
  readonly status: SaleStatus;
  readonly reason: string;
  readonly changedAt: string;
  readonly changedBy: string;
};

export type SaleDetailLine = {
  readonly saleDetailId: number;
  readonly productId: number;
  readonly productCode: string;
  readonly productName: string;
  readonly unit: string;
  readonly taxCategory: TaxCategory;
  readonly taxCategoryName: string;
  readonly accountingCategory: AccountingCategory;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly unitPriceSource: UnitPriceSource;
  readonly isManualUnitPrice: boolean;
  readonly autoUnitPrice: number;
  readonly manualUnitPriceReason: string | null;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly amount: number;
};

export type SaleResponse = {
  readonly saleId: number;
  readonly salesDate: string;
  readonly customerId: number;
  readonly customerCode: string;
  readonly customerName: string;
  readonly totalAmount: number;
  readonly createdAt: string;
  readonly status: SaleStatus;
  readonly statusChangedAt: string;
  readonly correctionType: SaleCorrectionType | null;
  readonly originalSaleId: number | null;
  readonly correctionSaleId: number | null;
  readonly correctionReason: string | null;
  readonly correctionCreatedBy: string | null;
  readonly statusHistories: readonly SaleStatusHistory[];
  readonly details: readonly SaleDetailLine[];
};

export type SalesLinePreview = {
  readonly productId: number;
  readonly productCode: string;
  readonly productName: string;
  readonly unit: string;
  readonly autoUnitPrice: number;
  readonly unitPriceSource: UnitPriceSource;
  readonly taxCategory: TaxCategory;
  readonly taxCategoryName: string;
  readonly accountingCategory: AccountingCategory;
  readonly taxRate: number;
  readonly isDiscontinued: boolean;
};

export type SaleSearchParams = {
  readonly salesDateFrom?: string;
  readonly salesDateTo?: string;
  readonly customerId?: number;
  readonly customerCode?: string;
  readonly includeCanceled?: boolean;
  readonly includeCorrections?: boolean;
};

export type SaleLineFormValues = {
  readonly productId: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly manualUnitPriceReason: string;
};

export type SaleEntryFormValues = {
  readonly salesDate: string;
  readonly customerId: string;
  readonly lines: readonly SaleLineFormValues[];
};

export type CreateSaleLineRequest = {
  readonly productId: number;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly manualUnitPriceReason: string | null;
};

export type CreateSaleRequest = {
  readonly salesDate: string;
  readonly customerId: number;
  readonly lines: readonly CreateSaleLineRequest[];
};

export const saleStatusLabels: Record<SaleStatus, string> = {
  Active: "有効",
  Canceled: "取消済",
};

export const saleCorrectionTypeLabels: Record<SaleCorrectionType, string> = {
  Cancellation: "取消",
  Replacement: "再登録",
};

export const unitPriceSourceLabels: Record<UnitPriceSource, string> = {
  CUSTOMER_PRODUCT_PRICE: "得意先別商品単価",
  PRODUCT_STANDARD: "商品標準単価（フォールバック）",
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

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export const formatRatePercent = (rate: number) => {
  const percent = rate * 100;
  return `${new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(percent)}%`;
};
