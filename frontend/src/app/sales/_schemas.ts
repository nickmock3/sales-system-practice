import { z } from "zod";

export const hasValidQuantityFormat = (value: string) =>
  /^\d+(\.\d{1,3})?$/.test(value);

export const hasValidUnitPriceFormat = (value: string) =>
  /^\d+(\.\d{1,2})?$/.test(value);

const positiveIdStringSchema = z
  .string()
  .trim()
  .min(1, "選択は必須です。")
  .refine((value) => Number.isInteger(Number(value)) && Number(value) > 0, {
    message: "有効な ID を選択してください。",
  });

const quantityStringSchema = z
  .string()
  .trim()
  .min(1, "数量は必須です。")
  .refine((value) => Number.isFinite(Number(value)), {
    message: "数量は数値で入力してください。",
  })
  .refine((value) => Number(value) > 0, {
    message: "数量は0より大きく入力してください。",
  })
  .refine((value) => hasValidQuantityFormat(value), {
    message: "数量は小数3桁までで入力してください。",
  });

const unitPriceStringSchema = z
  .string()
  .trim()
  .min(1, "単価は必須です。")
  .refine((value) => Number.isFinite(Number(value)), {
    message: "単価は数値で入力してください。",
  })
  .refine((value) => Number(value) >= 0, {
    message: "単価は0円以上で入力してください。",
  })
  .refine((value) => hasValidUnitPriceFormat(value), {
    message: "単価は小数2桁までで入力してください。",
  });

const manualUnitPriceReasonSchema = z
  .string()
  .trim()
  .max(300, "手入力変更理由は300文字以内で入力してください。");

const salesDateSchema = z.string().min(1, "売上日は必須です。");

export const unitPriceSourceSchema = z.enum([
  "CUSTOMER_PRODUCT_PRICE",
  "PRODUCT_STANDARD",
]);

export const saleStatusSchema = z.enum(["Active", "Canceled"]);

export const saleCorrectionTypeSchema = z.enum([
  "Cancellation",
  "Replacement",
]);

export const taxCategorySchema = z.enum([
  "STANDARD",
  "REDUCED",
  "NON_TAXABLE",
  "TAX_EXEMPT",
  "OLD_STANDARD",
]);

export const accountingCategorySchema = z.enum([
  "TAXABLE_STANDARD",
  "TAXABLE_REDUCED",
  "NON_TAXABLE",
  "TAX_EXEMPT",
  "TAXABLE_OLD_STANDARD",
]);

export const saleListItemResponseSchema = z.object({
  saleId: z.number(),
  salesDate: z.string(),
  customerId: z.number(),
  customerCode: z.string(),
  customerName: z.string(),
  totalAmount: z.number(),
  createdAt: z.string(),
  status: saleStatusSchema,
  statusChangedAt: z.string(),
  correctionType: saleCorrectionTypeSchema.nullable(),
  originalSaleId: z.number().nullable(),
  correctionSaleId: z.number().nullable(),
  correctionReason: z.string().nullable(),
});

export const saleListResponseSchema = z.array(saleListItemResponseSchema);

export const saleStatusHistoryResponseSchema = z.object({
  status: saleStatusSchema,
  reason: z.string(),
  changedAt: z.string(),
  changedBy: z.string(),
});

export const saleDetailLineResponseSchema = z.object({
  saleDetailId: z.number(),
  productId: z.number(),
  productCode: z.string(),
  productName: z.string(),
  unit: z.string(),
  taxCategory: taxCategorySchema,
  taxCategoryName: z.string(),
  accountingCategory: accountingCategorySchema,
  quantity: z.number(),
  unitPrice: z.number(),
  unitPriceSource: unitPriceSourceSchema,
  isManualUnitPrice: z.boolean(),
  autoUnitPrice: z.number(),
  manualUnitPriceReason: z.string().nullable(),
  taxRate: z.number(),
  taxAmount: z.number(),
  amount: z.number(),
});

export const saleResponseSchema = z.object({
  saleId: z.number(),
  salesDate: z.string(),
  customerId: z.number(),
  customerCode: z.string(),
  customerName: z.string(),
  totalAmount: z.number(),
  createdAt: z.string(),
  status: saleStatusSchema,
  statusChangedAt: z.string(),
  correctionType: saleCorrectionTypeSchema.nullable(),
  originalSaleId: z.number().nullable(),
  correctionSaleId: z.number().nullable(),
  correctionReason: z.string().nullable(),
  correctionCreatedBy: z.string().nullable(),
  statusHistories: z.array(saleStatusHistoryResponseSchema),
  details: z.array(saleDetailLineResponseSchema),
});

export const salesLinePreviewResponseSchema = z.object({
  productId: z.number(),
  productCode: z.string(),
  productName: z.string(),
  unit: z.string(),
  autoUnitPrice: z.number(),
  unitPriceSource: unitPriceSourceSchema,
  taxCategory: taxCategorySchema,
  taxCategoryName: z.string(),
  accountingCategory: accountingCategorySchema,
  taxRate: z.number(),
  isDiscontinued: z.boolean(),
});

export const saleLineFormSchema = z.object({
  productId: positiveIdStringSchema,
  quantity: quantityStringSchema,
  unitPrice: unitPriceStringSchema,
  manualUnitPriceReason: manualUnitPriceReasonSchema,
});

export const saleEntryFormSchema = z.object({
  salesDate: salesDateSchema,
  customerId: positiveIdStringSchema,
  lines: z
    .array(saleLineFormSchema)
    .min(1, "明細は1行以上入力してください。"),
});

export const saleSearchFormSchema = z.object({
  salesDateFrom: z.string(),
  salesDateTo: z.string(),
  customerId: z.string(),
  customerCode: z.string(),
  includeCanceled: z.boolean(),
  includeCorrections: z.boolean(),
});
