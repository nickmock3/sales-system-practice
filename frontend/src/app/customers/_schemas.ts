import { z } from "zod";

export const customerResponseSchema = z.object({
  customerId: z.number(),
  customerCode: z.string(),
  customerVersionId: z.number(),
  name: z.string(),
  address: z.string(),
  phoneNumber: z.string(),
  validFrom: z.string(),
});

export const customerListResponseSchema = z.array(customerResponseSchema);

export const customerFormSchema = z.object({
  customerCode: z
    .string()
    .trim()
    .min(1, "得意先コードは必須です。")
    .max(30, "得意先コードは30文字以内で入力してください。"),
  name: z
    .string()
    .trim()
    .min(1, "得意先名は必須です。")
    .max(100, "得意先名は100文字以内で入力してください。"),
  address: z
    .string()
    .trim()
    .min(1, "住所は必須です。")
    .max(300, "住所は300文字以内で入力してください。"),
  phoneNumber: z
    .string()
    .trim()
    .min(1, "電話番号は必須です。")
    .max(30, "電話番号は30文字以内で入力してください。"),
  validFrom: z.string().min(1, "適用開始日は必須です。"),
});

export const customerVersionFormSchema = customerFormSchema.omit({
  customerCode: true,
});
