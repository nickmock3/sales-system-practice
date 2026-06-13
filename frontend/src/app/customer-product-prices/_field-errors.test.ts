import { describe, expect, it } from "vitest";
import { toCustomerProductPriceFormFieldName } from "./_field-errors";

describe("toCustomerProductPriceFormFieldName", () => {
  // API の PascalCase エラーをフォームの camelCase へ紐付ける
  it("UnitPrice と EffectiveFrom を camelCase へ変換する", () => {
    expect(toCustomerProductPriceFormFieldName("UnitPrice")).toBe("unitPrice");
    expect(toCustomerProductPriceFormFieldName("unitPrice")).toBe("unitPrice");
    expect(toCustomerProductPriceFormFieldName("EffectiveFrom")).toBe(
      "effectiveFrom",
    );
    expect(toCustomerProductPriceFormFieldName("CustomerId")).toBe("customerId");
  });
});
