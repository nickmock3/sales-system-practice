import { describe, expect, it } from "vitest";
import {
  calculateLineAmount,
  calculateLineTaxAmount,
  calculateLineTotalWithTax,
  calculateSaleLineAmounts,
  calculateSaleTotals,
} from "./_amounts";

describe("calculateLineAmount", () => {
  // 明細金額は小数第3位を四捨五入して小数第2位にする
  it("1.005 × 100.01 を 100.51 に丸める", () => {
    expect(calculateLineAmount(1.005, 100.01)).toBe(100.51);
  });

  // 数量と単価の積を C# の AwayFromZero と同様に丸める
  it("2.333 × 50.00 を 116.65 に丸める", () => {
    expect(calculateLineAmount(2.333, 50)).toBe(116.65);
  });
});

describe("calculateLineTaxAmount", () => {
  // 税額は明細金額 × 税率の 1 円未満を切り捨てる
  it("303.00 × 10% の税額を 30.00 に切り捨てる", () => {
    expect(calculateLineTaxAmount(303, 0.1)).toBe(30);
  });
});

describe("calculateSaleLineAmounts", () => {
  // 明細金額・税額・税込金額をまとめて計算する
  it("数量 3、単価 101、税率 10% の明細を計算する", () => {
    const result = calculateSaleLineAmounts({
      quantity: 3,
      unitPrice: 101,
      taxRate: 0.1,
    });

    expect(result.amount).toBe(303);
    expect(result.taxAmount).toBe(30);
    expect(result.totalWithTax).toBe(333);
  });
});

describe("calculateSaleTotals", () => {
  // 伝票合計は明細ごとの税込金額を合算する
  it("複数明細の合計を計算する", () => {
    const result = calculateSaleTotals([
      { quantity: 1.005, unitPrice: 100.01, taxRate: 0.1 },
      { quantity: 2.333, unitPrice: 50, taxRate: 0.1 },
    ]);

    expect(result.amountTotal).toBe(217.16);
    expect(result.taxAmountTotal).toBe(21);
    expect(result.totalAmount).toBe(238.16);
  });
});

describe("calculateLineTotalWithTax", () => {
  // 明細税込金額は明細金額と税額の合計
  it("明細金額と税額から税込金額を求める", () => {
    expect(calculateLineTotalWithTax(303, 30)).toBe(333);
  });
});
