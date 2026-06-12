import { z } from "zod";

const taxCategorySchema = z.enum([
  "STANDARD",
  "REDUCED",
  "NON_TAXABLE",
  "TAX_EXEMPT",
  "OLD_STANDARD",
]);

export const productResponseSchema = z.object({
  productId: z.number(),
  productCode: z.string(),
  name: z.string(),
  unit: z.string(),
  standardUnitPrice: z.number(),
  taxCategory: taxCategorySchema,
  isDiscontinued: z.boolean(),
  effectiveFrom: z.string(),
});

export const productListResponseSchema = z.array(productResponseSchema);

export const productChangeSchema = z.object({
  effectiveFrom: z.string(),
  name: z.string(),
  unit: z.string(),
  standardUnitPrice: z.number(),
  taxCategory: taxCategorySchema,
  isDiscontinued: z.boolean(),
});

export const productChangesResponseSchema = z.array(productChangeSchema);

const productFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "商品名は必須です。")
    .max(100, "商品名は100文字以内で入力してください。"),
  unit: z
    .string()
    .trim()
    .min(1, "単位は必須です。")
    .max(20, "単位は20文字以内で入力してください。"),
  standardUnitPrice: z
    .string()
    .trim()
    .min(1, "標準単価は必須です。")
    .refine((value) => Number.isFinite(Number(value)), {
      message: "標準単価は数値で入力してください。",
    })
    .refine((value) => Number(value) >= 0, {
      message: "標準単価は0円以上で入力してください。",
    })
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
      message: "標準単価は小数2桁までで入力してください。",
    }),
  taxCategory: taxCategorySchema,
  isDiscontinued: z.boolean(),
  effectiveFrom: z.string().min(1, "適用開始日は必須です。"),
});

export const productFormSchema = productFieldsSchema.extend({
  productCode: z
    .string()
    .trim()
    .min(1, "商品コードは必須です。")
    .max(30, "商品コードは30文字以内で入力してください。"),
});

export const productChangeFormSchema = productFieldsSchema;
