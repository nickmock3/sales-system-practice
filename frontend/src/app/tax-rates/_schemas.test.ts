import { describe, expect, it } from "vitest";
import {
  exceedsMaxRatePercent,
  hasValidRatePercentFormat,
  isPositiveRatePercent,
  isZeroRatePercent,
  percentToDecimalRate,
  taxRateChangeFormSchema,
  taxRateFormSchema,
} from "./_schemas";
import { formatRatePercent } from "./_types";

describe("hasValidRatePercentFormat", () => {
  // 画面入力は百分率の小数2桁までを許可する
  it("百分率の小数2桁までを許可する", () => {
    expect(hasValidRatePercentFormat("8.25")).toBe(true);
    expect(hasValidRatePercentFormat("8.251")).toBe(false);
    expect(hasValidRatePercentFormat("999.99")).toBe(true);
  });
});

describe("percentToDecimalRate", () => {
  // 画面入力の百分率を API 用の小数税率へ変換する
  it("百分率を小数税率へ変換する", () => {
    expect(percentToDecimalRate("10")).toBe(0.1);
    expect(percentToDecimalRate("8")).toBe(0.08);
    expect(percentToDecimalRate("8.25")).toBe(0.0825);
    expect(percentToDecimalRate("0")).toBe(0);
    expect(percentToDecimalRate("999.99")).toBe(9.9999);
  });
});

describe("exceedsMaxRatePercent", () => {
  // 百分率の上限は 999.99% とする
  it("999.99%を上限として判定する", () => {
    expect(exceedsMaxRatePercent("999.99")).toBe(false);
    expect(exceedsMaxRatePercent("1000")).toBe(true);
    expect(exceedsMaxRatePercent("999.991")).toBe(false);
  });
});

describe("isZeroRatePercent", () => {
  // 非課税・免税向けに 0% 判定を行う
  it("0%入力を判定する", () => {
    expect(isZeroRatePercent("0")).toBe(true);
    expect(isZeroRatePercent("0.00")).toBe(true);
    expect(isZeroRatePercent("0.01")).toBe(false);
  });
});

describe("isPositiveRatePercent", () => {
  // 課税対象向けに 0% より大きい入力を判定する
  it("0%より大きい入力を判定する", () => {
    expect(isPositiveRatePercent("8.25")).toBe(true);
    expect(isPositiveRatePercent("0")).toBe(false);
  });
});

describe("formatRatePercent", () => {
  // 小数税率を業務画面向けの百分率表示へ整形する
  it("小数税率を百分率表示へ整形する", () => {
    expect(formatRatePercent(0.1)).toBe("10%");
    expect(formatRatePercent(0.08)).toBe("8%");
    expect(formatRatePercent(0)).toBe("0%");
    expect(formatRatePercent(0.0825)).toBe("8.25%");
  });
});

describe("taxRateFormSchema", () => {
  // 非課税・免税は 0% のみ許可する
  it("非課税・免税は0%のみ許可する", () => {
    const result = taxRateFormSchema.safeParse({
      taxCategory: "NON_TAXABLE",
      ratePercent: "8",
      effectiveFrom: "2026-06-01",
    });

    expect(result.success).toBe(false);
  });

  // 課税対象は 0% より大きい税率を要求する
  it("課税対象は0%より大きい税率を要求する", () => {
    const result = taxRateFormSchema.safeParse({
      taxCategory: "STANDARD",
      ratePercent: "0",
      effectiveFrom: "2026-06-01",
    });

    expect(result.success).toBe(false);
  });

  // 百分率の小数3桁目は拒否する
  it("百分率の小数3桁目は拒否する", () => {
    const result = taxRateFormSchema.safeParse({
      taxCategory: "STANDARD",
      ratePercent: "8.251",
      effectiveFrom: "2026-06-01",
    });

    expect(result.success).toBe(false);
  });

  // 百分率の小数2桁までは許可する
  it("百分率の小数2桁までは許可する", () => {
    const result = taxRateFormSchema.safeParse({
      taxCategory: "STANDARD",
      ratePercent: "8.25",
      effectiveFrom: "2026-06-01",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(percentToDecimalRate(result.data.ratePercent)).toBe(0.0825);
    }
  });

  // 同じ税率値でも税区分ごとに登録できる
  it("同じ税率値でも税区分ごとに登録できる", () => {
    const reduced = taxRateFormSchema.safeParse({
      taxCategory: "REDUCED",
      ratePercent: "8",
      effectiveFrom: "2026-06-01",
    });
    const oldStandard = taxRateFormSchema.safeParse({
      taxCategory: "OLD_STANDARD",
      ratePercent: "8",
      effectiveFrom: "2026-06-01",
    });

    expect(reduced.success).toBe(true);
    expect(oldStandard.success).toBe(true);
  });
});

describe("taxRateChangeFormSchema", () => {
  // 変更フォームでも小数税率上限を検証する
  it("小数税率上限を検証する", () => {
    const result = taxRateChangeFormSchema.safeParse({
      taxCategory: "STANDARD",
      ratePercent: "1000",
      effectiveFrom: "2026-06-01",
    });

    expect(result.success).toBe(false);
  });
});
