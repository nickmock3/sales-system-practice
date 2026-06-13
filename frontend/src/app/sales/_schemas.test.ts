import { describe, expect, it } from "vitest";
import {
  hasValidQuantityFormat,
  hasValidUnitPriceFormat,
  saleEntryFormSchema,
  saleLineFormSchema,
} from "./_schemas";

describe("hasValidQuantityFormat", () => {
  // 数量は小数3桁までを許可する
  it("小数3桁までを許可する", () => {
    expect(hasValidQuantityFormat("1")).toBe(true);
    expect(hasValidQuantityFormat("1.005")).toBe(true);
    expect(hasValidQuantityFormat("1.0005")).toBe(false);
  });
});

describe("hasValidUnitPriceFormat", () => {
  // 単価は小数2桁までを許可する
  it("小数2桁までを許可する", () => {
    expect(hasValidUnitPriceFormat("100.01")).toBe(true);
    expect(hasValidUnitPriceFormat("100.011")).toBe(false);
  });
});

describe("saleLineFormSchema", () => {
  // 数量 0 以下は拒否する
  it("数量 0 以下を拒否する", () => {
    const result = saleLineFormSchema.safeParse({
      productId: "1",
      quantity: "0",
      unitPrice: "100",
      manualUnitPriceReason: "",
    });

    expect(result.success).toBe(false);
  });

  // 手入力変更理由は 300 文字以内
  it("300 文字を超える手入力変更理由を拒否する", () => {
    const result = saleLineFormSchema.safeParse({
      productId: "1",
      quantity: "1",
      unitPrice: "100",
      manualUnitPriceReason: "a".repeat(301),
    });

    expect(result.success).toBe(false);
  });
});

describe("saleEntryFormSchema", () => {
  // 明細 0 行は拒否する
  it("明細 0 行を拒否する", () => {
    const result = saleEntryFormSchema.safeParse({
      salesDate: "2026-04-15",
      customerId: "1",
      lines: [],
    });

    expect(result.success).toBe(false);
  });

  // 有効な入力は通過する
  it("有効な入力を通過させる", () => {
    const result = saleEntryFormSchema.safeParse({
      salesDate: "2026-04-15",
      customerId: "1",
      lines: [
        {
          productId: "2",
          quantity: "1.005",
          unitPrice: "100.01",
          manualUnitPriceReason: "",
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
