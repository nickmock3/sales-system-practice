import { z } from "zod";

export const hasValidUnitPriceFormat = (value: string) =>
  /^\d+(\.\d{1,2})?$/.test(value);

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

const positiveIdStringSchema = z
  .string()
  .trim()
  .min(1, "選択は必須です。")
  .refine((value) => Number.isInteger(Number(value)) && Number(value) > 0, {
    message: "有効な ID を選択してください。",
  });

export const customerProductPriceResponseSchema = z.object({
  customerId: z.number(),
  customerCode: z.string(),
  customerName: z.string(),
  productId: z.number(),
  productCode: z.string(),
  productName: z.string(),
  unitPrice: z.number(),
  effectiveFrom: z.string(),
  createdAt: z.string(),
});

export const customerProductPriceListResponseSchema = z.array(
  customerProductPriceResponseSchema,
);

export const customerProductPriceChangeSchema = z.object({
  unitPrice: z.number(),
  effectiveFrom: z.string(),
  createdAt: z.string(),
});

export const customerProductPriceChangesResponseSchema = z.array(
  customerProductPriceChangeSchema,
);

export const unitPriceSourceSchema = z.enum([
  "CUSTOMER_PRODUCT_PRICE",
  "PRODUCT_STANDARD",
]);

export const customerProductPricePreviewResponseSchema = z.object({
  customerId: z.number(),
  customerCode: z.string(),
  customerName: z.string(),
  productId: z.number(),
  productCode: z.string(),
  productName: z.string(),
  unit: z.string(),
  autoUnitPrice: z.number(),
  unitPriceSource: unitPriceSourceSchema,
  standardUnitPrice: z.number(),
  asOf: z.string(),
});

const effectiveFromSchema = z.string().min(1, "適用開始日は必須です。");

export const customerProductPriceFormSchema = z.object({
  customerId: positiveIdStringSchema,
  productId: positiveIdStringSchema,
  unitPrice: unitPriceStringSchema,
  effectiveFrom: effectiveFromSchema,
});

export const customerProductPriceChangeFormSchema = z.object({
  unitPrice: unitPriceStringSchema,
  effectiveFrom: effectiveFromSchema,
});

export const previewFormSchema = z.object({
  customerId: positiveIdStringSchema,
  productId: positiveIdStringSchema,
  asOf: effectiveFromSchema,
});
