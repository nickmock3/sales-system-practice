import { z } from "zod";
import {
  requiresZeroRate,
  type TaxCategory,
  type TaxRateChangeFormValues,
  type TaxRateFormValues,
} from "./_types";

const taxCategorySchema = z.enum([
  "STANDARD",
  "REDUCED",
  "NON_TAXABLE",
  "TAX_EXEMPT",
  "OLD_STANDARD",
]);

const accountingCategorySchema = z.enum([
  "TAXABLE_STANDARD",
  "TAXABLE_REDUCED",
  "NON_TAXABLE",
  "TAX_EXEMPT",
  "TAXABLE_OLD_STANDARD",
]);

const MAX_PERCENT_WHOLE = 999;
const MAX_PERCENT_FRACTION = 99;

export const hasValidRatePercentFormat = (value: string) =>
  /^\d+(\.\d{1,2})?$/.test(value);

export const isZeroRatePercent = (value: string) => {
  if (!hasValidRatePercentFormat(value)) {
    return false;
  }

  const [wholePart, fractionPart = ""] = value.split(".");
  return wholePart === "0" && (fractionPart === "" || /^0*$/.test(fractionPart));
};

export const isPositiveRatePercent = (value: string) =>
  hasValidRatePercentFormat(value) && !isZeroRatePercent(value);

export const exceedsMaxRatePercent = (value: string) => {
  if (!hasValidRatePercentFormat(value)) {
    return false;
  }

  const [wholePart, fractionPart = ""] = value.split(".");
  const whole = Number(wholePart);
  if (whole > MAX_PERCENT_WHOLE) {
    return true;
  }

  if (whole < MAX_PERCENT_WHOLE) {
    return false;
  }

  if (fractionPart === "") {
    return false;
  }

  return Number(fractionPart.padEnd(2, "0")) > MAX_PERCENT_FRACTION;
};

export const percentToDecimalRate = (ratePercent: string) => {
  const [wholePart, fractionPart = ""] = ratePercent.split(".");
  const whole = Number(wholePart);
  const fraction = Number(fractionPart.padEnd(2, "0").slice(0, 2));
  return (whole * 100 + fraction) / 10_000;
};

export const taxRateResponseSchema = z.object({
  taxCategory: taxCategorySchema,
  taxCategoryName: z.string(),
  accountingCategory: accountingCategorySchema,
  rate: z.number(),
  effectiveFrom: z.string(),
});

export const taxRateListResponseSchema = z.array(taxRateResponseSchema);

export const taxRateChangeSchema = taxRateResponseSchema;

export const taxRateChangesResponseSchema = z.array(taxRateChangeSchema);

const ratePercentBaseSchema = z
  .string()
  .trim()
  .min(1, "税率は必須です。")
  .refine((value) => Number.isFinite(Number(value)), {
    message: "税率は数値で入力してください。",
  })
  .refine((value) => Number(value) >= 0, {
    message: "税率は0%以上で入力してください。",
  })
  .refine((value) => hasValidRatePercentFormat(value), {
    message: "税率は小数2桁までで入力してください。",
  });

const validateRatePercentForCategory = (
  taxCategory: TaxCategory,
  ratePercent: string,
  ctx: z.RefinementCtx,
  path: ["ratePercent"],
) => {
  if (!hasValidRatePercentFormat(ratePercent)) {
    return;
  }

  if (exceedsMaxRatePercent(ratePercent)) {
    ctx.addIssue({
      code: "custom",
      message: "税率は999.99%以下で入力してください。",
      path,
    });
    return;
  }

  if (requiresZeroRate(taxCategory)) {
    if (!isZeroRatePercent(ratePercent)) {
      ctx.addIssue({
        code: "custom",
        message: "非課税・免税の税率は0%で入力してください。",
        path,
      });
    }
    return;
  }

  if (!isPositiveRatePercent(ratePercent)) {
    ctx.addIssue({
      code: "custom",
      message: "課税対象の税率は0%より大きい値で入力してください。",
      path,
    });
  }
};

const taxRateFieldsSchema = z.object({
  ratePercent: ratePercentBaseSchema,
  effectiveFrom: z.string().min(1, "適用開始日は必須です。"),
});

export const taxRateFormSchema = taxRateFieldsSchema
  .extend({
    taxCategory: taxCategorySchema,
  })
  .superRefine((values: TaxRateFormValues, ctx) => {
    validateRatePercentForCategory(
      values.taxCategory,
      values.ratePercent,
      ctx,
      ["ratePercent"],
    );
  });

export const taxRateChangeFormSchema = taxRateFieldsSchema
  .extend({
    taxCategory: taxCategorySchema,
  })
  .superRefine((values: TaxRateChangeFormValues, ctx) => {
    validateRatePercentForCategory(
      values.taxCategory,
      values.ratePercent,
      ctx,
      ["ratePercent"],
    );
  });
