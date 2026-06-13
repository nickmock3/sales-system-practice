import { describe, expect, it } from "vitest";
import {
  customerProductPriceChangeFormSchema,
  customerProductPriceFormSchema,
  hasValidUnitPriceFormat,
} from "./_schemas";

describe("hasValidUnitPriceFormat", () => {
  // 単価は小数2桁までを許可する
  it("小数2桁までを許可する", () => {
    expect(hasValidUnitPriceFormat("95")).toBe(true);
    expect(hasValidUnitPriceFormat("95.5")).toBe(true);
    expect(hasValidUnitPriceFormat("95.55")).toBe(true);
    expect(hasValidUnitPriceFormat("95.555")).toBe(false);
  });
});

describe("customerProductPriceFormSchema", () => {
  // 初回登録フォームの必須項目を検証する
  it("必須項目を検証する", () => {
    const result = customerProductPriceFormSchema.safeParse({
      customerId: "",
      productId: "2",
      unitPrice: "95",
      effectiveFrom: "2026-06-01",
    });

    expect(result.success).toBe(false);
  });

  // 単価の小数3桁目は拒否する
  it("単価の小数3桁目は拒否する", () => {
    const result = customerProductPriceFormSchema.safeParse({
      customerId: "1",
      productId: "2",
      unitPrice: "95.555",
      effectiveFrom: "2026-06-01",
    });

    expect(result.success).toBe(false);
  });

  // 有効な入力は通過する
  it("有効な入力を通過させる", () => {
    const result = customerProductPriceFormSchema.safeParse({
      customerId: "1",
      productId: "2",
      unitPrice: "95.50",
      effectiveFrom: "2026-06-01",
    });

    expect(result.success).toBe(true);
  });
});

describe("customerProductPriceChangeFormSchema", () => {
  // 変更フォームでも単価の下限を検証する
  it("負の単価を拒否する", () => {
    const result = customerProductPriceChangeFormSchema.safeParse({
      unitPrice: "-1",
      effectiveFrom: "2026-06-01",
    });

    expect(result.success).toBe(false);
  });
});
