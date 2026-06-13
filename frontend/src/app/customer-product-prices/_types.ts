export type UnitPriceSource = "CUSTOMER_PRODUCT_PRICE" | "PRODUCT_STANDARD";

export type CustomerProductPriceSummary = {
  readonly customerId: number;
  readonly customerCode: string;
  readonly customerName: string;
  readonly productId: number;
  readonly productCode: string;
  readonly productName: string;
  readonly unitPrice: number;
  readonly effectiveFrom: string;
  readonly createdAt: string;
};

export type CustomerProductPriceChange = {
  readonly unitPrice: number;
  readonly effectiveFrom: string;
  readonly createdAt: string;
};

export type CustomerProductPricePreview = {
  readonly customerId: number;
  readonly customerCode: string;
  readonly customerName: string;
  readonly productId: number;
  readonly productCode: string;
  readonly productName: string;
  readonly unit: string;
  readonly autoUnitPrice: number;
  readonly unitPriceSource: UnitPriceSource;
  readonly standardUnitPrice: number;
  readonly asOf: string;
};

export type CustomerProductPricePreviewComposed = CustomerProductPricePreview & {
  readonly customerProductPriceEffectiveFrom: string | null;
  readonly productEffectiveFrom: string;
};

export type CustomerProductPriceSearchParams = {
  readonly customerId?: number;
  readonly productId?: number;
  readonly customerCode?: string;
  readonly productCode?: string;
  readonly asOf?: string;
};

export type CustomerProductPriceFormValues = {
  readonly customerId: string;
  readonly productId: string;
  readonly unitPrice: string;
  readonly effectiveFrom: string;
};

export type CustomerProductPriceChangeFormValues = {
  readonly unitPrice: string;
  readonly effectiveFrom: string;
};

export type PreviewFormValues = {
  readonly customerId: string;
  readonly productId: string;
  readonly asOf: string;
};

export const unitPriceSourceLabels: Record<UnitPriceSource, string> = {
  CUSTOMER_PRODUCT_PRICE: "得意先別商品単価",
  PRODUCT_STANDARD: "商品標準単価（フォールバック）",
};

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
