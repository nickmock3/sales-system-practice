import { describe, expect, it } from "vitest";
import { toTaxRateFormFieldName } from "./_field-errors";

describe("toTaxRateFormFieldName", () => {
  // API の Rate エラーをフォームの ratePercent へ紐付ける
  it("Rate を ratePercent にマッピングする", () => {
    expect(toTaxRateFormFieldName("Rate")).toBe("ratePercent");
    expect(toTaxRateFormFieldName("rate")).toBe("ratePercent");
  });

  // 既存フィールドは従来どおり camelCase へ変換する
  it("EffectiveFrom と taxCategory を既存フィールドへ変換する", () => {
    expect(toTaxRateFormFieldName("EffectiveFrom")).toBe("effectiveFrom");
    expect(toTaxRateFormFieldName("taxCategory")).toBe("taxCategory");
  });
});
